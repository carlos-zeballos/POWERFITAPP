# Endpoints API v1

Las rutas de fidelizacion se incorporaran solo cuando `LOYALTY_ENABLED=true`; esta iteracion solo entrega modelo y migracion.

## Fidelizacion

| Ruta | Roles | Descripcion |
| --- | --- | --- |
| `POST /loyalty/consent` | MEMBER | Registra consentimiento y alias opcional. |
| `GET /loyalty/qr` | MEMBER | QR firmado, valido por 60 segundos. |
| `GET /loyalty/me` | MEMBER | Saldo derivado y racha recalculada. |
| `GET /loyalty/members?q=` | OWNER, STAFF | Busqueda manual de socios con consentimiento. |
| `POST /loyalty/check-ins` | OWNER, STAFF | Check-in QR o manual; idempotente por socio/dia Lima. |
| `PATCH /loyalty/attendances/:id` | OWNER, STAFF | Corrige fecha con motivo y auditoria. |
| `POST /loyalty/attendances/:id/void` | OWNER, STAFF | Anula con motivo y auditoria. |
| `GET /loyalty/check-ins/today` | OWNER, STAFF | Ultimas 60 entradas del dia. |
| `GET/PATCH /loyalty/settings` | OWNER | Consulta o modifica meta, congelamientos y silencio. |
| `POST /loyalty/recalculate` | OWNER | Reconstruye todas las rachas desde asistencias. |

Todos viven bajo `/api/v1`. Las rutas protegidas requieren la cookie de acceso.

| Método y ruta | Roles | Descripción |
| --- | --- | --- |
| `GET /health` | Público | Estado del servicio. |
| `POST /auth/login` | Público | Inicia sesión; límite de 10 intentos/15 min. |
| `POST /auth/refresh` | Público con refresh | Rota cookies de sesión. |
| `POST /auth/logout` | Autenticado | Revoca refresh y cierra sesión. |
| `GET /auth/me` | Todos | Perfil y rol de la sesión. |
| `GET /members` | OWNER, STAFF | Lista y filtra socios por texto/estado. |
| `POST /members` | OWNER, STAFF | Crea socio, consentimiento y primera membresía. |
| `PATCH /members/:id` | OWNER, STAFF | Actualiza datos mínimos del socio. |
| `POST /members/:id/renew` | OWNER, STAFF | Registra una renovación; 409 ante doble toque. |
| `POST /memberships/:id/cancel` | OWNER, STAFF | Da de baja una membresía. |
| `POST /members/:id/whatsapp` | OWNER, STAFF | Marca un aviso como enviado por WhatsApp. |
| `GET /plans` | OWNER, STAFF | Lista planes. |
| `POST /plans`, `PATCH /plans/:id` | OWNER | Crea o edita planes. |
| `GET /me` | MEMBER | Membresía del socio actual. |
| `GET /me/notices` | MEMBER | Bandeja del socio (máximo 50). |
| `POST /me/notices/:id/read` | MEMBER | Marca un aviso propio como leído. |
| `GET /kpis` | OWNER | Indicadores y línea base. |
| `POST /manual-hours` | OWNER | Registra horas manuales semanales. |
| `POST /jobs/alerts` | OWNER | Ejecuta alertas; fecha simulada solo no productiva. |
| `GET/POST /broadcasts` | OWNER | Lista o envía comunicados segmentados. |
| `GET /reports/{members,notices,kpis}.csv` | OWNER | Exporta CSV con BOM, `;` y protección de fórmulas. |
