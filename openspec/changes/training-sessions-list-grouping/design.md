## Context

- `GetSessions` (`Features/Coaches/Trainings/Sessions/GetSessions.cs`) recibe solo `teamId` y devuelve
  todas las sesiones del equipo. Cada `SessionListItem` lleva `MicrocicloId` y `MicrocicloWeekLabel`.
- `TrainingSession` no tiene `SeasonId`. La temporada se deduce de:
  - el plan: `Microciclo → Mesociclo → Macrociclo → SeasonPlan.SeasonId`;
  - la fecha: `Season.StartDate`–`Season.EndDate`.
- Otros consumidores de `getSessions(teamId)`: `useContentBoardData` y `useRecentSessions`. No deben
  cambiar.
- `Trainings.tsx` ordena las sesiones por fecha ascendente con las sin fecha al final (lo fija
  `Trainings.sessionsOrderAndViewPrint.test.tsx`); ese orden se sustituye.

## Decisions

### D1 · API: filtro por temporada

- `GetSessionsQuery(string TeamId, string UserId, string? SeasonId = null)`. El endpoint enlaza
  `string? seasonId` desde la query string.
- Si llega `SeasonId`, se carga la temporada (`AsNoTracking`). Si no existe → `DomainException` con
  `ErrorCodes` de temporada no encontrada (`404`, mismo patrón que el resto de features).
- Los ids de microciclo de la temporada se obtienen con un join
  `Microciclos ⋈ Mesociclos ⋈ Macrociclos ⋈ SeasonPlans` filtrando `TeamId` y `SeasonId`.
- Filtro (inclusivo por día):
  ```csharp
  s.MicrocicloId != null
      ? seasonMicrocicloIds.Contains(s.MicrocicloId)
      : s.Date == null || (s.Date >= season.StartDate && s.Date < season.EndDate.AddDays(1))
  ```
- El orden de la query no cambia (el front ordena).

### D2 · API: jerarquía en el listado

- El diccionario de microciclos pasa de `WeekLabel` a una proyección con la jerarquía:
  ```csharp
  record MicrocicloInfo(string WeekLabel, int Order, DateOnly StartDate, DateOnly EndDate,
      string MesocicloId, string MesocicloName, int MesocicloOrder,
      string MacrocicloId, string MacrocicloName, int MacrocicloOrder);
  ```
- `SessionListItem` añade al final (nullables): `MicrocicloOrder`, `MicrocicloStartDate`,
  `MicrocicloEndDate`, `MesocicloId`, `MesocicloName`, `MesocicloOrder`, `MacrocicloId`,
  `MacrocicloName`, `MacrocicloOrder`.

### D3 · Front: servicio y tipos

- `getSessions(teamId, seasonId?)` añade `seasonId` a `params` solo si viene.
- `TrainingSession` añade los campos de D2 como opcionales.

### D4 · Front: agrupación (lógica pura)

`pages/trainings/sessionsGrouping.ts`:
```ts
type MicrocicloGroup = { id; label; order; sessions: TrainingSession[] };
type MesocicloGroup = { id; name; order; microciclos: MicrocicloGroup[] };
type MacrocicloGroup = { id; name; order; mesociclos: MesocicloGroup[] };
type SessionGroups = { macrociclos: MacrocicloGroup[]; free: TrainingSession[] };
export function groupSessions(sessions: TrainingSession[]): SessionGroups;
```
- Sesiones dentro de un microciclo: por fecha descendente (sin fecha al final).
- Microciclos, mesociclos y macrociclos: por `order` descendente (el plan es cronológico, así el más
  reciente queda arriba).
- `free`: primero las sin fecha, después por fecha descendente.

### D5 · Front: componente `SessionsList`

- `pages/trainings/components/SessionsList.tsx` (+ `SessionsList.module.css`). Recibe las sesiones, la
  selección y los callbacks de las acciones. La tarjeta de sesión se mueve tal cual desde
  `Trainings.tsx` (subcomponente `SessionCard` en el mismo archivo).
- `Accordion` de MUI por nivel (mismo patrón que `SeasonPlanEditor`). Expandidos por defecto: el primer
  macrociclo, su primer mesociclo y su primer microciclo, y «Sesiones libres».
- Cabeceras con contador: «Semana 1 · 3 sesiones».
- «Sesiones libres» muestra `FREE_PAGE_SIZE = 10` y «Ver más» suma 10.
- Sin tablas; tarjetas apiladas (responsive).

### D6 · Front: selector de temporada en `Trainings.tsx`

- Se cargan las temporadas del club con `seasonService.getSeasons(clubId)`; el valor por defecto es la
  activa (ya se carga en `seasonId`).
- Estado propio `sessionsSeasonId` (inicializado con la activa), para no tocar la temporada de la
  pestaña Planificación.
- La carga de sesiones depende de `[teamId, sessionsSeasonId]` y no se lanza hasta tener temporada
  (si el club no tiene temporada activa, se pide sin `seasonId`).

## Tests

- Back (Postgres, `GetSessionsHandlerTests`): plan de la temporada / de otra temporada, libre dentro y
  fuera de fechas, sin fecha, sin `seasonId`, y la jerarquía en el item.
- Front:
  - `sessionsGrouping.test.ts`: agrupación, orden y grupo de libres;
  - `trainingService`: envía `seasonId`;
  - `SessionsList.test.tsx`: cabeceras y «Ver más»;
  - `Trainings.sessionsSeasonFilter.test.tsx`: temporada por defecto y cambio de temporada;
  - se actualiza el test de orden de `Trainings.sessionsOrderAndViewPrint.test.tsx`.
