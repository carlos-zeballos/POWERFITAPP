import { useState, type FormEvent } from 'react';
import { Routes, Route, Navigate, NavLink, Outlet, useNavigate, Link } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, Logo, useMe, type Me, type Role } from '../lib';
import { Socio, Avisos } from './Socio';
import { Recepcion, Socios } from './Recepcion';
import { Panel, Comunicados, Misiones, Planes } from './Owner';
import { Asistencia, FidelidadSocio } from './Loyalty';
import Privacy from '../site/Privacy';

const HOME: Record<Role, string> = { OWNER: '/app/panel', STAFF: '/app/recepcion', MEMBER: '/app/socio' };
const NAV: Record<Role, [string, string][]> = {
  MEMBER: [
    ['/app/socio', 'Membresía'],
    ['/app/avisos', 'Avisos'],
  ],
  STAFF: [
    ['/app/recepcion', 'Alertas'],
    ['/app/socios', 'Socios'],
  ],
  OWNER: [
    ['/app/panel', 'Panel'],
    ['/app/recepcion', 'Alertas'],
    ['/app/socios', 'Socios'],
    ['/app/comunicados', 'Avisos'],
    ['/app/misiones', 'Misiones'],
    ['/app/planes', 'Planes'],
  ],
};

function ShieldIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className={className}>
      <path d="M12 3 5 6v5c0 4.4 2.9 8.4 7 10 4.1-1.6 7-5.6 7-10V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function Login() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const f = new FormData(e.currentTarget);
      const me = await api<Me>('/auth/login', { email: f.get('email'), password: f.get('password') });
      qc.setQueryData(['me'], me);
      nav(HOME[me.role], { replace: true });
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <Link to="/" className="mx-auto mb-8 w-24 text-orange" aria-label="Volver al inicio">
        <Logo label="PowerFit" />
      </Link>
      <h1 className="display mb-6 text-5xl">Ingresar</h1>
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm">Correo</span>
          <input name="email" type="email" autoComplete="username" required className="field" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm">Contraseña</span>
          <input name="password" type="password" autoComplete="current-password" required className="field" />
        </label>
        {err && (
          <p role="alert" className="text-danger">
            {err}
          </p>
        )}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </main>
  );
}

function Shell() {
  const me = useMe();
  const features = useQuery({
    queryKey: ['features'],
    queryFn: () => api<{ loyalty: boolean }>('/features'),
    staleTime: 5 * 60_000,
  });
  const qc = useQueryClient();
  const nav = useNavigate();
  if (me.isPending) return <div className="min-h-dvh" aria-busy="true" />;
  if (!me.data) return <Navigate to="/ingresar" replace />;
  const items = [...NAV[me.data.role]];
  if (features.data?.loyalty) {
    if (me.data.role === 'MEMBER') items.push(['/app/fidelidad', 'Progreso']);
    if (me.data.role === 'STAFF') items.push(['/app/asistencia', 'Asistencia']);
    if (me.data.role === 'OWNER') items.push(['/app/asistencia', 'Asistencia']);
  }
  async function logout() {
    await api('/auth/logout', {}).catch(() => {});
    qc.clear();
    nav('/ingresar', { replace: true });
  }
  return (
    <div className="min-h-dvh pb-20 lg:grid lg:grid-cols-[220px_1fr] lg:pb-0">
      <aside className="hidden border-r border-line p-6 lg:flex lg:flex-col lg:gap-1">
        <Logo iso className="mb-6 w-12 text-orange" />
        {items.map(([to, t]) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `tap flex items-center px-3 ${isActive ? 'bg-orange text-black' : 'hover:text-orange'}`
            }
          >
            {t}
          </NavLink>
        ))}
        <NavLink
          to="/app/privacidad"
          className={({ isActive }) =>
            `tap mt-auto flex items-center gap-2 px-3 text-sm ${isActive ? 'text-orange' : 'text-muted hover:text-orange'}`
          }
        >
          <ShieldIcon className="size-4" /> Protección de datos personales
        </NavLink>
        <button onClick={logout} className="tap text-left text-muted hover:text-white">
          Cerrar sesión
        </button>
      </aside>
      <div>
        <header className="flex h-14 items-center justify-between border-b border-line px-4 lg:px-8">
          <span className="flex items-center gap-2">
            <Logo iso className="h-8 text-orange lg:hidden" label="" />
            <span className="text-sm text-muted">{me.data.name}</span>
          </span>
          <span className="flex items-center gap-3">
            <NavLink
              to="/app/privacidad"
              className="tap flex items-center gap-1 text-sm text-muted hover:text-orange"
              aria-label="Protección de datos personales"
            >
              <ShieldIcon className="size-4" />
              <span className="hidden sm:inline">Protección de datos</span>
            </NavLink>
            <button onClick={logout} className="tap text-sm text-muted hover:text-white">
              Cerrar sesión
            </button>
          </span>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6 lg:px-8">
          <Outlet />
        </main>
      </div>
      {/* Navegación inferior móvil: acciones al alcance del pulgar */}
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-black pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {items.map(([to, t]) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `tap flex flex-1 flex-col items-center justify-center py-3 text-xs font-semibold uppercase ${isActive ? 'text-orange shadow-[inset_0_3px_0_var(--color-orange)]' : 'text-muted'}`
            }
          >
            {t}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function RoleHome() {
  const me = useMe();
  if (me.isPending) return null;
  return <Navigate to={me.data ? HOME[me.data.role] : '/ingresar'} replace />;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="ingresar" element={<Login />} />
      <Route path="app" element={<Shell />}>
        <Route index element={<RoleHome />} />
        <Route path="socio" element={<Socio />} />
        <Route path="avisos" element={<Avisos />} />
        <Route path="recepcion" element={<Recepcion />} />
        <Route path="socios" element={<Socios />} />
        <Route path="panel" element={<Panel />} />
        <Route path="comunicados" element={<Comunicados />} />
        <Route path="misiones" element={<Misiones />} />
        <Route path="planes" element={<Planes />} />
        <Route path="privacidad" element={<Privacy inApp />} />
        <Route path="asistencia" element={<Asistencia />} />
        <Route path="fidelidad" element={<FidelidadSocio />} />
      </Route>
      <Route path="*" element={<RoleHome />} />
    </Routes>
  );
}
