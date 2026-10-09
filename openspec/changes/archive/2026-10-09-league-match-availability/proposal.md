## Why

Hoy, en un partido de liga, el entrenador convoca directamente a toda la lista de espera
(«Convocar toda la lista de espera») y después cada jugador acepta o rechaza. El entrenador no
sabe quién puede jugar **antes** de decidir la convocatoria, así que convoca a gente que luego no
puede ir y tiene que desconvocar a mano. Además las listas no están ordenadas por posición, y
cuesta ver si hay suficientes porteros, defensas, etc.

## What Changes

- **Nueva fase «Disponibilidad»** solo para **partidos de liga** (`SportEventType` «Partido», id 1).
  Amistosos, torneos, entrenamientos y el resto de eventos no cambian.
- En la lista de espera de un partido de liga, el botón «Convocar toda la lista de espera» se
  sustituye por **«Pedir disponibilidad»**. Se crea una petición para cada jugador de la lista de
  espera, salvo los lesionados y los sancionados. El jugador y sus familiares reciben un aviso
  (notificación interna + Web Push):
  «¿{Jugador}, estás disponible para el partido «{evento}» el próximo {dd/MM} a las {HH:mm}?».
- **Respuesta del jugador/familiar** (en la pantalla del evento y en «Próximos eventos» del panel):
  - **Sí** → pasa a **«Disponibles»**.
  - **No** → la app pide el motivo (los mismos de ahora, sin «Decisión técnica» ni
    «Sanción deportiva») y pasa a **«Desconvocados»** con ese motivo.
  - El entrenador recibe un aviso con cada respuesta.
- **Mientras no responden**, los jugadores aparecen en un grupo nuevo, **«Pendientes de
  respuesta»**.
- **Desde «Disponibles»**, el entrenador decide:
  - **Convocar** → pasa directamente a **«Convocados»** como *aceptado*. No hace falta que el
    jugador vuelva a aceptar. El jugador recibe el aviso «ha sido convocado».
  - **Desconvocar** → pasa a **«Desconvocados»** con el motivo automático **«Decisión técnica»**.
- **Agrupación por posición** en todas las listas de la pestaña «Convocatoria», para cualquier
  tipo de evento: **Porteros**, **Defensas** (centrales, laterales, carrileros, líbero), **Medios**
  (todos los medios, incluido el mediocampista ofensivo), **Extremos**, **Delanteros** (delantero
  centro y segundo delantero) y «Sin posición».
- **Versiones**: API minor (`1.22.0`), Web minor (`1.35.0`). Mobile no cambia.

## Capabilities

### New Capabilities
- `league-match-availability`: petición y respuesta de disponibilidad previa a la convocatoria
  de un partido de liga, y agrupación por posición de las listas de convocatoria.

## Impact

- `Back/ExtractionApi`:
  - nueva entidad `AvailabilityRequest` + `AvailabilityRequestStatus` + migración;
  - `Features/Coaches/Availability/`: pedir disponibilidad, consultar, responder y decidir;
  - `IWebPushNotificationDispatcher`: tres avisos nuevos;
  - `GetEventAttendanceSummary` (disponibilidad del propio jugador).
- `Front`: `AttendanceTabs.tsx` (grupos nuevos, botón, acciones), `availabilityService.ts`,
  `utils/positionGroups.ts`, `PositionGroupedList`, `AvailabilityResponseDialog`,
  `UpcomingEventsWidget.tsx`, `AttendanceEvent.tsx` (prop `isLeagueMatch`).
- **Fuera de alcance**: recordatorios push a «Pendientes de respuesta»; flujo de disponibilidad
  en Mobile; aplicarlo a amistosos y torneos; caducidad automática de las peticiones sin
  respuesta; cambiar las estadísticas existentes de convocatoria y asistencia (la disponibilidad
  no es una convocatoria y no cuenta en ellas).
