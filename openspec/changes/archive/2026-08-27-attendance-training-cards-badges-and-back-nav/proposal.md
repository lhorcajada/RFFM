## Why

En el listado de eventos de `coach/attendance` (`EventCard.tsx`), las tarjetas de tipo
Entrenamiento no muestran de un vistazo dos datos clave que el entrenador necesita para
decidir si entrar a un evento: la hora de llegada y si la convocatoria ya tiene
jugadores citados. Hoy la hora de llegada solo aparece en el detalle del evento
(`AttendanceEvent.tsx`), y el estado de la convocatoria no aparece en ningún sitio de la
lista. Además, el botón "Volver" del detalle de evento (`AttendanceEvent.tsx`) usa
`useTeamDashboardBack()` y navega siempre al dashboard del equipo, en vez de volver al
listado de eventos del que vino el entrenador — obligándole a re-navegar manualmente
cada vez que revisa varios eventos.

## What Changes

- **Backend**: `GET /api/sport-events/{teamId}` (`GetSportEvents.cs`) añade un campo
  `HasConvokedPlayers: bool` a `SportEventResponse`, calculado con una subconsulta
  `_db.Convocations.Any(c => c.SportEventId == sportEvent.Id)` por evento — evita que el
  frontend tenga que llamar a `/api/events/{eventId}/convocations` por cada tarjeta
  visible (N+1).
- **Frontend**:
  - `sportEventService.ts`: añade `hasConvokedPlayers?: boolean | null` a
    `SportEventResponse`.
  - `EventCard.tsx` (solo para tarjetas no-partido cuyo `eventTypeName` sea
    "Entrenamiento"): añade un chip resaltado con la hora de llegada
    (`event.arrivalDate`/`event.arrival`, mismo parseo ya usado en
    `AttendanceEvent.tsx`) y un chip de estado de convocatoria — "Convocatoria abierta"
    (con convocados) o "Convocatoria sin iniciar" (sin convocados) — más una variante de
    borde de la tarjeta (`.cardConvocationOpen` / `.cardConvocationPending`, mismo
    patrón que el `.cardMatch` ya existente) según ese mismo estado.
  - `AttendanceEvent.tsx`: sustituye `goToTeamDashboard()` en el botón "Volver" por
    navegación al listado de eventos (`/coach/attendance` con el `teamId` del evento
    cargado como query param, mismo patrón de `resolveTeamDashboardPath`), coherente con
    el botón "Volver al listado" que ya existe en la rama de evento no encontrado.

## Impact

- Backend: `Features/Coaches/SportEvents/Queries/GetSportEvents.cs`.
- Frontend: `apps/coach/services/sportEventService.ts`,
  `apps/coach/pages/attendance/EventCard.tsx`,
  `apps/coach/pages/attendance/EventCard.module.css`,
  `apps/coach/pages/attendance/AttendanceEvent.tsx`.
- No afecta a Mobile ni a la app Federación.

## Out of Scope

- Mostrar la hora de llegada o el estado de convocatoria en tarjetas de Partido/Torneo —
  solo Entrenamiento, según lo pedido.
- Cambiar el botón "Volver" de otras páginas que también usan `useTeamDashboardBack()` —
  solo el de `AttendanceEvent.tsx`.
- Contar o listar los jugadores convocados en la tarjeta (solo se indica sí/no hay
  convocados).
