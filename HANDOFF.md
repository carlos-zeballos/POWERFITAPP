# Prompt de continuación — MVP PowerFit

Actúa como arquitecto y desarrollador fullstack senior con criterio de diseñador de producto. Continúas un MVP **ya iniciado** de PowerFit (gimnasio en Arequipa, Perú): una PWA de retención de membresías y el sitio público del gimnasio. No empieces de cero: lee el repositorio, respeta el stack y las decisiones ya tomadas, y termina lo pendiente.

## 0. Material adjunto (léelo antes de tocar código)

- `brand/Manual de identidad POWERFIT.pdf`, manual de marca de 20 páginas:
  - Pág. 4, §1 Paleta: naranja `#EC661C` (CMYK 0/70/94/0, RGB 236/103/28), negro `#000000` y blanco `#FFFFFF`.
  - Pág. 5, §2 Tipografía: **Big Shoulders Stencil Text**.
  - Págs. 6–9, §3 Logo: versiones en negro, blanco y naranja sobre fondo blanco, negro o naranja. Hay versiones bicolor con el monograma "PF" en naranja.
  - Págs. 10–13, §4 Variaciones: isotipo sin la palabra "POWERFIT", monograma PF con rayo solo y cabeza sola.
  - Págs. 14–15, §5 Usos incorrectos: no cambiar la posición de los elementos ni del nombre, no usar otros colores ni otra tipografía, no deformar, no girar, no poner fondos o formas ajenas y no usar el logo en trazo.
  - Págs. 16–19, §6–7 Papelería y aplicaciones: tarjetas negras, chevrons triples `>>>`, diagonales naranjas, camisetas negras, y una pantalla de móvil con fondo naranja y logo blanco (de ahí salen los íconos de la PWA).
  - Pág. 1, portada: fondo negro, la palabra "POWERFIT" en stencil naranja y un triángulo diagonal naranja con el logo en blanco. Es la composición del héroe del sitio.
  - Pág. 3, índice: los números van en círculos naranjas. Se usan para numerar las secciones del sitio.
- `brand/logo-powerfit.png`: logo vertical naranja de 423×774 px. La palabra "POWER FIT" empieza alrededor de y≈690. Se usa como `mask-image` para pintarlo en cualquier color de la paleta. La clase `.isotipo` lo recorta a una proporción de 423/680.
- **El manual NO define** tipografía de texto, zona de respeto, tono de voz, colores secundarios ni modo claro u oscuro. Supuestos ya documentados en `apps/web/src/design-tokens.ts`:
  - Tipografía de texto: Lexend.
  - Zona de respeto: 12 % del ancho del logo.
  - Superficies derivadas: `#141414`, `#2A2A2A` y `#A6A6A6`, más los colores de estado ok `#7BD88F` y danger `#FF6B5B`.
  - Tema oscuro único, porque la marca vive sobre negro.

  Pide al usuario que confirme estos supuestos y no inventes otros.
- Reglas de contraste verificadas:
  - Naranja sobre negro y negro sobre naranja: 6,6:1, válido como texto normal AA. Los botones usan texto negro sobre naranja.
  - Blanco sobre naranja: 3,2:1. Solo se permite en texto de 24 px o más.

## 1. Encargo original (resumen fiel)

- **Problema:**
  - 480 socios y 6 trabajadores.
  - Vencen unas 86 membresías al mes.
  - Solo el 38 % renueva a tiempo, el 26 % renueva tarde y el 36 % no renueva.
  - Baja mensual del 6,5 %.
  - Solo el 52 % de los avisos llega a tiempo.
  - El control manual consume 8 h por semana.
- **Alcance:**
  - Autenticación con 3 roles: propietario (OWNER), recepción (STAFF) y socio (MEMBER).
  - CRUD de socios, planes y membresías, con estados activa, por vencer, vencida y baja.
  - Renovación en menos de 3 toques, sin cobro.
  - Tarea programada diaria que detecta vencimientos a 7, 3 y 0 días y las vencidas.
  - Avisos por 3 canales: Web Push, bandeja dentro de la app y enlace `wa.me` prellenado.
  - Comunicados segmentados por estado o plan.
  - Vista del socio.
  - Panel de indicadores con la línea base 38 / 6,5 / 52 (más 8 h).
  - Exportación a CSV.
- **Fuera de alcance, sin excepción:** pagos o pasarelas de cualquier tipo, facturación, rutinas, control de acceso físico y apps nativas.
- **Requisitos no funcionales:**
  - Operaciones habituales en 2 s o menos, medidas y registradas.
  - Ley 29733 (consentimiento y datos mínimos), con datos de prueba ficticios.
  - Roles aplicados en el servidor, rate limiting, cabeceras de seguridad y CORS restringido.
  - Funcionamiento offline para el socio.
  - Interfaz en español de Perú.
  - Diseño mobile-first desde 360 px, zonas táctiles de 44 px como mínimo y navegación inferior en móvil.
  - Accesibilidad AA, foco visible y `prefers-reduced-motion`.
  - Nada de diseño genérico: ni plantillas, ni degradados morados, ni tarjetas idénticas.
- **Sitio público:**
  - Secciones de inicio, planes con precio, horarios, mapa, galería, contacto y WhatsApp, y botón de instalar.
  - Datos tomados de un archivo de configuración con marcadores `[POR DEFINIR]`.
  - SEO, Open Graph y JSON-LD de tipo LocalBusiness.
  - **Lighthouse móvil de 90 o más** en rendimiento, accesibilidad y SEO.
- **Protocolo:**
  - `PROGRESS.md` con backlog, estado y decisiones.
  - 4 sprints:
    - Sprint 1: membresías y alertas.
    - Sprint 2: socio y renovación.
    - Sprint 3: panel y autenticación.
    - Sprint 4: comunicados, reportes y aceptación.
  - En cada ítem: plan de 5 líneas o menos, cambio mínimo, lint + tipos + pruebas, Playwright en 360/768/1280 con capturas, revisión de seguridad y accesibilidad, y commit convencional.
  - Si algo falla dos veces con el mismo enfoque, cambia de estrategia y anótalo.
  - Pregunta solo si falta información del manual, si hay que elegir entre arquitecturas con costos distintos o si una decisión afecta el alcance.
- **Estilo de trabajo pedido por el usuario:** "ahorra tokens, no expliques, ejecuta". Aplica la skill *Ponytail* en modo full:
  - El cambio completo más pequeño posible.
  - Sin abstracciones ni dependencias innecesarias.
  - Los atajos con límite conocido llevan el comentario `// shortcut: <límite>, <cuándo mejorar>`.
  - Nunca recortes validación, seguridad, accesibilidad ni manejo de errores.
  - Cierra cada respuesta con 1–2 líneas sobre lo que no verificaste y los riesgos.

## 2. Entorno (Windows 11, sin Docker)

- Node 24 y npm 11. Monorepo con npm workspaces: `apps/api` y `apps/web`.
- **Postgres local sin Docker:**
  - Iniciar con `npm run db:local` y detener con `npm run db:local:stop`.
  - `scripts/local-db.mjs` usa los binarios de `embedded-postgres` a través de `pg_ctl`, porque `postgres.exe` falla directamente cuando la cuenta es Administrador.
  - Datos en `.pgdata/`, puerto 5432, usuario y contraseña `powerfit`/`powerfit`.
  - Bases de datos: `powerfit` (desarrollo) y `powerfit_test` (pruebas).
  - Para quien sí tenga Docker existe `docker-compose.yml`.
- `.env` ya existe en la raíz, con claves VAPID y secretos JWT generados. **No lo commitees.** `.env.example` está al día.
- ⚠️ **Prisma bloquea `prisma migrate reset` cuando lo ejecuta una IA.** No lo uses. Para limpiar datos usa `prisma migrate deploy` y luego la semilla, que vacía las tablas por su cuenta.

## 3. Estado actual

**Commit `7bc2429`, "feat(api): …", completo y en verde:**

- **Esquema:** `apps/api/prisma/schema.prisma`, con migración `init` aplicada.
  - Modelos: User, Member, Plan, Membership, Notice, Broadcast, PushSubscription, JobRun, ManualHours y Baseline.
  - `Membership.previousId` es único: hace de enlace de renovación y de protección contra doble toque, y devuelve 409.
  - `Membership.onTime` alimenta el indicador de renovación oportuna.
  - `Notice @@unique([membershipId, kind])` hace idempotente el motor de alertas.
- **Fechas y estados:** `src/dates.ts`.
  - `today()` devuelve la fecha de Lima como medianoche UTC.
  - `statusOf` y `whereStatus` calculan el estado a partir de las fechas, sin guardarlo en la base.
  - "Por vencer" significa 7 días o menos.
- **Motor de alertas:** `src/alerts.ts`.
  - `runAlerts(ref)` asigna D7, D3, D0 o EXPIRED según los días restantes.
  - Es idempotente y recupera los días en que no corrió.
  - Registra cada ejecución en JobRun.
  - Envía el push con `src/push.ts`, que borra las suscripciones con estado 404 o 410.
  - El cron está en `src/index.ts`: `ALERTS_CRON`, por defecto `0 8 * * *` en America/Lima.
- **Autenticación:** `src/auth.ts`.
  - Cookies httpOnly `at` (15 min) y `rt` (30 días, path `/api/v1/auth`), ambas SameSite=Strict.
  - bcryptjs para el hash.
  - `tokenVersion` revoca las sesiones al cerrar sesión.
  - Rate limit de 10 intentos cada 15 min en el login.
  - `requireRole(...)` en el servidor.
- **Rutas:** en `src/routes/`. La lista completa con métodos y roles debe quedar en `docs/endpoints.md`.
  - `staff.ts`: socios con filtro `?q=&status=`, alta con consentimiento obligatorio y validación de celular `9XXXXXXXX`, renovación con `{fromId}`, baja, marca de WhatsApp enviado y planes.
  - `member.ts`: `/me`, `/me/notices`, marcar aviso leído y suscripción push.
  - `owner.ts`: `/kpis`, `/manual-hours`, `/jobs/alerts` (fecha simulada solo fuera de producción), `/broadcasts` y `/reports/{members,notices,kpis}.csv`. Los CSV llevan BOM, separador `;` y protección contra inyección de fórmulas.
- **Métricas:** `src/metrics.ts` guarda los tiempos de respuesta en `logs/metrics.log` (JSONL) y calcula el p95 en memoria.
- **Semilla:** `prisma/seed.ts`.
  - 480 socios ficticios con celulares `9000xxxxx` y una distribución que imita la línea base.
  - Lee los planes de `apps/web/src/config/gym.json`.
  - Usuarios demo `propietario@`, `recepcion@` y `socio@powerfit.test`, todos con la contraseña `PowerFit2026!`. El socio demo vence en hoy+7.
- **Pruebas:** `test/api.test.ts` con Vitest y Supertest contra `powerfit_test`, **9/9 en verde**. Cubren roles, refresh y logout, push y bandeja en D7/D3/D0 sin duplicados, idempotencia, renovación en menos de 2 s con 409 en el doble toque, consentimiento, indicadores, CSV y comunicados segmentados.

**Sin commitear, en el árbol de trabajo:**

- **Frontend `apps/web`:** Vite 8, React 19, react-router 7, TanStack Query 5 y Tailwind 4.
  - Tokens en `design-tokens.ts` y en `index.css`. Las clases propias son `@utility`: `tap`, `btn`, `btn-primary`, `btn-ghost`, `field` y `chip`.
  - `lib.tsx`: cliente `api()` con refresh automático, `waLink`, `enablePush`, y los componentes `Logo` y `Chevrons`.
  - `site/Home.tsx`: héroe al estilo de la portada del manual, secciones numeradas, mapa de OSM, galería y CTA de WhatsApp fijo en móvil.
  - `site/Privacy.tsx`: aviso de la Ley 29733.
  - `app/AppRoutes.tsx`: login, shell con barra lateral en escritorio y navegación inferior en móvil.
  - `app/Socio.tsx`: estado de la membresía, banner offline y bandeja de avisos.
  - `app/Recepcion.tsx`: alertas agrupadas, `Renew` con 2 toques, WhatsApp y alta de socios.
  - `app/Owner.tsx`: panel, comunicados y planes.
  - `public/sw.js`: caché y push escritos a mano.
  - `manifest.webmanifest`, íconos generados con `scripts/icons.mjs`, `og.png`, galería SVG con marcadores y `gym.json` con datos `[POR DEFINIR]`.
  - JSON-LD de tipo ExerciseGym inyectado desde `vite.config.ts`.
  - **El build funciona** (96 KB gzip el bundle principal) y **tsc pasa**.
- **API:** `app.ts` ahora sirve `apps/web/dist` en producción, con CSP ajustada para Google Fonts y el iframe de OSM.
- **E2E:** `playwright.config.ts` levanta la API en el puerto 4100 contra `powerfit_test` y usa los proyectos m360, t768 y d1280. Las pruebas están en `e2e/flows.spec.ts`, con capturas en `e2e/screens/`.
  - Resultado: 6 pasan, 2 se omiten y **4 fallan**.

## 4. Próximos pasos, en orden

1. **Arreglar el E2E:**
   - En `flows.spec.ts:15`, el color que se calcula para el h1 es `rgb(236, 102, 28)`. Tailwind 4 convierte a oklch y redondea. Quita esa aserción, o compara con tolerancia, o compara contra `getComputedStyle` del token.
   - Revisa por qué falla "recepción renueva" en m360: mira `test-results/*/error-context.md`. Probablemente el `listitem` no se encuentra porque el socio demo aparece en varias listas, o `.tap()` necesita `hasTouch`.
   - Vuelve a correr hasta tener todo en verde.
2. **Revisión visual:** lee las capturas de `e2e/screens/` en 360, 768 y 1280 y compáralas con las págs. 1, 3, 7 y 19 del manual (portada, índice, logo sobre naranja y móvil). Comprueba que no haya scroll horizontal, que las zonas táctiles midan 44 px o más y que el logo nunca aparezca girado, en trazo, deformado ni en colores ajenos (§5).
3. **Commit** del frontend y el E2E, con mensajes convencionales separados (`feat(web): …` y `test(e2e): …`). Agrega `.gitattributes`.
4. **Lint:** ejecuta `npm run lint`, que corre ESLint y `prettier --check`, y corrige. Lo más probable es que haya que formatear todo con Prettier.
5. **Lighthouse móvil** sobre el build servido por la API:
   ```
   npm run build -w apps/web
   PORT=4000 npx tsx --env-file=.env apps/api/src/index.ts
   npx lighthouse http://localhost:4000 --form-factor=mobile --chrome-flags=--headless
   ```
   Usa el Chromium de Playwright como `CHROME_PATH`. La meta es 90 o más en rendimiento, accesibilidad y SEO. Si el rendimiento no llega:
   - Precarga la fuente display o sírvela localmente.
   - Saca `@tanstack/react-query` del bundle de Home: Home solo usa `Logo` y `Chevrons`, así que muévelos a un archivo sin dependencias.
   - Añade `robots.txt` y `sitemap.xml`.
6. **Prueba de push real en el navegador:** `enablePush` → `/jobs/alerts` con fecha simulada, en hoy, hoy+4 y hoy+7. Comprueba que la notificación aparece y que el clic abre `/app/socio`. Comprueba también el offline del socio con `context.setOffline(true)` en Playwright.
7. **Documentación:**
   - `README.md`: instalación, `db:local` o Docker, variables de entorno, scripts, credenciales demo, cómo simular alertas y despliegue en un solo proceso (`npm run build`, `migrate`, `start`, con TLS detrás de un proxy y `NODE_ENV=production`).
   - `PROGRESS.md`: backlog por sprint, estado y decisiones. Todas las decisiones de este documento deben quedar ahí, incluidas pg_ctl, bcryptjs, el estado calculado y la definición de los indicadores.
   - `docs/modelo-datos.md` y `docs/endpoints.md`.
8. **Revisión final contra la definición de terminado:**
   - Push y bandeja del socio en D7/D3/D0.
   - Renovación en 2 toques desde el móvil.
   - Indicadores y CSV.
   - Lighthouse de 90 o más.
   - Pruebas de los flujos críticos, semilla y README.
   - **Ninguna función de pago:** búscalo con grep, por ejemplo `pago|payment|checkout|culqi|niubiz|izipay|stripe`. Solo deben aparecer los textos que aclaran que no hay cobro en línea.

## 5. Definiciones ya tomadas (no las cambies sin avisar)

- **Renovación oportuna:** porcentaje de las membresías que vencieron en los últimos 30 días cuya siguiente membresía tiene `onTime=true`, es decir, se registró antes del vencimiento o ese mismo día.
- **Tasa de baja:** membresías sin renovación que vencieron hace más de 7 días (periodo de gracia), dividido entre las membresías vigentes al inicio del periodo.
- **Avisos oportunos:** porcentaje de las vencidas en el periodo que recibieron un aviso D7 o D3, creado al menos 2 días antes del vencimiento y entregado por push, leído en la app o enviado por WhatsApp.
- **Renovación:** usa el mismo plan por defecto. Si la membresía aún está vigente, la nueva empieza el día siguiente al vencimiento; si no, empieza hoy.
- **Atajos documentados en el código:**
  - El filtro de estado se aplica en memoria (válido hasta unos 5 000 socios).
  - Los push de los comunicados se envían de forma secuencial (válido hasta unos 1 000).
  - El p95 se calcula en memoria.
  - Las listas se cortan en 60 elementos.
