import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import gym from '../config/gym.json';
import { api, Chevrons, Logo } from '../lib';

const wa = gym.whatsappUrl;
type PublicPlan = {
  id: string;
  name: string;
  category: 'MACHINES' | 'DANCE';
  durationDays: number;
  durationMonths: number | null;
  price: string;
  description: string;
  promotion: string | null;
  highlighted: boolean;
};
type OpeningHour = { id: string; days: string; hours: string };
type PublicCatalog = { plans: PublicPlan[]; hours: OpeningHour[] };
const money = (price: string) => `S/ ${Number(price).toLocaleString('es-PE', { minimumFractionDigits: 0 })}`;
const durationText = (plan: Pick<PublicPlan, 'durationDays' | 'durationMonths'>) =>
  plan.durationMonths
    ? `${plan.durationMonths} ${plan.durationMonths === 1 ? 'mes' : 'meses'}`
    : `${plan.durationDays} día${plan.durationDays === 1 ? '' : 's'}`;

function WhatsAppIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 2a9.78 9.78 0 0 0-8.4 14.8L2.5 21.5l4.84-1.05A9.78 9.78 0 1 0 12 2Zm0 17.78a7.97 7.97 0 0 1-4.07-1.12l-.29-.17-2.87.62.63-2.78-.19-.3A7.98 7.98 0 1 1 12 19.78Zm4.37-5.97c-.24-.12-1.42-.7-1.64-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-1.42-.71-2.36-1.27-3.3-2.88-.25-.43.25-.4.72-1.34.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.47-.4-.41-.54-.42h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.7 2.6 4.12 3.65.57.25 1.02.4 1.37.51.58.18 1.1.15 1.51.09.46-.07 1.42-.58 1.62-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28Z" />
    </svg>
  );
}

function FacebookIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M13.8 21v-8h2.7l.4-3.1h-3.1V7.92c0-.9.25-1.52 1.55-1.52H17V3.62c-.3-.04-1.23-.12-2.35-.12-2.32 0-3.91 1.42-3.91 4.02V9.9H8.1V13h2.64v8h3.06Z" />
    </svg>
  );
}

function InstagramIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className={className}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TikTokIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M15.3 3c.2 1.6 1.1 2.9 2.7 3.7v3a8.2 8.2 0 0 1-2.65-.77v5.87A6.2 6.2 0 1 1 10 8.66v3.05a3.25 3.25 0 1 0 2.35 3.11V3h2.95Z" />
    </svg>
  );
}

function SocialLinks({ className = '' }: { className?: string }) {
  const links = [
    ['Facebook', gym.redes.facebook, FacebookIcon],
    ['Instagram', gym.redes.instagram, InstagramIcon],
    ['TikTok', gym.redes.tiktok, TikTokIcon],
  ] as const;
  return (
    <div className={`flex items-center gap-3 ${className}`} aria-label="Redes sociales">
      {links.map(([name, href, Icon]) => (
        <a
          key={name}
          href={href}
          target="_blank"
          rel="noopener"
          aria-label={name}
          title={name}
          className="tap grid size-11 place-items-center border border-line text-orange transition-colors hover:bg-orange hover:text-black"
        >
          <Icon className="size-6" />
        </a>
      ))}
    </div>
  );
}

function Section({ n, title, id, children }: { n: number; title: string; id: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-t`} className="mx-auto max-w-6xl scroll-mt-16 px-4 py-14 md:px-8 md:py-20">
      <div className="mb-8 flex items-center gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-orange text-lg font-semibold text-black">
          {n}
        </span>
        <h2 id={`${id}-t`} className="display text-5xl md:text-7xl">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

export default function Home() {
  const catalog = useQuery({
    queryKey: ['public-catalog'],
    queryFn: () => api<PublicCatalog>('/public/catalog'),
    staleTime: 60_000,
  });
  const nav = [
    ['planes', 'Planes'],
    ['horarios', 'Horarios'],
    ['ubicacion', 'Ubicación'],
    ['contacto', 'Contacto'],
  ];
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-orange focus:p-3 focus:text-black"
      >
        Saltar al contenido
      </a>
      <header className="sticky top-0 z-40 border-b border-line bg-black/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-8">
          <Link to="/" className="tap flex items-center gap-2 text-orange" aria-label="PowerFit, inicio">
            <Logo iso className="h-9" label="" />
            <span className="display text-2xl text-white">PowerFit</span>
          </Link>
          <nav aria-label="Secciones" className="hidden gap-6 text-sm md:flex">
            {nav.map(([id, t]) => (
              <a key={id} href={`#${id}`} className="tap flex items-center hover:text-orange">
                {t}
              </a>
            ))}
          </nav>
          <Link to="/ingresar" className="btn-ghost text-sm">
            Ingresar
          </Link>
        </div>
      </header>

      <main id="main">
        {/* Hero: composición de la portada del manual — negro, palabra en stencil, diagonal naranja con el logo en blanco. */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="absolute inset-y-0 right-0 w-[62%] bg-orange md:w-[48%]"
            style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}
          />
          <div className="relative mx-auto grid max-w-6xl gap-6 px-4 pt-10 pb-16 md:grid-cols-[1.3fr_1fr] md:px-8 md:pt-20 md:pb-28">
            <div>
              <p className="flex items-center gap-3 text-sm font-semibold tracking-[0.2em] text-muted uppercase">
                <Chevrons className="h-3 text-orange" /> Gimnasio en {gym.ciudad}
              </p>
              <h1 className="display mt-4 text-[clamp(4.5rem,22vw,11rem)] text-orange">PowerFit</h1>
              <p className="mt-4 max-w-md text-xl leading-snug md:text-2xl">{gym.eslogan}</p>
              <p className="mt-3 max-w-md text-muted">Entrenamiento con máquinas y clases de danza.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href={wa} target="_blank" rel="noopener" className="btn-primary text-base">
                  <WhatsAppIcon className="size-5" />
                  Escríbenos por WhatsApp
                </a>
                <a href="#planes" className="btn-ghost text-base">
                  Ver planes
                </a>
              </div>
            </div>
            <Logo className="mx-auto mt-4 w-40 self-end text-white md:mt-0 md:w-56" label="Logo de PowerFit" />
          </div>
        </section>

        <Section n={1} id="planes" title="Planes">
          {(['MACHINES', 'DANCE'] as const).map((category) => {
            const plans = catalog.data?.plans.filter((plan) => plan.category === category) ?? [];
            if (!plans.length) return null;
            return (
              <section
                key={category}
                className="mb-8 last:mb-0"
                aria-label={`Planes de ${category === 'MACHINES' ? 'máquinas' : 'danza'}`}
              >
                <h3 className="display mb-3 text-3xl text-orange">{category === 'MACHINES' ? 'Máquinas' : 'Danza'}</h3>
                <ul
                  className={`grid gap-px bg-line sm:grid-cols-2 ${
                    category === 'MACHINES' ? 'lg:grid-cols-5' : 'lg:grid-cols-2'
                  }`}
                >
                  {plans.map((p) => (
                    <li
                      key={p.id}
                      className={`flex min-h-72 flex-col gap-3 p-6 ${p.highlighted ? 'bg-orange text-black' : 'bg-black'}`}
                    >
                      <h4 className="display text-4xl">{p.name.replace(/^.+? \| /, '')}</h4>
                      <p className="text-sm opacity-80">{durationText(p)}</p>
                      <p className="display text-6xl">{money(p.price)}</p>
                      {p.promotion && <p className="text-sm font-semibold">{p.promotion}</p>}
                      <p className="mt-auto text-sm">{p.description}</p>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
          {catalog.isPending && <p className="mt-4 text-muted">Cargando planes…</p>}
          {catalog.isError && (
            <div role="alert" className="mt-4 flex flex-wrap items-center gap-3 text-danger">
              <p>No pudimos cargar los planes.</p>
              <button type="button" className="btn-ghost text-sm" onClick={() => catalog.refetch()}>
                Reintentar
              </button>
            </div>
          )}
          <p className="mt-4 text-sm text-muted">Pago y renovación en recepción. No realizamos cobros en línea.</p>
        </Section>

        <Section n={2} id="horarios" title="Horarios">
          <dl className="divide-y divide-line border-y border-line">
            {catalog.data?.hours.map((h) => (
              <div key={h.id} className="flex flex-wrap items-baseline justify-between gap-2 py-4">
                <dt className="text-lg">{h.days}</dt>
                <dd className="display text-3xl text-orange">{h.hours}</dd>
              </div>
            ))}
          </dl>
          {catalog.isPending && <p className="mt-4 text-muted">Cargando horarios…</p>}
          {catalog.isError && (
            <div role="alert" className="mt-4 flex flex-wrap items-center gap-3 text-danger">
              <p>No pudimos cargar los horarios.</p>
              <button type="button" className="btn-ghost text-sm" onClick={() => catalog.refetch()}>
                Reintentar
              </button>
            </div>
          )}
        </Section>

        <Section n={3} id="ubicacion" title="Ubicación">
          <div className="grid gap-6 md:grid-cols-[1fr_2fr]">
            <div>
              <p className="text-lg">{gym.direccion}</p>
              <p className="text-muted">{gym.ciudad}, Perú</p>
              <a className="btn-ghost mt-4" target="_blank" rel="noopener" href={gym.googleMapsUrl}>
                Cómo llegar
              </a>
            </div>
            <iframe
              title="Mapa de ubicación de PowerFit"
              loading="lazy"
              className="aspect-[4/3] w-full border border-line md:aspect-[16/9]"
              src={gym.googleMapsEmbedUrl}
            />
          </div>
        </Section>

        <Section n={4} id="galeria" title="Galería">
          <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:px-0">
            {gym.galeria.map((g) => (
              <li key={g.src} className="w-[80%] shrink-0 snap-start md:w-auto">
                <img
                  src={g.src}
                  alt={g.alt}
                  width="600"
                  height="750"
                  loading="lazy"
                  decoding="async"
                  className="aspect-[4/5] w-full bg-surface object-cover"
                />
              </li>
            ))}
          </ul>
        </Section>

        <Section n={5} id="contacto" title="Contacto">
          <div className="grid gap-6 md:grid-cols-2">
            <a
              href={wa}
              target="_blank"
              rel="noopener"
              className="group flex items-center justify-between bg-orange p-6 text-black"
            >
              <span>
                <span className="block text-sm font-semibold uppercase">WhatsApp</span>
                <span className="display text-4xl">{gym.telefonoVisible}</span>
              </span>
              <WhatsAppIcon className="size-10 transition-transform group-hover:scale-110" />
            </a>
            <SocialLinks />
          </div>
          <div className="mt-12 flex flex-col items-start gap-3 border-t border-line pt-8 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="display text-3xl">Tu membresía en el bolsillo</p>
              <p className="text-muted">Días restantes, plan y avisos de vencimiento. Instala la app de PowerFit.</p>
            </div>
            <Link to="/ingresar" className="btn-primary">
              Ir a la app web
            </Link>
          </div>
        </Section>
      </main>

      <footer className="border-t border-line px-4 pt-8 pb-24 text-sm text-muted md:px-8 md:pb-8">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-4">
          <p>
            © {new Date().getFullYear()} PowerFit · {gym.ciudad}
          </p>
          <SocialLinks />
        </div>
      </footer>

      {/* Acción principal al alcance del pulgar en móvil */}
      <a
        href={wa}
        target="_blank"
        rel="noopener"
        className="btn-primary fixed inset-x-4 bottom-4 z-40 shadow-[0_8px_30px_rgba(0,0,0,.6)] md:hidden"
      >
        <WhatsAppIcon className="size-5" />
        Escríbenos por WhatsApp
      </a>
    </>
  );
}
