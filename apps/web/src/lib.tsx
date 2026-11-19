import { useQuery } from '@tanstack/react-query';

export type Role = 'OWNER' | 'STAFF' | 'MEMBER';
export type Status = 'ACTIVA' | 'POR_VENCER' | 'VENCIDA' | 'BAJA';
export type Me = { id: string; role: Role; name: string; email: string; memberId?: string };
export type MembershipSummary = {
  id: string;
  plan: string;
  planId: string;
  startDate: string;
  endDate: string;
  status: Status;
  daysLeft: number;
  registeredAt?: string;
  cancelledAt?: string | null;
};
export type MemberRow = {
  id: string;
  fullName: string;
  phone: string;
  email?: string | null;
  attendanceCode?: string | null;
  userId?: string;
  membership?: MembershipSummary;
  nextMembership?: MembershipSummary;
  lastNotice?: { id: string; kind: string; createdAt: string; waSentAt: string | null };
};
export type Plan = {
  id: string;
  name: string;
  category: 'MACHINES' | 'DANCE';
  durationDays: number;
  durationMonths: number | null;
  price: string;
  description: string;
  promotion: string | null;
  highlighted: boolean;
  publicVisible: boolean;
  sortOrder: number;
  active: boolean;
};

async function call(path: string, init?: RequestInit) {
  return fetch('/api/v1' + path, {
    credentials: 'include',
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  });
}

/** fetch con renovación transparente de sesión (access 15 min + refresh 30 días en cookies httpOnly). */
export async function api<T = unknown>(path: string, body?: unknown, method = body ? 'POST' : 'GET'): Promise<T> {
  const init = { method, body: body === undefined ? undefined : JSON.stringify(body) };
  let r = await call(path, init);
  if (r.status === 401 && !path.startsWith('/auth')) {
    if ((await call('/auth/refresh', { method: 'POST' })).ok) r = await call(path, init);
  }
  if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? 'Sin conexión. Intenta de nuevo.');
  return r.status === 204 ? (undefined as T) : r.json();
}

export const useMe = () =>
  useQuery({ queryKey: ['me'], queryFn: () => api<Me>('/auth/me'), retry: false, staleTime: 5 * 60_000 });

const dateValue = (value: string) => new Date(value + (value.length === 10 ? 'T00:00:00Z' : ''));
const dateOptions = { day: '2-digit', month: 'short', year: 'numeric' } as const;

/** Formato único de fechas visibles: 04 nov. 2026. Las fechas sin hora conservan su día calendario. */
export const fmtDate = (value: string) =>
  new Intl.DateTimeFormat('es-PE', {
    ...dateOptions,
    timeZone: value.length === 10 ? 'UTC' : 'America/Lima',
  }).format(dateValue(value));

/** Formato único para eventos con hora: 04 nov. 2026, 01:30 p. m. */
export const fmtDateTime = (value: string) =>
  new Intl.DateTimeFormat('es-PE', {
    ...dateOptions,
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Lima',
  }).format(dateValue(value));

export const fmtTime = (value: string) =>
  new Intl.DateTimeFormat('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Lima',
  }).format(dateValue(value));

export const STATUS_LABEL: Record<Status, string> = {
  ACTIVA: 'Activa',
  POR_VENCER: 'Por vencer',
  VENCIDA: 'Vencida',
  BAJA: 'Baja',
};
export const STATUS_CLASS: Record<Status, string> = {
  ACTIVA: 'bg-ok text-black',
  POR_VENCER: 'bg-orange text-black',
  VENCIDA: 'bg-danger text-black',
  BAJA: 'bg-line text-white',
};

export const daysText = (d: number) =>
  d < 0 ? `venció hace ${-d} d` : d === 0 ? 'vence hoy' : d === 1 ? 'vence mañana' : `vence en ${d} d`;

export function waLink(m: MemberRow) {
  const s = m.membership;
  const first = m.fullName.split(' ')[0];
  const msg = !s
    ? `Hola ${first}, te saluda PowerFit.`
    : s.daysLeft < 0
      ? `Hola ${first}, te saluda PowerFit. Tu plan ${s.plan} venció el ${fmtDate(s.endDate)}. ¡Te esperamos para renovar y volver a entrenar!`
      : `Hola ${first}, te saluda PowerFit. Tu plan ${s.plan} ${daysText(s.daysLeft).replace(' d', ' días')} (${fmtDate(s.endDate)}). Renueva en recepción y sigue entrenando.`;
  return `https://wa.me/51${m.phone}?text=${encodeURIComponent(msg)}`;
}

export function Chevrons({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 150 80" className={className} aria-hidden="true" fill="currentColor">
      {[0, 50, 100].map((x) => (
        <path key={x} d={`M${x} 0h22l28 40-28 40H${x}l28-40z`} />
      ))}
    </svg>
  );
}

export function Logo({
  className = '',
  iso = false,
  label = 'PowerFit',
}: {
  className?: string;
  iso?: boolean;
  label?: string;
}) {
  return <span role="img" aria-label={label} className={`logo block ${iso ? 'isotipo' : ''} ${className}`} />;
}
