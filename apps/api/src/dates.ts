const TZ = process.env.TZ_GYM ?? 'America/Lima';
const DAY = 86_400_000;

/** Fecha del gimnasio (Lima) como medianoche UTC, mismo formato que columnas @db.Date. */
export const today = (now = new Date()) => new Date(now.toLocaleDateString('en-CA', { timeZone: TZ }));
export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
export const daysLeft = (end: Date, ref = today()) => Math.round((end.getTime() - ref.getTime()) / DAY);
export const iso = (d: Date) => d.toISOString().slice(0, 10);

export type Status = 'ACTIVA' | 'POR_VENCER' | 'VENCIDA' | 'BAJA';
export const EXPIRING_DAYS = 7;

export function statusOf(m: { endDate: Date; cancelledAt: Date | null }, ref = today()): Status {
  if (m.cancelledAt) return 'BAJA';
  const d = daysLeft(m.endDate, ref);
  return d < 0 ? 'VENCIDA' : d <= EXPIRING_DAYS ? 'POR_VENCER' : 'ACTIVA';
}

/** Filtro Prisma equivalente a statusOf, para segmentar en BD. */
export function whereStatus(s: Status, ref = today()) {
  const limit = addDays(ref, EXPIRING_DAYS);
  if (s === 'BAJA') return { cancelledAt: { not: null } };
  if (s === 'VENCIDA') return { cancelledAt: null, endDate: { lt: ref } };
  if (s === 'POR_VENCER') return { cancelledAt: null, endDate: { gte: ref, lte: limit } };
  return { cancelledAt: null, endDate: { gt: limit } };
}
