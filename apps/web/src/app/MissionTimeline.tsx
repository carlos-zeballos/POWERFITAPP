import { fmtDate } from '../lib';

export type Mission = {
  level: number;
  title: string;
  description: string;
  progress: number;
  target: number;
  deadline: string;
  state: 'UNLOCKED' | 'IN_PROGRESS' | 'LOCKED' | 'MISSED';
};

/** Ruta visual de progreso inspirada en videojuegos de plataformas, sin usar activos de terceros. */
export function MissionTimeline({
  missions,
  plan,
  startsOn,
  endsOn,
}: {
  missions: Mission[];
  plan: string;
  startsOn: string;
  endsOn: string;
}) {
  if (!missions.length)
    return (
      <section className="mt-6 border border-line bg-surface p-5" aria-label="Misiones">
        <h2 className="display text-3xl">Misiones · {plan}</h2>
        <p className="mt-3 text-muted">Este plan diario registra tu asistencia, pero no incluye niveles ni premios.</p>
      </section>
    );
  const current = missions.find((mission) => mission.state === 'IN_PROGRESS');
  const completed = missions.filter((mission) => mission.state === 'UNLOCKED').length;
  const lineProgress = Math.min(
    100,
    ((completed + (current ? current.progress / current.target : 0)) / missions.length) * 100,
  );
  const segmentProgress = (position: number) =>
    Math.max(0, Math.min(100, (lineProgress - (position * 100) / missions.length) * missions.length));
  return (
    <section className="mt-6 border border-line bg-surface p-5" aria-label="Misiones y premios">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-orange uppercase">Ruta de progreso</p>
          <h2 className="display mt-2 text-4xl">Misiones · {plan}</h2>
        </div>
        <p className="text-xs text-muted">
          {fmtDate(startsOn)} — {fmtDate(endsOn)}
        </p>
      </div>
      <p className="mt-3 text-sm text-muted">Completa cada nivel para encender el siguiente punto de la ruta.</p>
      <div className="mt-6 py-4" aria-label="Ruta de niveles">
        <div className="flex w-full items-start">
          {/* La pista tiene un tramo antes del Nivel 1 y termina en el último círculo. */}
          <div className="mt-5 h-1 min-w-2 flex-1 bg-line">
            <div
              className="h-full bg-orange transition-[width] duration-500"
              style={{ width: `${segmentProgress(0)}%` }}
            />
          </div>
          {missions.map((mission, index) => {
            const ringProgress =
              mission.state === 'UNLOCKED'
                ? 100
                : mission.state === 'IN_PROGRESS'
                  ? Math.min(100, (mission.progress / mission.target) * 100)
                  : mission.state === 'MISSED'
                    ? Math.min(100, (mission.progress / mission.target) * 100)
                    : 0;
            const ringColor = mission.state === 'MISSED' ? '#ff6b5b' : '#ec661c';
            const center =
              mission.state === 'UNLOCKED'
                ? 'bg-orange text-black'
                : mission.state === 'MISSED'
                  ? 'bg-black text-danger'
                  : mission.state === 'LOCKED'
                    ? 'bg-black text-muted'
                    : 'bg-black text-white';
            return (
              <div key={mission.level} className="contents">
                <div className="grid w-10 justify-items-center gap-2 text-center">
                  <span
                    className="grid size-10 place-items-center rounded-full p-1 transition-[background] duration-500"
                    style={{ background: `conic-gradient(${ringColor} ${ringProgress}%, #2a2a2a 0)` }}
                  >
                    <span className={`grid size-full place-items-center rounded-full text-sm font-black ${center}`}>
                      {mission.state === 'UNLOCKED' ? '✓' : mission.level}
                    </span>
                  </span>
                </div>
                {index < missions.length - 1 && (
                  <div className="mt-5 h-1 min-w-2 flex-1 bg-line">
                    <div
                      className="h-full bg-orange transition-[width] duration-500"
                      style={{ width: `${segmentProgress(index + 1)}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <ol className="mt-4 grid gap-3 lg:grid-cols-2" aria-label="Detalle de todas las misiones">
        {missions.map((mission) => {
          const tone =
            mission.state === 'UNLOCKED'
              ? 'border-orange bg-orange/10'
              : mission.state === 'MISSED'
                ? 'border-danger bg-danger/5'
                : mission.state === 'LOCKED'
                  ? 'border-line bg-black opacity-75'
                  : 'border-orange bg-black';
          const progress = Math.min(100, (mission.progress / mission.target) * 100);
          return (
            <li key={mission.level} className={`border-l-4 p-4 ${tone}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="display text-3xl">
                  Nivel {mission.level} · {mission.title}
                </h3>
                <span className="font-semibold text-orange">
                  {mission.progress}/{mission.target} asistencias
                </span>
              </div>
              <p className="mt-3 text-sm text-muted">{mission.description}</p>
              <div
                className="mt-4 h-1.5 bg-line"
                aria-label={`Avance de nivel ${mission.level}: ${mission.progress} de ${mission.target}`}
              >
                <div className="h-full bg-orange transition-[width] duration-500" style={{ width: `${progress}%` }} />
              </div>
              {mission.state === 'UNLOCKED' ? (
                <p className="mt-3 font-semibold text-orange">★ Reclama tu premio — Nivel {mission.level}</p>
              ) : mission.state === 'LOCKED' ? (
                <p className="mt-3 text-sm text-muted">Completa el nivel anterior para encender este punto.</p>
              ) : mission.state === 'MISSED' ? (
                <p className="mt-3 text-sm text-danger">Este nivel terminó sin completarse.</p>
              ) : (
                <p className="mt-3 text-sm">Meta disponible hasta {fmtDate(mission.deadline)}.</p>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
