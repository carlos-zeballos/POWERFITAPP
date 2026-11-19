import { useDeferredValue, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  api,
  daysText,
  fmtDate,
  STATUS_CLASS,
  STATUS_LABEL,
  waLink,
  type MemberRow,
  type Plan,
  type Status,
} from '../lib';

const usePlans = () => useQuery({ queryKey: ['plans'], queryFn: () => api<Plan[]>('/plans'), staleTime: 5 * 60_000 });

/** Renovación en 2 toques: "Renovar" → "Confirmar". Sin cobro: solo registra el hecho. */
function Renew({ m, onRenewed }: { m: MemberRow; onRenewed?: (message: string) => void }) {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const r = useMutation({
    mutationFn: () => api<{ endDate: string; plan: string }>(`/members/${m.id}/renew`, { fromId: m.membership?.id }),
    onSuccess: (data) => {
      onRenewed?.(`Renovado hasta ${fmtDate(data.endDate)}`);
      qc.invalidateQueries({ queryKey: ['members'] });
    },
  });
  if (r.isSuccess && !onRenewed)
    return (
      <p role="status" className="tap flex items-center font-semibold text-ok">
        ✓ Renovado hasta {fmtDate(r.data.endDate)}
      </p>
    );
  if (!confirm)
    return (
      <button className="btn-primary flex-1" onClick={() => setConfirm(true)} disabled={!m.membership}>
        Renovar
      </button>
    );
  return (
    <span className="flex flex-1 gap-2">
      <button className="btn-primary flex-1" onClick={() => r.mutate()} disabled={r.isPending} autoFocus>
        {r.isPending ? 'Guardando…' : `Confirmar ${m.membership?.plan}`}
      </button>
      <button className="btn-ghost" onClick={() => setConfirm(false)} aria-label="Cancelar renovación">
        ✕
      </button>
      {r.isError && (
        <span role="alert" className="sr-only">
          {r.error.message}
        </span>
      )}
    </span>
  );
}

function MemberCard({
  m,
  onRenewed,
  onOpen,
}: {
  m: MemberRow;
  onRenewed?: (message: string) => void;
  onOpen?: (id: string) => void;
}) {
  const qc = useQueryClient();
  const s = m.membership;
  const sent = m.lastNotice?.waSentAt;
  return (
    <li className="border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{m.fullName}</p>
          <p className="text-sm text-muted">
            {s
              ? `${s.plan} · ${daysText(s.daysLeft)} · ${fmtDate(s.endDate)}`
              : m.nextMembership
                ? `Próximo plan: ${m.nextMembership.plan} · inicia ${fmtDate(m.nextMembership.startDate)}`
                : 'Sin membresía vigente'}
          </p>
        </div>
        {s && <span className={`chip shrink-0 ${STATUS_CLASS[s.status]}`}>{STATUS_LABEL[s.status]}</span>}
      </div>
      <div className="mt-3 flex gap-2">
        <Renew m={m} onRenewed={onRenewed} />
        <a
          href={waLink(m)}
          target="_blank"
          rel="noopener"
          onClick={() =>
            api(`/members/${m.id}/whatsapp`, {}).then(() => qc.invalidateQueries({ queryKey: ['members'] }))
          }
          className={`btn-ghost ${sent ? 'text-muted' : ''}`}
          aria-label={`Enviar WhatsApp a ${m.fullName}${sent ? ' (ya enviado)' : ''}`}
        >
          WhatsApp{sent ? ' ✓' : ''}
        </a>
        {onOpen && (
          <button className="btn-ghost" onClick={() => onOpen(m.id)}>
            Historial
          </button>
        )}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line pt-3 text-sm">
        <div>
          <dt className="text-muted">Celular</dt>
          <dd>{m.phone}</dd>
        </div>
        <div>
          <dt className="text-muted">Código de asistencia</dt>
          <dd className="font-semibold tracking-[0.12em] text-orange">{m.attendanceCode ?? 'Sin asignar'}</dd>
        </div>
        {m.email && (
          <div className="col-span-2">
            <dt className="text-muted">Correo</dt>
            <dd className="break-all">{m.email}</dd>
          </div>
        )}
        {s && (
          <>
            <div>
              <dt className="text-muted">Inicio</dt>
              <dd>{fmtDate(s.startDate)}</dd>
            </div>
            <div>
              <dt className="text-muted">Vencimiento</dt>
              <dd>{fmtDate(s.endDate)}</dd>
            </div>
          </>
        )}
      </dl>
    </li>
  );
}

type MemberDetail = {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  attendanceCode: string | null;
  currentMembership?: MemberRow['membership'];
  nextMembership?: MemberRow['membership'];
  memberships: (NonNullable<MemberRow['membership']> & { missions: Mission[] })[];
};

type Mission = {
  level: number;
  title: string;
  description: string;
  progress: number;
  target: number;
  deadline: string;
  state: 'UNLOCKED' | 'IN_PROGRESS' | 'LOCKED' | 'MISSED';
};

function MissionTrack({ missions }: { missions: Mission[] }) {
  if (!missions.length)
    return <p className="mt-2 text-sm text-muted">Este plan diario registra asistencia, sin premios.</p>;
  return (
    <ol className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Progreso de misiones">
      {missions.map((mission) => {
        const state =
          mission.state === 'UNLOCKED'
            ? 'border-orange bg-orange text-black'
            : mission.state === 'LOCKED'
              ? 'border-line text-muted'
              : mission.state === 'MISSED'
                ? 'border-danger text-danger'
                : 'border-orange text-orange';
        return (
          <li key={mission.level} className={`min-w-40 border-l-2 px-3 py-2 ${state}`}>
            <p className="font-semibold">Nivel {mission.level}</p>
            <p className="text-xs">
              {mission.progress}/{mission.target} asistencias
            </p>
            <p className="mt-1 text-xs opacity-80">{mission.title}</p>
            {mission.state === 'UNLOCKED' && <p className="mt-1 text-xs font-semibold">Premio disponible</p>}
            {mission.state === 'LOCKED' && <p className="mt-1 text-xs">Bloqueada</p>}
          </li>
        );
      })}
    </ol>
  );
}

function MemberHistory({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useQuery({ queryKey: ['member', id], queryFn: () => api<MemberDetail>(`/members/${id}`) });
  return (
    <section className="mt-6 border border-orange bg-surface p-5" aria-label="Historial del socio">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="display text-4xl">{q.data?.fullName ?? 'Cargando…'}</h2>
          {q.data && (
            <p className="mt-1 text-sm text-muted">
              {q.data.phone}
              {q.data.email ? ` · ${q.data.email}` : ''}
            </p>
          )}
        </div>
        <button className="btn-ghost" onClick={onClose}>
          Cerrar
        </button>
      </div>
      {q.isError && (
        <p role="alert" className="mt-3 text-danger">
          {q.error.message}
        </p>
      )}
      {q.data && (
        <>
          <p className="mt-4 text-sm">
            Código de asistencia:{' '}
            <strong className="tracking-[0.14em] text-orange">{q.data.attendanceCode ?? 'Sin asignar'}</strong>
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div className="border border-line p-3">
              <p className="text-sm text-muted">Cobertura vigente hoy</p>
              {q.data.currentMembership ? (
                <p className="mt-1 font-semibold">
                  {q.data.currentMembership.plan} · hasta {fmtDate(q.data.currentMembership.endDate)}
                </p>
              ) : (
                <p className="mt-1">No tiene cobertura vigente hoy.</p>
              )}
            </div>
            <div className="border border-line p-3">
              <p className="text-sm text-muted">Próximo período pagado</p>
              {q.data.nextMembership ? (
                <p className="mt-1 font-semibold">
                  {q.data.nextMembership.plan} · {fmtDate(q.data.nextMembership.startDate)} a{' '}
                  {fmtDate(q.data.nextMembership.endDate)}
                </p>
              ) : (
                <p className="mt-1">No hay un período futuro registrado.</p>
              )}
            </div>
          </div>
          <h3 className="display mt-6 text-3xl">Historial de renovaciones</h3>
          <ol className="mt-3 divide-y divide-line border-y border-line">
            {q.data.memberships.map((m) => (
              <li key={m.id} className="py-3">
                <p className="font-semibold">{m.plan}</p>
                <p className="text-sm text-muted">
                  Vigencia: {fmtDate(m.startDate)} a {fmtDate(m.endDate)}
                </p>
                {m.registeredAt && <p className="text-xs text-muted">Registrado el {fmtDate(m.registeredAt)}</p>}
                <MissionTrack missions={m.missions} />
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}

const GROUPS: [string, (d: number) => boolean][] = [
  ['Vencen hoy', (d) => d === 0],
  ['En 1 a 3 días', (d) => d > 0 && d <= 3],
  ['En 4 a 7 días', (d) => d > 3 && d <= 7],
  ['Vencidas (últimos 30 días)', (d) => d < 0 && d >= -30],
];

export function Recepcion() {
  const [renewalMessage, setRenewalMessage] = useState('');
  const q = useQuery({
    queryKey: ['members', 'alerts'],
    queryFn: () => api<MemberRow[]>('/members?status=POR_VENCER,VENCIDA'),
  });
  // shortcut: muestra 60 alertas; agregar paginación si el seguimiento requiere más.
  const alerts = (q.data ?? []).slice(0, 60);
  return (
    <>
      <h1 className="display text-5xl">Alertas de hoy</h1>
      <p className="mt-1 text-muted">Renueva con 2 toques o avisa por WhatsApp con 1.</p>
      {renewalMessage && (
        <p role="status" className="mt-3 font-semibold text-ok">
          {renewalMessage}
        </p>
      )}
      {q.isPending && <p aria-busy="true">Cargando…</p>}
      {q.isError && <p role="alert">{q.error.message}</p>}
      {GROUPS.map(([title, f]) => {
        const list = alerts
          .filter((m) => m.membership && f(m.membership.daysLeft))
          .sort((a, b) => a.membership!.daysLeft - b.membership!.daysLeft);
        return (
          <section key={title} className="mt-8" aria-label={title}>
            <h2 className="mb-3 flex items-baseline justify-between border-b border-orange pb-1">
              <span className="display text-3xl">{title}</span>
              <span className="text-sm text-muted">{list.length}</span>
            </h2>
            {list.length === 0 ? (
              <p className="text-sm text-muted">Nadie en este grupo.</p>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {list.map((m) => (
                  <MemberCard key={m.id} m={m} onRenewed={setRenewalMessage} />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </>
  );
}

function NewMember({ onDone }: { onDone: () => void }) {
  const plans = usePlans();
  const qc = useQueryClient();
  const c = useMutation({
    mutationFn: (b: object) => api('/members', b),
    onSuccess: () => (qc.invalidateQueries({ queryKey: ['members'] }), onDone()),
  });
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    c.mutate({ ...f, consent: f.consent === 'on' });
  }
  return (
    <form
      onSubmit={submit}
      className="mt-4 grid gap-3 border border-orange p-4 md:grid-cols-2"
      aria-label="Nuevo socio"
    >
      <label>
        <span className="mb-1 block text-sm">Nombre completo</span>
        <input name="fullName" required minLength={3} maxLength={80} className="field" />
      </label>
      <label>
        <span className="mb-1 block text-sm">Celular (9 dígitos)</span>
        <input name="phone" required inputMode="numeric" pattern="9[0-9]{8}" className="field" />
      </label>
      <label>
        <span className="mb-1 block text-sm">Correo (opcional)</span>
        <input name="email" type="email" className="field" />
      </label>
      <label>
        <span className="mb-1 block text-sm">Plan</span>
        <select name="planId" required className="field">
          {plans.data
            ?.filter((p) => p.active)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ·{' '}
                {p.durationMonths
                  ? `${p.durationMonths} ${p.durationMonths === 1 ? 'mes' : 'meses'}`
                  : `${p.durationDays} días`}
              </option>
            ))}
        </select>
      </label>
      <label className="flex items-start gap-3 text-sm md:col-span-2">
        <input type="checkbox" name="consent" required className="tap accent-orange" />
        <span>
          El socio acepta la política de privacidad y autoriza el tratamiento de sus datos para gestionar su membresía,
          recibir avisos y usar su código de asistencia, rachas y puntos de fidelización (Ley 29733).{' '}
          <a href="/app/privacidad" target="_blank" className="underline">
            Ver aviso
          </a>
        </span>
      </label>
      {c.isError && (
        <p role="alert" className="text-danger md:col-span-2">
          {c.error.message}
        </p>
      )}
      <button className="btn-primary md:col-span-2" disabled={c.isPending}>
        Registrar socio
      </button>
    </form>
  );
}

const FILTERS: (Status | '')[] = ['', 'ACTIVA', 'POR_VENCER', 'VENCIDA', 'BAJA'];

export function Socios() {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<Status | ''>('');
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const qtext = useDeferredValue(text.trim());
  const q = useQuery({
    queryKey: ['members', qtext, status],
    queryFn: () =>
      api<MemberRow[]>(`/members?${new URLSearchParams({ ...(qtext && { q: qtext }), ...(status && { status }) })}`),
    placeholderData: (p) => p,
  });
  return (
    <>
      <div className="flex items-end justify-between gap-3">
        <h1 className="display text-5xl">Socios</h1>
        <button className="btn-primary" onClick={() => setAdding((a) => !a)} aria-expanded={adding}>
          {adding ? 'Cerrar' : '+ Nuevo'}
        </button>
      </div>
      {adding && <NewMember onDone={() => setAdding(false)} />}
      <label className="mt-6 block">
        <span className="sr-only">Buscar por nombre, celular o código de asistencia</span>
        <input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Buscar por nombre, celular o código de 4 dígitos"
          className="field"
        />
      </label>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filtrar por estado">
        {FILTERS.map((f) => (
          <button
            key={f}
            aria-pressed={status === f}
            onClick={() => setStatus(f)}
            className={`tap shrink-0 border px-3 text-sm ${status === f ? 'border-orange bg-orange text-black' : 'border-line'}`}
          >
            {f ? STATUS_LABEL[f] : 'Todos'}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-muted" aria-live="polite">
        {q.data ? `${q.data.length} socios` : 'Cargando…'}
      </p>
      {selected && <MemberHistory id={selected} onClose={() => setSelected(null)} />}
      {/* shortcut: muestra 60 resultados; usar paginación si la búsqueda no basta. */}
      <ul className="mt-3 grid gap-3 md:grid-cols-2">
        {q.data?.slice(0, 60).map((m) => (
          <MemberCard key={m.id} m={m} onOpen={setSelected} />
        ))}
      </ul>
    </>
  );
}

export { usePlans };
