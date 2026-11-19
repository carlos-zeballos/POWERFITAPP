import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, daysText, fmtDate, fmtDateTime, STATUS_CLASS, STATUS_LABEL, type MemberRow } from '../lib';
import { MissionTimeline, type Mission } from './MissionTimeline';

type Notice = { id: string; kind: string; title: string; body: string; createdAt: string; readAt: string | null };
type LoyaltyProgress = {
  subscription: { plan: string; startsOn: string; endsOn: string };
  missions: Mission[];
};

function useOnline() {
  const [on, set] = useState(navigator.onLine);
  useEffect(() => {
    const a = () => set(true),
      b = () => set(false);
    addEventListener('online', a);
    addEventListener('offline', b);
    return () => (removeEventListener('online', a), removeEventListener('offline', b));
  }, []);
  return on;
}

function Offline({ at }: { at: number }) {
  return (
    <p role="status" className="mb-4 border border-orange px-3 py-2 text-sm">
      Sin conexión. Mostrando datos guardados {at ? `del ${fmtDateTime(new Date(at).toISOString())}` : ''}.
    </p>
  );
}

export function Socio() {
  const online = useOnline();
  const q = useQuery({
    queryKey: ['me-membership'],
    queryFn: () =>
      api<{
        fullName: string;
        membership?: MemberRow['membership'];
        nextMembership?: MemberRow['membership'];
        memberships: { id: string; plan: string; startDate: string; endDate: string; registeredAt: string }[];
      }>('/me'),
  });
  const missions = useQuery({
    queryKey: ['loyalty-me'],
    queryFn: () => api<LoyaltyProgress>('/loyalty/me'),
    enabled: Boolean(q.data?.membership),
  });
  if (q.isPending) return <p aria-busy="true">Cargando…</p>;
  if (q.isError)
    return (
      <p role="alert">
        {online
          ? q.error.message
          : 'Sin conexión y sin datos guardados. Conéctate una vez para ver tu membresía sin internet.'}
      </p>
    );
  const m = q.data.membership;
  const total = m ? Math.max(1, (Date.parse(m.endDate) - Date.parse(m.startDate)) / 864e5 + 1) : 1;
  const pctLeft = m ? Math.min(100, Math.max(0, ((m.daysLeft + 1) / total) * 100)) : 0;
  return (
    <>
      {!online && <Offline at={q.dataUpdatedAt} />}
      <h1 className="display text-5xl">Hola, {q.data.fullName.split(' ')[0]}</h1>
      {!m ? (
        <p className="mt-6">Aún no tienes una membresía registrada. Acércate a recepción.</p>
      ) : (
        <section aria-label="Estado de tu membresía" className="mt-6 border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line p-4">
            <span className="text-sm text-muted">Plan {m.plan}</span>
            <span className={`chip ${STATUS_CLASS[m.status]}`}>{STATUS_LABEL[m.status]}</span>
          </div>
          <div className="p-6">
            <p
              className={`display text-[7rem] leading-none ${m.daysLeft < 0 ? 'text-danger' : m.daysLeft <= 7 ? 'text-orange' : 'text-white'}`}
            >
              {Math.max(0, m.daysLeft)}
            </p>
            <p className="text-lg">
              {m.daysLeft < 0 ? `Tu plan venció el ${fmtDate(m.endDate)}` : `días restantes · ${daysText(m.daysLeft)}`}
            </p>
            <div
              className="mt-5 h-2 bg-line"
              role="progressbar"
              aria-label="Tiempo restante"
              aria-valuenow={Math.round(pctLeft)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="h-full bg-orange" style={{ width: `${pctLeft}%` }} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-muted">Inicio</dt>
                <dd>{fmtDate(m.startDate)}</dd>
              </div>
              <div>
                <dt className="text-muted">Vencimiento</dt>
                <dd>{fmtDate(m.endDate)}</dd>
              </div>
            </dl>
          </div>
          {m.daysLeft <= 7 && (
            <p className="bg-orange p-4 font-semibold text-black">Renueva en recepción y no pierdas el ritmo.</p>
          )}
        </section>
      )}
      {missions.data && (
        <MissionTimeline
          missions={missions.data.missions}
          plan={missions.data.subscription.plan}
          startsOn={missions.data.subscription.startsOn}
          endsOn={missions.data.subscription.endsOn}
        />
      )}
      {missions.isError && m && <p className="mt-4 text-sm text-danger">No pudimos cargar tus misiones.</p>}
      <section className="mt-6 border border-line p-5" aria-label="Mi suscripción e historial">
        <h2 className="display text-3xl">Mi suscripción</h2>
        {m && (
          <p className="mt-2">
            {m.plan} · vigente hasta {fmtDate(m.endDate)}
          </p>
        )}
        {q.data.nextMembership && (
          <p className="mt-2 text-orange">
            Próximo período pagado: {q.data.nextMembership.plan} · inicia {fmtDate(q.data.nextMembership.startDate)}
          </p>
        )}
        <h3 className="mt-5 font-semibold">Historial de pagos y vigencias</h3>
        <ol className="mt-2 divide-y divide-line border-y border-line text-sm">
          {q.data.memberships.map((entry) => (
            <li key={entry.id} className="py-3">
              <strong>{entry.plan}</strong>
              <span className="block text-muted">
                Registrado: {fmtDate(entry.registeredAt)} · Vigencia: {fmtDate(entry.startDate)} a{' '}
                {fmtDate(entry.endDate)}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

export function Avisos() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['me-notices'], queryFn: () => api<Notice[]>('/me/notices') });
  const read = useMutation({
    mutationFn: (id: string) => api(`/me/notices/${id}/read`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me-notices'] }),
  });
  return (
    <>
      <h1 className="display text-5xl">Avisos</h1>
      {q.isPending && <p aria-busy="true">Cargando…</p>}
      {q.data?.length === 0 && <p className="mt-6 text-muted">No tienes avisos todavía.</p>}
      <ul className="mt-6 divide-y divide-line border-y border-line">
        {q.data?.map((n) => (
          <li key={n.id}>
            <button
              className="tap flex w-full gap-3 py-4 text-left"
              onClick={() => !n.readAt && read.mutate(n.id)}
              aria-label={`${n.title}${n.readAt ? '' : ', no leído'}`}
            >
              <span
                aria-hidden="true"
                className={`mt-2 size-2 shrink-0 rounded-full ${n.readAt ? 'bg-transparent' : 'bg-orange'}`}
              />
              <span>
                <span className="block font-semibold">{n.title}</span>
                <span className="block text-sm text-muted">{n.body}</span>
                <span className="mt-1 block text-xs text-muted">{fmtDate(n.createdAt)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
