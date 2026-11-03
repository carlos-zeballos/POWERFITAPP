# Progreso PowerFit

## Estado

| Sprint | Entrega | Estado |
| --- | --- | --- |
| 1 | Socios, planes, membresías y alertas D7/D3/D0/vencida | Completo |
| 2 | Vista del socio, bandeja, PWA y renovación móvil | Completo |
| 3 | Autenticación, roles y panel de indicadores | Completo |
| 4 | Comunicados, CSV, pruebas y documentación | En cierre |

## Fidelizacion

- [x] Iteracion 1: modelo Prisma, migracion y feature flag `LOYALTY_ENABLED`.
- [x] Iteracion 2: check-in QR/manual, auditoria e idempotencia.
- [x] Iteracion 3: rachas semanales, congelamientos y recalculo reproducible.
- [ ] Iteracion 4: libro mayor, reglas, notificaciones y canjes.
- [ ] Iteracion 5: pantallas, indicadores, CSV y aceptacion.

## Backlog de cierre

- [x] Validar los flujos críticos en 360/768/1280 px.
- [x] Corregir la confirmación de renovación tras refrescar alertas.
- [x] Lint, formato, tipos y pruebas API.
- [x] README, modelo de datos, endpoints y SEO estático.
- [ ] Medir Lighthouse móvil del build servido por la API.
- [ ] Validar visualmente el push real y el modo offline del socio.

## Decisiones

- Fidelizacion permanece desactivada por defecto con `LOYALTY_ENABLED=false`. La asistencia es una sola fila por socio/dia Lima; la auditoria y el libro de puntos son append-only. Las rachas son una proyeccion reconstruible desde asistencias validas, semanas y ajustes de congelamiento.

- La marca usa fondo negro único; naranja `#EC661C`, negro y blanco; display Big Shoulders Stencil Text. Lexend, superficies y colores de estado son supuestos documentados en `apps/web/src/design-tokens.ts` y requieren confirmación del gimnasio.
- Fechas y estados se calculan desde fechas Lima, no se persisten como estado de membresía.
- Renovación oportuna: membresía siguiente registrada antes o el mismo día del vencimiento; baja: sin renovación tras 7 días de gracia; aviso oportuno: D7/D3 recibido al menos dos días antes.
- PostgreSQL local usa `pg_ctl` de `embedded-postgres`; evita el fallo de `postgres.exe` bajo una cuenta Windows Administrador.
- Bcryptjs evita dependencias nativas. Las cookies son httpOnly, SameSite Strict, y `tokenVersion` revoca sesiones.
- El motor de alertas es idempotente con `Notice(membershipId, kind)` y `JobRun(name, runDate)`.
- Atajos vigentes: filtro de estado en memoria hasta ~5 000 socios; listas hasta 60; push de comunicados secuencial hasta ~1 000; p95 en memoria.
- Intento fallido documentado: comparar el color CSS calculado con RGB exacto fue inestable por el redondeo oklch de Tailwind; el E2E verifica la presencia de marca, no un valor serializado por el navegador.
