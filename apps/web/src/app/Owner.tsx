import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, fmtDate, STATUS_LABEL, type Status } from '../lib';
import { usePlans } from './Recepcion';

type Kpis = {
  period: { from: string; to: string };
  baseline: Record<string, number>;
  current: Record<string, number | null>;
  samples: { vencidasEnPeriodo: number; sociosBase: number };
};

const KPI: { key: string; label: string; unit: string; better: 'up' | 'down'; goal?: number }[] = [
  { key: 'renovacionOportuna', label: 'Renovación oportuna', unit: '%', better: 'up' },
  { key: 'tasaBaja', label: 'Tasa de baja mensual', unit: '%', better: 'down' },
  { key: 'avisosOportunos', label: 'Avisos oportunos', unit: '%', better: 'up' },
  { key: 'horasControlManual', label: 'Horas de control manual / semana', unit: 'h', better: 'down' },
  { key: 'tiempoRespuestaP95ms', label: 'Tiempo de respuesta (p95)', unit: 'ms', better: 'down', goal: 2000 },
];

function Tile({ k, base, cur }: { k: (typeof KPI)[number]; base?: number; cur: number | null }) {
  const ref = base ?? k.goal;
  const good = cur != null && ref != null && (k.better === 'up' ? cur >= ref : cur <= ref);
  const delta = cur != null && base != null ? Math.round((cur - base) * 10) / 10 : null;
  return (
    <li className="flex flex-col border border-line bg-surface p-5">
      <h2 className="text-sm text-muted">{k.label}</h2>
      <p className={`display mt-2 text-6xl ${cur == null ? 'text-muted' : good ? 'text-ok' : 'text-orange'}`}>
        {cur ?? '—'}
        <span className="ml-1 text-2xl">{cur != null && k.unit}</span>
      </p>
      <p className="mt-auto pt-3 text-sm">
        {base != null ? (
          <>
            Línea base {base}
            {k.unit}
            {delta != null && (
              <span className={`ml-2 font-semibold ${good ? 'text-ok' : 'text-danger'}`}>
                {delta > 0 ? '▲' : delta < 0 ? '▼' : '='} {Math.abs(delta)}
              </span>
            )}
          </>
        ) : (
          k.goal && `Meta ≤ ${k.goal} ${k.unit}`
        )}
      </p>
    </li>
  );
}

export function Panel() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['kpis'], queryFn: () => api<Kpis>('/kpis') });
  const hours = useMutation({
    mutationFn: (b: object) => api('/manual-hours', b),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kpis'] }),
  });
  const run = useMutation({
    mutationFn: (date?: string) => api<{ created: number; date: string }>('/jobs/alerts', date ? { date } : {}),
  });
  const [simDate, setSimDate] = useState('');
  function saveHours(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    hours.mutate({ weekStart: f.get('weekStart'), hours: Number(f.get('hours')) });
  }
  return (
    <>
      <h1 className="display text-5xl">Panel</h1>
      {q.data && (
        <p className="mt-1 text-muted">
          Últimos 30 días · {fmtDate(q.data.period.from)} – {fmtDate(q.data.period.to)} ·{' '}
          {q.data.samples.vencidasEnPeriodo} vencimientos
        </p>
      )}
      {q.isError && <p role="alert">{q.error.message}</p>}
      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {KPI.map((k) => (
          <Tile key={k.key} k={k} base={q.data?.baseline[k.key]} cur={q.data?.current[k.key] ?? null} />
        ))}
      </ul>

      <section className="mt-10" aria-labelledby="rep">
        <h2 id="rep" className="display mb-3 text-3xl">
          Reportes CSV
        </h2>
        <div className="flex flex-wrap gap-2">
          {[
            ['members', 'Socios'],
            ['notices', 'Avisos'],
            ['kpis', 'Indicadores'],
          ].map(([f, t]) => (
            <a key={f} className="btn-ghost" href={`/api/v1/reports/${f}.csv`} download>
              ↓ {t}
            </a>
          ))}
        </div>
      </section>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <form onSubmit={saveHours} className="border border-line p-4" aria-labelledby="hrs">
          <h2 id="hrs" className="display mb-3 text-3xl">
            Horas de control manual
          </h2>
          <div className="flex gap-2">
            <label className="flex-1">
              <span className="mb-1 block text-sm">Semana del</span>
              <input name="weekStart" type="date" required className="field" />
            </label>
            <label className="w-24">
              <span className="mb-1 block text-sm">Horas</span>
              <input name="hours" type="number" min="0" max="168" step="0.5" required className="field" />
            </label>
          </div>
          <button className="btn-ghost mt-3 w-full" disabled={hours.isPending}>
            Registrar
          </button>
          {hours.isSuccess && (
            <p role="status" className="mt-2 text-sm text-ok">
              Guardado.
            </p>
          )}
        </form>
        <div className="border border-line p-4">
          <h2 className="display mb-3 text-3xl">Motor de alertas</h2>
          <p className="text-sm text-muted">
            Corre solo cada día a las 08:00. Puedes ejecutarlo ahora; la fecha simulada sirve para demostraciones (no en
            producción).
          </p>
          <label className="mt-3 block">
            <span className="mb-1 block text-sm">Fecha simulada (opcional)</span>
            <input type="date" value={simDate} onChange={(e) => setSimDate(e.target.value)} className="field" />
          </label>
          <button
            className="btn-primary mt-3 w-full"
            onClick={() => run.mutate(simDate || undefined)}
            disabled={run.isPending}
          >
            Ejecutar ahora
          </button>
          {run.data && (
            <p role="status" className="mt-2 text-sm">
              {run.data.date}: {run.data.created} avisos nuevos en la bandeja de los socios.
            </p>
          )}
          {run.isError && <p role="alert">{run.error.message}</p>}
        </div>
      </div>
    </>
  );
}

export function Comunicados() {
  const qc = useQueryClient();
  const plans = usePlans();
  const list = useQuery({
    queryKey: ['broadcasts'],
    queryFn: () => api<{ id: string; title: string; sentCount: number; createdAt: string }[]>('/broadcasts'),
  });
  const send = useMutation({
    mutationFn: (b: object) => api<{ sentCount: number }>('/broadcasts', b),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['broadcasts'] }),
  });
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    send.mutate(
      { title: f.title, body: f.body, status: f.status || undefined, planId: f.planId || undefined },
      { onSuccess: () => (e.target as HTMLFormElement).reset() },
    );
  }
  return (
    <>
      <h1 className="display text-5xl">Comunicados</h1>
      <form onSubmit={submit} className="mt-6 grid gap-3 md:grid-cols-2">
        <label className="md:col-span-2">
          <span className="mb-1 block text-sm">Título</span>
          <input name="title" required minLength={3} maxLength={80} className="field" />
        </label>
        <label className="md:col-span-2">
          <span className="mb-1 block text-sm">Mensaje</span>
          <textarea name="body" required minLength={3} maxLength={500} rows={4} className="field py-2" />
        </label>
        <label>
          <span className="mb-1 block text-sm">Estado de membresía</span>
          <select name="status" className="field">
            <option value="">Todos</option>
            {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-sm">Plan</span>
          <select name="planId" className="field">
            <option value="">Todos</option>
            {plans.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <button className="btn-primary md:col-span-2" disabled={send.isPending}>
          Enviar a la bandeja de socios
        </button>
        {send.data && (
          <p role="status" className="text-ok md:col-span-2">
            Enviado a {send.data.sentCount} socios.
          </p>
        )}
        {send.isError && <p role="alert">{send.error.message}</p>}
      </form>
      <h2 className="display mt-10 mb-3 text-3xl">Historial</h2>
      <ul className="divide-y divide-line border-y border-line">
        {list.data?.map((b) => (
          <li key={b.id} className="flex justify-between gap-3 py-3">
            <span>{b.title}</span>
            <span className="shrink-0 text-sm text-muted">
              {b.sentCount} · {fmtDate(b.createdAt)}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

type MissionState = 'UNLOCKED' | 'IN_PROGRESS' | 'LOCKED' | 'MISSED';
type MissionRow = {
  memberId: string;
  member: string;
  attendanceCode: string | null;
  planId: string;
  plan: string;
  endsOn: string;
  missions: {
    level: number;
    title: string;
    description: string;
    progress: number;
    target: number;
    deadline: string;
    state: MissionState;
  }[];
};
type MissionControl = {
  summary: { members: number; availableRewards: number; inProgress: number; locked: number; missed: number };
  members: MissionRow[];
};
const MISSION_LABEL: Record<MissionState, string> = {
  UNLOCKED: 'Premio disponible',
  IN_PROGRESS: 'En progreso',
  LOCKED: 'Bloqueada',
  MISSED: 'Vencida',
};
const MISSION_CLASS: Record<MissionState, string> = {
  UNLOCKED: 'bg-orange text-black',
  IN_PROGRESS: 'border-orange text-orange',
  LOCKED: 'border-line text-muted',
  MISSED: 'border-danger text-danger',
};

/** Vista de control: el propietario consulta el avance derivado de asistencias, no puede alterarlo manualmente. */
export function Misiones() {
  const [planId, setPlanId] = useState('');
  const [state, setState] = useState<MissionState | ''>('');
  const plans = usePlans();
  const filters = new URLSearchParams({ ...(planId && { planId }), ...(state && { state }) });
  const q = useQuery({
    queryKey: ['mission-control', planId, state],
    queryFn: () => api<MissionControl>(`/loyalty/missions?${filters}`),
  });
  const totals = q.data?.summary;
  return (
    <>
      <h1 className="display text-5xl">Control de misiones</h1>
      <p className="mt-1 max-w-2xl text-muted">
        El avance sale únicamente de asistencias válidas registradas por recepción. Los niveles se desbloquean en orden;
        esta vista permite identificar premios disponibles y socios que requieren seguimiento.
      </p>
      <ul className="mt-6 grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-5" aria-label="Resumen de misiones">
        {[
          ['Socios con misión', totals?.members ?? 0, 'text-white'],
          ['Premios disponibles', totals?.availableRewards ?? 0, 'text-orange'],
          ['En progreso', totals?.inProgress ?? 0, 'text-white'],
          ['Bloqueadas', totals?.locked ?? 0, 'text-muted'],
          ['Vencidas', totals?.missed ?? 0, 'text-danger'],
        ].map(([label, value, color]) => (
          <li key={label as string} className="bg-surface p-4">
            <p className="text-xs text-muted">{label}</p>
            <p className={`display mt-2 text-5xl ${color}`}>{value}</p>
          </li>
        ))}
      </ul>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <label>
          <span className="mb-1 block text-sm">Plan</span>
          <select className="field" value={planId} onChange={(event) => setPlanId(event.target.value)}>
            <option value="">Todos los planes con misiones</option>
            {plans.data
              ?.filter((plan) => plan.durationMonths)
              .map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-sm">Estado</span>
          <select
            className="field"
            value={state}
            onChange={(event) => setState(event.target.value as MissionState | '')}
          >
            <option value="">Todos los estados</option>
            {(Object.keys(MISSION_LABEL) as MissionState[]).map((item) => (
              <option key={item} value={item}>
                {MISSION_LABEL[item]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {q.isPending && (
        <p className="mt-6" aria-busy="true">
          Cargando misiones…
        </p>
      )}
      {q.isError && (
        <p role="alert" className="mt-6 text-danger">
          {q.error.message}
        </p>
      )}
      <ul className="mt-6 space-y-4">
        {q.data?.members.map((member) => (
          <li key={member.memberId} className="border border-line bg-surface p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="font-semibold">{member.member}</h2>
                <p className="text-sm text-muted">
                  {member.plan} · vence {fmtDate(member.endsOn)} · código {member.attendanceCode ?? '—'}
                </p>
              </div>
              <span className="text-sm text-muted">Busca su código en Socios para abrir la ficha completa.</span>
            </div>
            <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {member.missions.map((mission) => (
                <li key={mission.level} className={`border p-3 ${MISSION_CLASS[mission.state]}`}>
                  <p className="font-semibold">
                    Nivel {mission.level} · {MISSION_LABEL[mission.state]}
                  </p>
                  <p className="mt-1 text-sm">
                    {mission.progress}/{mission.target} asistencias
                  </p>
                  <p className="mt-2 text-xs opacity-80">{mission.title}</p>
                  <p className="mt-1 text-xs opacity-80">Hasta {fmtDate(mission.deadline)}</p>
                  {mission.state === 'UNLOCKED' && <p className="mt-3 text-sm font-semibold">Reclama tu premio</p>}
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ul>
      {q.data && !q.data.members.length && (
        <p className="mt-6 text-muted">No hay socios que coincidan con este filtro.</p>
      )}
    </>
  );
}

type OpeningHour = { id: string; days: string; hours: string; sortOrder: number };

function BusinessHours() {
  const qc = useQueryClient();
  const hours = useQuery({ queryKey: ['business-hours'], queryFn: () => api<OpeningHour[]>('/business-hours') });
  const save = useMutation({
    mutationFn: (rows: Omit<OpeningHour, 'id'>[]) => api<OpeningHour[]>('/business-hours', rows, 'PUT'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['business-hours'] });
      qc.invalidateQueries({ queryKey: ['public-catalog'] });
    },
  });
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const rows = (hours.data ?? []).map((h, i) => ({
      days: String(f.get(`days-${i}`) ?? ''),
      hours: String(f.get(`hours-${i}`) ?? ''),
      sortOrder: h.sortOrder,
    }));
    save.mutate(rows);
  }
  return (
    <section className="mt-10 border border-line p-5" aria-labelledby="business-hours-title">
      <h2 id="business-hours-title" className="display text-3xl">
        Horarios de atención
      </h2>
      <p className="mt-1 text-sm text-muted">Estos horarios se muestran directamente en la web pública.</p>
      <form onSubmit={submit} className="mt-4 space-y-3">
        {hours.data?.map((h, i) => (
          <div key={h.id} className="grid gap-2 sm:grid-cols-2">
            <label>
              <span className="mb-1 block text-sm">Días</span>
              <input name={`days-${i}`} defaultValue={h.days} required maxLength={60} className="field" />
            </label>
            <label>
              <span className="mb-1 block text-sm">Horario</span>
              <input name={`hours-${i}`} defaultValue={h.hours} required maxLength={80} className="field" />
            </label>
          </div>
        ))}
        <button className="btn-primary" disabled={save.isPending || !hours.data?.length}>
          Guardar horarios
        </button>
        {save.isSuccess && (
          <p role="status" className="text-sm text-ok">
            Horarios actualizados en la web pública.
          </p>
        )}
        {save.isError && (
          <p role="alert" className="text-sm text-danger">
            {save.error.message}
          </p>
        )}
      </form>
    </section>
  );
}

export function Planes() {
  const qc = useQueryClient();
  const plans = usePlans();
  const save = useMutation({
    mutationFn: ({ id, ...b }: { id?: string; [k: string]: unknown }) =>
      api(id ? `/plans/${id}` : '/plans', b, id ? 'PATCH' : 'POST'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plans'] });
      qc.invalidateQueries({ queryKey: ['public-catalog'] });
    },
  });
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    save.mutate(
      {
        name: f.get('name'),
        category: f.get('category'),
        durationDays: Number(f.get('days')),
        durationMonths: f.get('months') ? Number(f.get('months')) : null,
        price: Number(f.get('price')),
        description: f.get('description'),
        promotion: f.get('promotion') || null,
        sortOrder: Number(f.get('sortOrder')),
        highlighted: f.get('highlighted') === 'on',
        publicVisible: f.get('publicVisible') === 'on',
      },
      { onSuccess: () => (e.target as HTMLFormElement).reset() },
    );
  }
  function edit(e: FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    save.mutate({
      id,
      name: f.get('name'),
      category: f.get('category'),
      durationDays: Number(f.get('days')),
      durationMonths: f.get('months') ? Number(f.get('months')) : null,
      price: Number(f.get('price')),
      description: f.get('description'),
      promotion: f.get('promotion') || null,
      sortOrder: Number(f.get('sortOrder')),
      highlighted: f.get('highlighted') === 'on',
      publicVisible: f.get('publicVisible') === 'on',
    });
  }
  return (
    <>
      <h1 className="display text-5xl">Planes</h1>
      <p className="mt-1 text-muted">Precio referencial: el cobro se hace en recepción, nunca en línea.</p>
      <ul className="mt-6 divide-y divide-line border-y border-line">
        {plans.data?.map((p) => (
          <li key={p.id} className="py-3">
            <div className="flex items-center justify-between gap-3">
              <span>
                <span className="font-semibold">{p.name}</span>
                <span className="block text-sm text-muted">
                  {p.category === 'MACHINES' ? 'Máquinas' : 'Danza'} ·{' '}
                  {p.durationMonths
                    ? `${p.durationMonths} ${p.durationMonths === 1 ? 'mes' : 'meses'}`
                    : `${p.durationDays} días`}{' '}
                  · S/ {Number(p.price).toFixed(2)}
                </span>
              </span>
              <button
                className="btn-ghost text-sm"
                aria-pressed={p.active}
                onClick={() => save.mutate({ id: p.id, active: !p.active })}
              >
                {p.active ? 'Activo' : 'Inactivo'}
              </button>
            </div>
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-orange">Editar datos de la web</summary>
              <form onSubmit={(e) => edit(e, p.id)} className="mt-3 grid gap-3 md:grid-cols-2">
                <label>
                  <span className="mb-1 block text-sm">Nombre</span>
                  <input name="name" defaultValue={p.name} required className="field" />
                </label>
                <label>
                  <span className="mb-1 block text-sm">Categoría</span>
                  <select name="category" defaultValue={p.category} className="field">
                    <option value="MACHINES">Máquinas</option>
                    <option value="DANCE">Danza</option>
                  </select>
                </label>
                <label>
                  <span className="mb-1 block text-sm">Días</span>
                  <input
                    name="days"
                    type="number"
                    min="1"
                    max="730"
                    defaultValue={p.durationDays}
                    required
                    className="field"
                  />
                </label>
                <label>
                  <span className="mb-1 block text-sm">Precio S/</span>
                  <input
                    name="price"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={Number(p.price)}
                    required
                    className="field"
                  />
                </label>
                <label>
                  <span className="mb-1 block text-sm">Meses calendario (opcional)</span>
                  <input
                    name="months"
                    type="number"
                    min="1"
                    max="24"
                    defaultValue={p.durationMonths ?? ''}
                    className="field"
                  />
                </label>
                <label className="md:col-span-2">
                  <span className="mb-1 block text-sm">Descripción</span>
                  <input name="description" defaultValue={p.description} maxLength={300} className="field" />
                </label>
                <label>
                  <span className="mb-1 block text-sm">Promoción</span>
                  <input name="promotion" defaultValue={p.promotion ?? ''} maxLength={120} className="field" />
                </label>
                <label>
                  <span className="mb-1 block text-sm">Orden</span>
                  <input
                    name="sortOrder"
                    type="number"
                    min="0"
                    max="9999"
                    defaultValue={p.sortOrder}
                    className="field"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input name="publicVisible" type="checkbox" defaultChecked={p.publicVisible} /> Mostrar en web
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input name="highlighted" type="checkbox" defaultChecked={p.highlighted} /> Destacar
                </label>
                <button className="btn-primary md:col-span-2" disabled={save.isPending}>
                  Guardar plan
                </button>
              </form>
            </details>
          </li>
        ))}
      </ul>
      <form onSubmit={submit} className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Nuevo plan">
        <label className="col-span-2">
          <span className="mb-1 block text-sm">Nombre</span>
          <input name="name" required className="field" />
        </label>
        <label>
          <span className="mb-1 block text-sm">Días</span>
          <input name="days" type="number" min="1" max="730" required className="field" />
        </label>
        <label>
          <span className="mb-1 block text-sm">Precio S/</span>
          <input name="price" type="number" min="0" step="0.01" required className="field" />
        </label>
        <label>
          <span className="mb-1 block text-sm">Meses calendario (opcional)</span>
          <input name="months" type="number" min="1" max="24" className="field" />
        </label>
        <label>
          <span className="mb-1 block text-sm">Categoría</span>
          <select name="category" className="field">
            <option value="MACHINES">Máquinas</option>
            <option value="DANCE">Danza</option>
          </select>
        </label>
        <label>
          <span className="mb-1 block text-sm">Orden</span>
          <input name="sortOrder" type="number" min="0" max="9999" defaultValue="100" className="field" />
        </label>
        <label className="col-span-2">
          <span className="mb-1 block text-sm">Descripción</span>
          <input name="description" maxLength={300} className="field" />
        </label>
        <label className="col-span-2">
          <span className="mb-1 block text-sm">Promoción</span>
          <input name="promotion" maxLength={120} className="field" />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input name="publicVisible" type="checkbox" defaultChecked /> Mostrar en web
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input name="highlighted" type="checkbox" /> Destacar
        </label>
        <button className="btn-primary col-span-2 md:col-span-4" disabled={save.isPending}>
          Agregar plan
        </button>
        {save.isError && <p role="alert">{save.error.message}</p>}
      </form>
      <BusinessHours />
    </>
  );
}
