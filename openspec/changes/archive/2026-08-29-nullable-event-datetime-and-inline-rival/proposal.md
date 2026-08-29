## Why

Al crear un evento (partido/entrenamiento) desde Coach, el entrenador a veces no
conoce todavía la fecha/hora exacta ni el rival — esos datos llegan más tarde desde la
federación o por confirmación del club rival. Hoy `POST /api/sport-events` exige
`EveDateTime`/`StartTime` obligatorios (la entidad `SportEvent` lanza si están vacíos o
en el pasado) y solo permite vincular un rival ya existente por `RivalId`, obligando al
entrenador a crear el rival en otra pantalla antes de poder guardar el evento. Esto
bloquea el flujo de "reservar hueco en el calendario ya, completar detalles después"
que `UpdateSportEvent.cs` ya soporta una vez el evento existe.

## What Changes

- **Backend**: `EveDateTime` y `StartTime` de `SportEvent` pasan de `DateTime` a
  `DateTime?` — se puede crear un evento sin fecha/hora y completarla luego vía
  `PUT /api/sport-events/{id}`. **BREAKING** (contrato de `CreateSportEventRequest`,
  `SportEventSaveResponse`, `SportEventResponse`, `SportEventItemResponse`: estos tres
  campos pasan a nullable).
- **Backend**: si no hay `EveDateTime`, no se puede pedir `Recurrence` en el mismo
  `POST` (la recurrencia necesita una fecha ancla) — nueva regla de validación.
- **Backend**: `POST /api/sport-events` acepta un campo opcional `NewRival` (nombre,
  foto, categoría) para crear y vincular un rival nuevo en el mismo submit, alternativo
  a `RivalId` (rival existente). Ambos son opcionales y mutuamente excluyentes; se
  puede seguir creando el evento sin ningún rival.
- **Frontend** (fuera de este alcance de implementación, documentado para
  `front-specialist`): formulario de creación de evento en
  `Front/src/apps/coach` (`/coach/attendance?teamId=`) deja de exigir fecha/hora, y
  añade un modo "rival nuevo" junto al selector de rival existente.

## Capabilities

### New Capabilities
(ninguna — esto extiende una capability existente, no introduce un dominio nuevo)

### Modified Capabilities
- `coach-recurring-events` (o la capability de eventos deportivos que cubra
  `CreateSportEvent`/`SportEvent` si existe con otro nombre — revisar
  `openspec/specs/` antes de generar la delta): `EveDateTime`/`StartTime` pasan a
  opcionales; la recurrencia requiere `EveDateTime`; `CreateSportEvent` admite
  creación de rival inline.

## Impact

- Backend:
  `Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/Assistances/SportEvent.cs`,
  `Domain/Models/EventModel.cs`,
  `Features/Coaches/SportEvents/Commands/CreateSportEvent.cs`,
  `Features/Coaches/SportEvents/Commands/UpdateSportEvent.cs` (ajuste mínimo de
  nulabilidad, sin relajar su validación actual),
  `Features/Coaches/SportEvents/Queries/GetSportEvents.cs`,
  `Features/Coaches/SportEvents/Queries/GetSportEventItem.cs`,
  `Infrastructure/Persistence/Configuration/Aggregates/Assistances/SportEventEntityConfiguration.cs`,
  nueva migración EF Core, y los consumidores internos de
  `SportEvent.EveDateTime`/`.StartTime` (listados en design.md) que hoy asumen
  no-nulo.
- Frontend: `Front/src/apps/coach` — no se toca en este change; se documenta el
  contrato para un change/tarea posterior de `front-specialist`.
- No afecta a Mobile (no consume `CreateSportEvent`/`UpdateSportEvent`).

## Out of Scope

- Cambiar el comportamiento de `UpdateSportEvent` más allá de lo necesario para
  compilar contra la nueva nulabilidad de la entidad — sigue exigiendo
  `EveDateTime`/`StartTime` como hoy (ya permite completarlos después de un create sin
  fecha, que es justo el flujo que este change habilita).
- Implementar el frontend del formulario de creación de evento (se delega a
  `front-specialist` con el contrato documentado en design.md).
- Cambiar `SyncCalendarFromFederation` más allá de lo estrictamente necesario para
  compilar (siempre recibe fecha real de la federación).
