import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { addDays, daysLeft, iso, statusOf, today, type Status } from '../dates.js';
import { requireRole } from '../auth.js';
import { newAttendanceCode } from '../attendance-code.js';

export const staff = Router();
const isStaff = requireRole('OWNER', 'STAFF');
const isOwner = requireRole('OWNER');
const STATUSES = ['ACTIVA', 'POR_VENCER', 'VENCIDA', 'BAJA'] as const;
const phone = z.string().regex(/^9\d{8}$/, 'Celular peruano de 9 dígitos');

/** Socio + membresía vigente (la de fecha de fin más reciente). */
export async function membersWithStatus(where = {}) {
  const ref = today();
  const rows = await db.member.findMany({
    where,
    orderBy: { fullName: 'asc' },
    include: {
      memberships: { orderBy: { endDate: 'desc' }, take: 1, include: { plan: true } },
      notices: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
  return rows.map(({ memberships: [m], notices: [n], ...r }) => ({
    ...r,
    membership: m && {
      id: m.id,
      plan: m.plan.name,
      planId: m.planId,
      startDate: iso(m.startDate),
      endDate: iso(m.endDate),
      status: statusOf(m, ref),
      daysLeft: daysLeft(m.endDate, ref),
    },
    lastNotice: n && { id: n.id, kind: n.kind, createdAt: n.createdAt, waSentAt: n.waSentAt },
  }));
}

// shortcut: filtro de estado en memoria (≈500 socios); pasar a SQL con whereStatus si supera ~5 000.
staff.get('/members', isStaff, async (req, res) => {
  const q = z.object({ q: z.string().max(60).optional(), status: z.string().optional() }).parse(req.query);
  const statuses = q.status?.split(',').filter((s): s is Status => (STATUSES as readonly string[]).includes(s));
  const rows = await membersWithStatus(
    q.q ? { OR: [{ fullName: { contains: q.q, mode: 'insensitive' } }, { phone: { contains: q.q } }] } : {},
  );
  res.json(statuses?.length ? rows.filter((r) => r.membership && statuses.includes(r.membership.status)) : rows);
});

const memberBody = z.object({
  fullName: z.string().trim().min(3).max(80),
  phone,
  email: z
    .string()
    .email()
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

staff.post('/members', isStaff, async (req, res) => {
  const b = memberBody
    .extend({
      planId: z.string(),
      consent: z.literal(true, { errorMap: () => ({ message: 'Se requiere el consentimiento del socio' }) }),
    })
    .parse(req.body);
  const plan = await db.plan.findUniqueOrThrow({ where: { id: b.planId } });
  const start = today();
  const m = await db.member.create({
    data: {
      fullName: b.fullName,
      phone: b.phone,
      email: b.email,
      consentAt: new Date(),
      attendanceCode: await newAttendanceCode(db),
      memberships: { create: { planId: plan.id, startDate: start, endDate: addDays(start, plan.durationDays - 1) } },
    },
  });
  res.status(201).json(m);
});

staff.patch('/members/:id', isStaff, async (req, res) => {
  res.json(
    await db.member.update({ where: { id: req.params.id as string }, data: memberBody.partial().parse(req.body) }),
  );
});

/** Renovación en 1 llamada: por defecto mismo plan; si aún no vence, continúa desde el día siguiente al fin. */
staff.post('/members/:id/renew', isStaff, async (req, res) => {
  // fromId = membresía que se renueva; previousId es único, así un doble toque devuelve 409 en vez de duplicar.
  const { planId, fromId } = z
    .object({ planId: z.string().optional(), fromId: z.string().optional() })
    .parse(req.body ?? {});
  const ref = today();
  const prev = await db.membership.findFirst({
    where: { memberId: req.params.id as string, ...(fromId && { id: fromId }) },
    orderBy: { endDate: 'desc' },
  });
  const plan = await db.plan.findUniqueOrThrow({ where: { id: planId ?? prev?.planId ?? '' } });
  const active = prev && !prev.cancelledAt && prev.endDate >= ref;
  const start = active ? addDays(prev.endDate, 1) : ref;
  const m = await db.membership.create({
    data: {
      memberId: req.params.id as string,
      planId: plan.id,
      startDate: start,
      endDate: addDays(start, plan.durationDays - 1),
      previousId: prev?.id,
      onTime: prev ? Boolean(active) : null,
    },
  });
  res.status(201).json({ ...m, startDate: iso(m.startDate), endDate: iso(m.endDate), plan: plan.name });
});

staff.post('/memberships/:id/cancel', isStaff, async (req, res) => {
  res.json(await db.membership.update({ where: { id: req.params.id as string }, data: { cancelledAt: new Date() } }));
});

staff.post('/members/:id/whatsapp', isStaff, async (req, res) => {
  const n = await db.notice.findFirst({
    where: { memberId: req.params.id as string, waSentAt: null },
    orderBy: { createdAt: 'desc' },
  });
  if (n) await db.notice.update({ where: { id: n.id }, data: { waSentAt: new Date() } });
  res.status(204).end();
});

// Planes: lectura para recepción, escritura solo propietario.
staff.get('/plans', isStaff, async (_req, res) =>
  res.json(await db.plan.findMany({ orderBy: { durationDays: 'asc' } })),
);
const planBody = z.object({
  name: z.string().trim().min(2).max(40),
  durationDays: z.number().int().min(1).max(730),
  price: z.number().min(0).max(99999),
  active: z.boolean().optional(),
});
staff.post('/plans', isOwner, async (req, res) =>
  res.status(201).json(await db.plan.create({ data: planBody.parse(req.body) })),
);
staff.patch('/plans/:id', isOwner, async (req, res) =>
  res.json(await db.plan.update({ where: { id: req.params.id as string }, data: planBody.partial().parse(req.body) })),
);
