## Why

`AttendanceMatchesTab` (pestaña "Partidos" de `/coach/attendance/summary?teamId`) renderizaba una tabla matriz jugador × jornada. Cada partido de la temporada añadía una columna, así que a partir de ~8-9 jornadas la tabla ya no cabía en el `TableContainer` (que tiene su propio `max-height` + scroll vertical) y aparecía también scroll horizontal — dos scrolls anidados en la misma zona de pantalla. En móvil la matriz era directamente inviable. Un spike visual (aprobado por el usuario) mostró una alternativa de tarjeta plegable por jugador, siguiendo el mismo patrón `Accordion` que ya usa `AttendanceTrainingsTab` en esta misma pantalla.

Durante la revisión del resultado, el usuario pidió varias iteraciones adicionales sobre el mismo diseño (ver "What Changes"): un bug real de clasificación que ocultaba los amistosos, ajustes de layout en móvil, foto + dorsal del jugador, orden por dorsal con el jugador propio primero, un badge de camiseta coloreado por posición, pestañas superiores con icono en vez de texto, y aprovechamiento del espacio horizontal en desktop/tablet. Todo ello se implementó dentro del mismo change, ampliando `design.md`/`tasks.md` en vez de abrir proposals nuevas, porque partía del mismo componente y no se había commiteado nada todavía.

## What Changes

**Rediseño base (tabla → tarjetas):**
- Sustituir la tabla matriz de `AttendanceMatchesTab.tsx` por una lista de tarjetas plegables (`Accordion`), una por jugador — mismo componente/patrón que `AttendanceTrainingsTab.tsx`.
- La cabecera de cada tarjeta muestra: avatar/foto + nombre del jugador, chips-resumen (partidos, titularidades, no convocados, minutos de temporada) y una "tira de forma" compacta (un badge de estado por jornada, limitada a los últimos 5) para escanear la temporada sin desplegar la tarjeta.
- El contenido desplegado lista los partidos en columna (uno por fila): jornada + rival + fecha, etiqueta "Amistoso" cuando aplica (siempre junto al partido, nunca en una cabecera de columna que se pierde al hacer scroll), badge de estado (Titular/Convocado/Desconvocado/No convocado) y minutos jugados.
- Eliminar el scroll horizontal y el `TableContainer` con `max-height` propio: la pestaña usa únicamente el scroll de página.
- Jornadas de liga (`J1, J2...`) y amistosos (`A1, A2...`) se numeran en secuencias independientes; los torneos no se cuentan todavía (soporte pendiente).

**Bug fix (clasificación de amistosos):** `classifyEventType()` en `AttendanceSummaryContent.tsx` no reconocía `eventType: "Amistoso"` (el nombre real que usa el backend) como partido, así que los amistosos se descartaban antes de llegar a la pestaña. Corregido ampliando la regex de clasificación.

**Foto, dorsal y orden (Partidos y Entrenamientos):**
- `PlayerMatchSummary`/`PlayerTrainingSummary` incorporan `photoUrl`, `dorsal` y `position`, poblados en `AttendanceSummaryContent.tsx` desde `teamplayerService` (mismo patrón ya usado para la foto de Entrenamientos).
- Cada tarjeta muestra el avatar del jugador con una insignia de camiseta (SVG) en la esquina superior derecha con el dorsal — azul para jugadores de campo, roja para porteros (detectado por posición, mismo patrón `portero|keeper|arquero` ya usado en Convocatorias/Squad).
- Las tarjetas se ordenan por dorsal ascendente (sin dorsal al final, por nombre); el jugador asociado al usuario logueado (rol Player/Family) aparece siempre primero, igual que ya hacía Entrenamientos.

**Layout:**
- Las pestañas superiores (Dashboard/Entrenamientos/Partidos) muestran solo icono + tooltip en vez de texto, para no cortarse en pantallas estrechas; se conserva el `aria-label` como nombre accesible.
- La rejilla de tarjetas de Partidos usa `grid-template-columns: repeat(auto-fit, minmax(380px, 1fr))` para aprovechar el espacio horizontal en desktop/tablet (varias tarjetas por fila), colapsando a una columna en móvil (`≤640px`), igual que ya hacía Entrenamientos.

## Capabilities

### New Capabilities
- `coach-attendance-matches-tab`: estructura y comportamiento de la pestaña "Partidos" del resumen de asistencia (tarjetas por jugador, identificación de amistosos, foto/dorsal/orden, ausencia de scroll horizontal, rejilla responsive).

### Modified Capabilities
(ninguna — `AttendanceMatchesTab` no tenía spec de OpenSpec previa)

## Impact

- `Front/src/apps/coach/pages/attendance/components/summary/AttendanceMatchesTab.tsx` (reescritura completa del render)
- `Front/src/apps/coach/pages/attendance/components/summary/AttendanceTrainingsTab.tsx` (insignia de camiseta + orden por dorsal añadidos al patrón ya existente)
- `Front/src/apps/coach/pages/attendance/components/summary/AttendanceSummaryContent.tsx` (fix de clasificación de amistosos, `dorsalByKey`/`positionByKey`, orden por dorsal + jugador asociado en ambas pestañas, pestañas con icono)
- `Front/src/apps/coach/pages/attendance/components/summary/types.ts` (`photoUrl`/`dorsal`/`position` en `PlayerMatchSummary` y `PlayerTrainingSummary`)
- `Front/src/apps/coach/pages/attendance/AttendanceSummary.module.css` (clases de tarjeta/fila de partido, insignia de camiseta, rejilla responsive; retirada de las clases `.matchTable*` que dejaron de usarse)
- Tests: `AttendanceMatchesTab.minutesAndFriendly.test.tsx` (reescrito), `AttendanceTrainingsTab.photo.test.tsx`, `AttendanceSummaryContent.friendlyMatchesAndMinutes.test.tsx`, `AttendanceSummaryContent.trainingsPhotoAndOrder.test.tsx` (extendidos), `AttendanceSummaryContent.matchPhotoDorsalAndOrder.test.tsx` (nuevo)
- Sin cambios en el contrato de `AttendanceSummaryContent` hacia sus tabs (misma prop `rows`/`columns`/`onRefresh`/`loading`), ni en backend.
