# QA Report — PowerFit (entorno local)

Fecha: 04 nov. 2026 · Alcance: aplicación web React/Express/PostgreSQL. No se realizaron envíos a contactos reales.

## Resultado

| ID | Rol | Módulo | Acción o botón | Resultado esperado | Resultado obtenido | Estado | Severidad | Evidencia |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| QA-01 | Todos | Web | Carga sin PWA | Sin manifest, SW, instalación ni Push | Registro SW, `sw.js`, UI y endpoints Push eliminados | OK | alta | `main.tsx`, migración `20261104150000_remove_web_push` |
| QA-02 | Propietario | Autenticación | Login correcto e inválido | Acceso correcto / mensaje claro | Cubierto por API | OK | alta | `apps/api/test/api.test.ts` |
| QA-03 | Propietario | Autenticación | Recuperar contraseña | Flujo por correo sandbox | No existe endpoint, token ni pantalla | FALLA | media | `auth.ts` solo contiene login, refresh y logout |
| QA-04 | Propietario | Usuarios | Crear/editar/desactivar recepcionista | Gestión completa por rol | No existe módulo ni endpoint de usuarios internos | FALLA | alta | rutas `owner.ts` y `staff.ts` |
| QA-05 | Propietario | Socios | Código único y QR | Código de 4 dígitos y QR únicos | Código, QR y auditoría de regeneración disponibles | OK | alta | `attendance-code.ts`, `loyalty.ts` |
| QA-06 | Propietario | Membresías | Alta, renovación e historial | Fechas y cadena correctas | Alta, renovación encadenada e historial disponibles | OK | alta | pruebas API y `staff.ts` |
| QA-07 | Propietario | Membresías | Editar una membresía | Edición controlada | No existe edición; solo alta, renovación y anulación | FALLA | media | `staff.ts` |
| QA-08 | Propietario | Misiones | Control por socio y plan | Avances y niveles visibles | Panel `/app/misiones` y ficha del socio muestran avance derivado de asistencia | OK | alta | `owner.ts`, `MissionTimeline.tsx` |
| QA-09 | Propietario | Panel/reportes | KPIs y CSV | Datos persistentes y exportables | Endpoints y UI disponibles | OK | media | `owner.ts`, `Owner.tsx` |
| QA-10 | Propietario | Avisos | D7, D3 y vencimiento | Avisos automáticos idempotentes en bandeja | D7, D3, D0 y vencida disponibles; no hay aviso D1 | FALLA | media | `alerts.ts` |
| QA-11 | Propietario | Comunicados | Envío inmediato y segmentado | Bandeja por plan/estado | Envío inmediato y segmentado a bandeja funciona | OK | media | `/app/comunicados` |
| QA-12 | Propietario | Comunicados | Envío programado | Fecha/hora y estado | No existe programación de comunicados | FALLA | media | `Broadcast` no tiene programación |
| QA-13 | Propietario | Canales | Correo sandbox/WhatsApp automático | Entrega y estado por canal | No existe integración de correo; WhatsApp abre enlace y registra acción manual | BLOQUEADO | media | sin proveedor SMTP/SendGrid |
| QA-14 | Recepción | Permisos | Acceso a KPIs/reportes | Denegado por UI, URL y API | Roles API cubiertos; recepción recibe 403 | OK | alta | pruebas API de roles |
| QA-15 | Recepción | Asistencia | Código, duplicado y vencida | Registro único y errores claros | Flujo por código/QR, idempotencia y vigencia disponibles | OK | alta | `loyalty.ts`, pruebas API |
| QA-16 | Recepción | Asistencia | Cámara QR real | Lectura móvil compatible | Implementada con ZXing; no validada en Safari/Firefox en este entorno | BLOQUEADO | baja | requiere dispositivos/navegadores reales |
| QA-17 | Recepción | Socios | Alta, búsqueda, renovación e historial | Persistencia y consulta | Disponible, incluidos códigos y misiones | OK | alta | `/app/socios` |
| QA-18 | Socio | Vista personal | Membresía, puntos, QR y misiones | Refleja asistencia de recepción | Disponible y validado en recorrido QA | OK | alta | `qa:journey` |
| QA-19 | Socio | Racha | Mostrar racha semanal | Según último requerimiento | Retirada intencionalmente; misiones sustituyen la meta semanal visual | OK | baja | `MissionTimeline.tsx` |
| QA-20 | Todos | Responsive/navegadores | 390/768/1440, Chrome/Edge/Safari o Firefox | Sin defectos visuales | Build validado; Safari/Edge y viewport exacto requieren ejecución externa | BLOQUEADO | baja | Playwright local usa Chromium |

## Correcciones aplicadas durante este ciclo

- Eliminado Web Push, service worker y cualquier experiencia instalable; los avisos quedan en la bandeja interna.
- Eliminada la tabla y columna de base de datos de Web Push mediante la migración `20261104150000_remove_web_push`.
- Actualizados reportes, documentación, pruebas y configuración para no mencionar Push/VAPID.

## Resumen

- Casos: 20. OK: 11 (55 %). FALLA/BLOQUEADO: 9.
- No hay fallas conocidas de alta severidad en los flujos existentes de autenticación, membresía, asistencia, roles o misiones.
- Pendientes de producto: recuperación de contraseña, administración de usuarios internos, edición de membresía, aviso D1, programación de comunicados, correo sandbox y automatización de WhatsApp.
- La semilla solicitada de 1 propietario, 2 recepcionistas y 15 socios Básico/Full/Premium no se aplicó sobre la base actual: sustituiría los planes comerciales y los datos QA ya solicitados anteriormente. Requiere definir si debe vivir en una base aislada de pruebas o reemplazar los datos locales actuales.
