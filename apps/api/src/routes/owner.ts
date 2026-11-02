import { Router, type Response } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { addDays, iso, today } from '../dates.js';
import { requireRole } from '../auth.js';
import { p95 } from '../metrics.js';
import { pushToUser } from '../push.js';
import { runAlerts } from '../alerts.js';
import { membersWithStatus } from './staff.js';

export const owner = Router();
const isOwner = requireRole('OWNER');
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : null);
const GRACE = 7; // días tras el vencimiento para considerar "baja" si no renovó

export async function kpis(ref = today()) {
  const from = addDays(ref, -30);
  const ended = await db.membership.findMany({
    where: { endDate: { gte: from, lt: ref } },
    include: { next: { select: { onTime: true } }, notices: { where: { kind: { in: ['D7', 'D3'] } } } },
  });
  const onTime = ended.filter((m) => m.next?.onTime).length;
  const timely = ended.filter((m) =>
    m.notices.some((n) => n.createdAt <= addDays(m.endDate, -2) && (n.pushedAt || n.readAt || n.waSentAt)),
  ).length;
  const churned = await db.membership.count({
    where: { next: null, endDate: { gte: addDays(from, -GRACE), lt: addDays(ref, -GRACE) } },
  });
  const base = await db.membership.count({ where: { startDate: { lte: from }, endDate: { gte: from }, cancelledAt: null } });
  const hours = await db.manualHours.findMany({ orderBy: { weekStart: 'desc' }, take: 4 });
  const baseline = Object.fromEntries((await db.baseline.findMany()).map((b) => [b.key, b.value]));
  return {
    period: { from: iso(from), to: iso(addDays(ref, -1)) },
    baseline,
    current: {
      renovacionOportuna: pct(onTime, ended.length),
      tasaBaja: pct(churned, base),
      avisosOportunos: pct(timely, ended.length),
      horasControlManual: hours.length
        ? Math.round((hours.reduce((s, h) => s + Number(h.hours), 0) / hours.length) * 10) / 10
        : null,
      tiempoRespuestaP95ms: p95(),
    },
    samples: { vencidasEnPeriodo: ended.length, sociosBase: base, semanasHoras: hours.length },
  };
}

owner.get('/kpis', isOwner, async (_req, res) => res.json(await kpis()));

owner.post('/manual-hours', isOwner, async (req, res) => {
  const b = z.object({ weekStart: z.string().date(), hours: z.number().min(0).max(168) }).parse(req.body);
  const weekStart = new Date(b.weekStart);
  res
    .status(201)
    .json(await db.manualHours.upsert({ where: { weekStart }, create: { weekStart, hours: b.hours }, update: { hours: b.hours } }));
});

/** Ejecución manual del motor; la fecha simulada solo fuera de producción (demo de 7/3/0 días). */
owner.post('/jobs/alerts', isOwner, async (req, res) => {
  const { date } = z.object({ date: z.string().date().optional() }).parse(req.body ?? {});
  if (date && process.env.NODE_ENV === 'production')
    return void res.status(400).json({ error: 'Fecha simulada no permitida en producción' });
  res.json(await runAlerts(date ? new Date(date) : today()));
});

const segment = z.object({
  status: z.enum(['ACTIVA', 'POR_VENCER', 'VENCIDA', 'BAJA']).optional(),
  planId: z.string().optional(),
});

owner.post('/broadcasts', isOwner, async (req, res) => {
  const b = segment
    .extend({ title: z.string().trim().min(3).max(80), body: z.string().trim().min(3).max(500) })
    .parse(req.body);
  const targets = (await membersWithStatus()).filter(
    (m) => m.membership && (!b.status || m.membership.status === b.status) && (!b.planId || m.membership.planId === b.planId),
  );
  const bc = await db.broadcast.create({
    data: { title: b.title, body: b.body, segment: { status: b.status ?? null, planId: b.planId ?? null }, sentCount: targets.length },
  });
  await db.notice.createMany({
    data: targets.map((m) => ({ memberId: m.id, broadcastId: bc.id, kind: 'BROADCAST' as const, title: b.title, body: b.body })),
  });
  // shortcut: push secuencial dentro de la petición; mover a cola si los envíos superan ~1 000.
  for (const m of targets) if (m.userId) await pushToUser(m.userId, { title: b.title, body: b.body, url: '/app/socio' });
  res.status(201).json(bc);
});

owner.get('/broadcasts', isOwner, async (_req, res) =>
  res.json(await db.broadcast.findMany({ orderBy: { createdAt: 'desc' }, take: 50 })),
);

type Cell = string | number | null | undefined;
// CSV con BOM y ';' para Excel en español; se neutralizan fórmulas (inyección CSV).
export const csv = (rows: Cell[][]) =>
  '﻿' +
  rows
    .map((r) => r.map((v) => '"' + String(v ?? '').replace(/"/g, '""').replace(/^[=+\-@]/, "'$&") + '"').join(';'))
    .join('\r\n');
const send = (res: Response, name: string, body: string) =>
  res.type('text/csv; charset=utf-8').attachment(`${name}-${iso(today())}.csv`).send(body);

owner.get('/reports/members.csv', isOwner, async (_req, res) => {
  const rows = await membersWithStatus();
  send(
    res,
    'socios',
    csv([
      ['Socio', 'Celular', 'Plan', 'Inicio', 'Vencimiento', 'Estado', 'Días restantes'],
      ...rows.map((r) => [r.fullName, r.phone, r.membership?.plan, r.membership?.startDate, r.membership?.endDate, r.membership?.status, r.membership?.daysLeft]),
    ]),
  );
});

owner.get('/reports/notices.csv', isOwner, async (_req, res) => {
  const rows = await db.notice.findMany({ orderBy: { createdAt: 'desc' }, take: 5000, include: { member: { select: { fullName: true } } } });
  send(
    res,
    'avisos',
    csv([
      ['Fecha', 'Socio', 'Tipo', 'Título', 'Push', 'Leído', 'WhatsApp'],
      ...rows.map((n) => [n.createdAt.toISOString(), n.member.fullName, n.kind, n.title, n.pushedAt?.toISOString(), n.readAt?.toISOString(), n.waSentAt?.toISOString()]),
    ]),
  );
});

owner.get('/reports/kpis.csv', isOwner, async (_req, res) => {
  const k = await kpis();
  send(res, 'indicadores', csv([['Indicador', 'Línea base', 'Actual'], ...Object.entries(k.current).map(([key, v]) => [key, k.baseline[key], v])]));
});
