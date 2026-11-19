# Modelo de datos

## Fidelizacion

| Entidad | Proposito | Relaciones y reglas |
| --- | --- | --- |
| `Attendance` | Visita validada por recepcion. | Una por socio/dia Lima; QR o manual; anulable, no duplicable. |
| `AttendanceAudit` | Trazabilidad de asistencia. | Creacion, anulacion o correccion, con actor, motivo y antes/despues. |
| `LoyaltySettings` | Politica semanal. | Meta, congelamientos, riesgo y horario de silencio; una configuracion. |
| `StreakState` / `StreakWeek` | Proyeccion de rachas. | Estado actual e historial semanal, reconstruibles desde asistencias validas. |
| `PointRule` / `PointLedger` | Reglas y movimientos. | Libro append-only; `sourceKey` unico hace cada premio idempotente. |
| `Badge` / `MemberBadge` | Insignias privadas. | Sin ranking publico ni nombres reales. |
| `Reward` / `Redemption` | Catalogo y canje. | Solicitud y aprobacion sin pago en linea. |

El modulo esta protegido por `LOYALTY_ENABLED=false`. La asistencia requiere consentimiento separado (`loyaltyConsentAt`).

| Entidad | Propósito | Relaciones y reglas |
| --- | --- | --- |
| `User` | Credenciales, rol y revocación. | Un `Member` opcional. Roles: OWNER, STAFF, MEMBER. |
| `Member` | Datos mínimos con consentimiento. | Tiene membresías y avisos; correo opcional. |
| `Plan` | Duración, precio informativo y vigencia. | Asociado a membresías; no participa en ningún cobro. |
| `Membership` | Periodo de un plan. | `previousId` único enlaza la renovación y evita dobles registros. `onTime` alimenta KPI. |
| `Notice` | Aviso D7/D3/D0/vencida o comunicado. | Único por `membershipId` + `kind`; registra lectura y WhatsApp. |
| `Broadcast` | Comunicado segmentado. | Conserva el segmento y total de destinatarios. |
| `JobRun` | Ejecución de tareas programadas. | Único por nombre y fecha para idempotencia. |
| `ManualHours` | Horas de control manual por semana. | Una fila por inicio de semana. |
| `Baseline` | Valores diagnósticos iniciales. | Clave única para 38 %, 6.5 % y 52 %. |

El estado de una membresía no se almacena: se deriva de `startDate`, `endDate`, `cancelledAt` y la fecha de Lima. Los estados resultantes son activa, por vencer (hasta siete días), vencida y baja.
