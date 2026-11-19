# PowerFit

Aplicación web para retención de membresías y presencia pública de PowerFit en Arequipa. No incluye pagos, facturación, rutinas, control físico de acceso ni apps nativas.

## Requisitos

- Node.js 24 y npm 11.
- PostgreSQL local, o el servidor embebido incluido para Windows/macOS/Linux.

## Instalación local

1. Copia `.env.example` a `.env` y completa los secretos JWT. No subas `.env`.
2. Ejecuta `npm.cmd install`.
3. Inicia PostgreSQL con `npm.cmd run db:local` (o `docker compose up -d`).
4. Aplica migraciones y datos ficticios: `npm.cmd run migrate -w apps/api` y `npm.cmd run seed -w apps/api`.
5. En dos terminales: `npm.cmd run dev:api` y `npm.cmd run dev:web`.

El servidor embebido usa `powerfit`/`powerfit`, puerto `5432` y guarda sus datos en `.pgdata/`. Deténlo con `npm.cmd run db:local:stop`.

## Cuentas demo

| Rol | Correo | Contraseña |
| --- | --- | --- |
| Propietario | `propietario@powerfit.test` | `PowerFit2026!` |
| Recepción | `recepcion@powerfit.test` | `PowerFit2026!` |
| Socio | `socio@powerfit.test` | `PowerFit2026!` |

## Scripts

- `npm.cmd run check`: lint, tipos y pruebas API.
- `npm.cmd run e2e`: flujos Playwright en 360, 768 y 1280 px; requiere PostgreSQL activo y el build web.
- `npm.cmd run build`: builds de API y web.
- `npm.cmd run db:local` / `db:local:stop`: PostgreSQL embebido.

Para demostrar avisos, inicia sesión como propietario y ejecuta `POST /api/v1/jobs/alerts` con `{ "date": "AAAA-MM-DD" }` fuera de producción. Usa hoy, hoy +4 y hoy +7 para cubrir los umbrales del motor. Los avisos quedan en la bandeja interna del socio.

## Configuración publicable

Edita `apps/web/src/config/gym.json` antes de publicar. Todos los valores `[POR DEFINIR]` (teléfono, correo, dirección, horarios, precios y galerías) deben reemplazarse por información real.

## Despliegue

En un único proceso, detrás de un proxy TLS:

```powershell
npm.cmd run build
npm.cmd run migrate -w apps/api
$env:NODE_ENV = 'production'
npm.cmd run start -w apps/api
```

Configura `DATABASE_URL`, los dos secretos JWT, `CORS_ORIGIN`, `PORT`, `TZ_GYM=America/Lima` y `ALERTS_CRON`. El proxy debe terminar TLS; las cookies seguras solo funcionan sobre HTTPS en producción.
