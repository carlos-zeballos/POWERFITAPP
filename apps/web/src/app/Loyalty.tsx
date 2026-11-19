import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { BrowserQRCodeReader } from '@zxing/browser';
import { api, fmtTime } from '../lib';
import { MissionTimeline, type Mission } from './MissionTimeline';

type Loyalty = {
  attendanceCode: string | null;
  qrToken: string;
  points: number;
  subscription: { plan: string; startsOn: string; endsOn: string; registeredAt: string };
  missions: Mission[];
};
type Checkin = {
  created: boolean;
  member: string;
  plan: string;
  daysLeft: number;
  streakWeeks: number;
  weekAttendance: number;
  weeklyGoal: number;
  pointsAwarded: number;
  pointsBalance: number;
  renewalWarning: boolean;
};

export function FidelidadSocio() {
  const q = useQuery({ queryKey: ['loyalty-me'], queryFn: () => api<Loyalty>('/loyalty/me') });
  const [image, setImage] = useState('');
  useEffect(() => {
    if (q.data?.qrToken) QRCode.toDataURL(q.data.qrToken, { margin: 1, width: 240 }).then(setImage);
  }, [q.data?.qrToken]);
  if (q.isPending) return <p aria-busy="true">Cargando fidelización…</p>;
  if (q.isError) return <p role="alert">{q.error.message}</p>;
  return (
    <>
      <h1 className="display text-5xl">Mi progreso</h1>
      <section className="mt-6 border border-orange bg-surface p-5" aria-label="Puntos acumulados">
        <p className="text-sm text-muted">Puntos acumulados por asistencias válidas</p>
        <p className="display mt-3 text-6xl text-orange">{q.data.points}</p>
        <p className="mt-2 text-sm text-muted">Tu avance y premios se miden en las misiones de abajo.</p>
      </section>
      <MissionTimeline
        missions={q.data.missions}
        plan={q.data.subscription.plan}
        startsOn={q.data.subscription.startsOn}
        endsOn={q.data.subscription.endsOn}
      />
      <section className="mt-6 border border-line p-5" aria-label="Identificador de asistencia">
        <p className="text-sm text-muted">Muéstralo a recepción</p>
        <p className="display mt-2 text-7xl tracking-[.2em] text-orange">{q.data.attendanceCode ?? '----'}</p>
        {image && <img src={image} alt="QR personal para registrar asistencia" className="mt-4 w-56 bg-white p-2" />}
      </section>
    </>
  );
}

export function Asistencia() {
  const [code, setCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<Checkin | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const today = useQuery({
    queryKey: ['checkins-today'],
    queryFn: () => api<{ id: string; member: string; checkedAt: string }[]>('/loyalty/check-ins/today'),
  });
  const checkin = useMutation({
    mutationFn: (body: object) => api<Checkin>('/loyalty/check-ins', body),
    onSuccess: (data) => {
      setResult(data);
      setCode('');
      today.refetch();
    },
  });
  useEffect(() => {
    if (!scanning || !video.current) return;
    const reader = new BrowserQRCodeReader();
    let controls: { stop: () => void } | undefined;
    reader
      .decodeFromConstraints({ video: { facingMode: 'environment' } }, video.current, (scan) => {
        if (scan) {
          controls?.stop();
          setScanning(false);
          checkin.mutate({ qrToken: scan.getText() });
        }
      })
      .then((value) => (controls = value))
      .catch(() => setScanning(false));
    return () => controls?.stop();
  }, [scanning, checkin]);
  return (
    <>
      <h1 className="display text-5xl">Asistencia</h1>
      <p className="mt-1 text-muted">Registra la visita con el código o QR del socio.</p>
      <div className="mt-6 grid grid-cols-3 gap-3" aria-label="Teclado numérico">
        {'123456789'.split('').map((n) => (
          <button
            key={n}
            className="tap border border-line text-3xl font-semibold"
            onClick={() => setCode((v) => (v.length < 4 ? v + n : v))}
          >
            {n}
          </button>
        ))}
        <button className="btn-ghost" onClick={() => setCode('')}>
          Borrar
        </button>
        <button
          className="tap border border-line text-3xl font-semibold"
          onClick={() => setCode((v) => (v.length < 4 ? v + '0' : v))}
        >
          0
        </button>
        <button
          className="btn-primary"
          disabled={code.length !== 4 || checkin.isPending}
          onClick={() => checkin.mutate({ code })}
        >
          Registrar
        </button>
      </div>
      <p className="display mt-4 text-center text-5xl tracking-[.25em] text-orange">{code.padEnd(4, '—')}</p>
      <button className="btn-ghost mt-4" onClick={() => setScanning(true)}>
        Escanear QR
      </button>
      {scanning && <video ref={video} className="mt-4 w-full border border-orange" autoPlay muted playsInline />}
      {checkin.isError && (
        <p role="alert" className="mt-3 text-danger">
          {checkin.error.message}
        </p>
      )}
      {result && (
        <section className="mt-6 border border-orange bg-surface p-5" role="status">
          <h2 className="display text-4xl text-ok">{result.created ? 'Asistencia registrada' : 'Ya registrada'}</h2>
          <p className="mt-2 text-xl">
            {result.member} · {result.plan}
          </p>
          <p>{result.daysLeft >= 0 ? `${result.daysLeft} días restantes de membresía` : 'Membresía vencida'}</p>
          <p className="display mt-3 text-3xl">
            +{result.pointsAwarded} puntos · {result.pointsBalance} saldo
          </p>
          {result.renewalWarning && (
            <p className="mt-3 bg-orange p-3 font-semibold text-black">Membresía por vencer: registra la renovación.</p>
          )}
        </section>
      )}
      <section className="mt-8">
        <h2 className="display text-3xl">Hoy · {today.data?.length ?? 0}</h2>
        <ul className="mt-3 divide-y divide-line">
          {today.data?.map((item) => (
            <li key={item.id} className="py-3">
              {item.member} · {fmtTime(item.checkedAt)}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

export function FidelidadOwner() {
  const settings = useQuery({
    queryKey: ['loyalty-settings'],
    queryFn: () => api<{ weeklyGoal: number; freezesPerMonth: number }>('/loyalty/settings'),
  });
  const today = useQuery({
    queryKey: ['checkins-today'],
    queryFn: () => api<{ id: string; member: string }[]>('/loyalty/check-ins/today'),
  });
  return (
    <>
      <h1 className="display text-5xl">Asistencia y rachas</h1>
      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="border border-orange p-5">
          <p className="text-muted">Asistencias hoy</p>
          <p className="display text-6xl">{today.data?.length ?? 0}</p>
        </div>
        <div className="border border-line p-5">
          <p className="text-muted">Regla activa</p>
          <p className="display text-4xl">{settings.data?.weeklyGoal ?? 3} por semana</p>
          <p>{settings.data?.freezesPerMonth ?? 1} congelamiento mensual</p>
        </div>
      </section>
      <h2 className="display mt-8 text-3xl">Entradas de hoy</h2>
      <ul className="mt-3 divide-y divide-line">
        {today.data?.map((item) => (
          <li key={item.id} className="py-3">
            {item.member}
          </li>
        ))}
      </ul>
    </>
  );
}
