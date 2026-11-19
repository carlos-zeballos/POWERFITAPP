import { NoticeKind } from '@prisma/client';
import { db } from './db.js';
import { addDays, daysLeft, iso, today } from './dates.js';

export function kindFor(days: number): NoticeKind | null {
  if (days < 0) return 'EXPIRED';
  if (days === 0) return 'D0';
  if (days <= 3) return 'D3';
  if (days <= 7) return 'D7';
  return null;
}

export function noticeText(kind: NoticeKind, name: string, end: Date, plan: string) {
  const first = name.split(' ')[0];
  const date = end.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const title = {
    D7: 'Tu membresía vence en 7 días',
    D3: 'Quedan 3 días de tu membresía',
    D0: 'Tu membresía vence hoy',
    EXPIRED: 'Tu membresía venció',
    BROADCAST: '',
  }[kind];
  const body =
    kind === 'EXPIRED'
      ? `Hola ${first}, tu plan ${plan} venció el ${date}. Vuelve a entrenar: renueva en recepción.`
      : `Hola ${first}, tu plan ${plan} vence el ${date}. Renueva en recepción y no pierdas el ritmo.`;
  return { title, body };
}

/**
 * Motor de alertas. Idempotente: (membershipId, kind) es único, así que correrlo dos veces el mismo día
 * no duplica avisos, y si un día no corrió, el siguiente recupera el aviso del umbral alcanzado.
 */
export async function runAlerts(ref = today()) {
  const run = await db.jobRun.upsert({
    where: { name_runDate: { name: 'alerts', runDate: ref } },
    create: { name: 'alerts', runDate: ref },
    update: {},
  });
  // Solo la membresía vigente de cada socio (sin renovación posterior) y vencidas hace ≤30 días.
  const ms = await db.membership.findMany({
    where: { cancelledAt: null, next: null, endDate: { gte: addDays(ref, -30), lte: addDays(ref, 7) } },
    include: { member: true, plan: true, notices: { select: { kind: true } } },
  });
  let created = 0;
  for (const m of ms) {
    const kind = kindFor(daysLeft(m.endDate, ref));
    if (!kind || m.notices.some((n) => n.kind === kind)) continue;
    const text = noticeText(kind, m.member.fullName, m.endDate, m.plan.name);
    const n = await db.notice
      .create({ data: { memberId: m.memberId, membershipId: m.id, kind, ...text } })
      .catch(() => null);
    if (!n) continue; // carrera con otra ejecución: el índice único ya lo tiene
    created++;
  }
  const result = { date: iso(ref), scanned: ms.length, created };
  await db.jobRun.update({ where: { id: run.id }, data: { finishedAt: new Date(), result } });
  console.log('[alerts]', JSON.stringify(result));
  return result;
}
