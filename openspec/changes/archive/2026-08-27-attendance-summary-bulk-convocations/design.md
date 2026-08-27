## Context

`AttendanceSummaryContent.tsx` ya carga todos los eventos del equipo con
`sportEventService.getSportEvents` (paginado, O(páginas) no O(eventos) — se mantiene
igual). El problema es lo que hace **por cada evento** después de tener esa lista:

```ts
const eventsWithConvocations = await Promise.all(
  allEvents.map(async (event) => {
    const convocations = await convocationService.getConvocations(event.id);
    return { event, convocations };
  })
);
// ...
const matchLineups = await Promise.all(
  officialMatchEvents.map(async ({ event }) => {
    try {
      return { eventId: event.id, lineup: await getIdealLineup(teamId, event.id) };
    } catch {
      return { eventId: event.id, lineup: null };
    }
  })
);
```

`getIdealLineup(teamId, seasonId)` (`GetTeamIdealLineup.cs`) solo depende de
`teamId`+`seasonId`; pasar `event.id` en el segundo parámetro es un bug — el backend lo
usa como `seasonId` y siempre resuelve al mismo (único) ideal lineup del equipo. Por eso
`matchLineups` repite la misma llamada `officialMatchEvents.length` veces con distintos
resultados de "acierto" según si ese `event.id` casualmente coincide con algún
`seasonId` real (normalmente 404 → `null` para todos).

## Goals / Non-Goals

**Goals**
- Una sola llamada HTTP para obtener las convocaciones de **todos** los eventos del
  equipo (sustituye el `Promise.all` de N llamadas).
- Una sola llamada a `getIdealLineup` con el `seasonId` real (no `event.id`).
- Cero cambios de comportamiento visible en Dashboard/Entrenamientos/Partidos.

**Non-Goals**
- No se toca `GetTrainingAttendanceSummary` (ya es de una sola llamada, se sigue
  usando).
- No se resuelve aquí si el ideal lineup "debería" variar por evento — solo se corrige
  la llamada duplicada; el comportamiento con `seasonId` real es el mismo que ya se usa
  en el resto de la pantalla (`new URLSearchParams(window.location.search).get("seasonId")`).
- No se pagina ni cachea el nuevo endpoint.

## Decisions

### Backend: `GetTeamConvocationsSummary`

Nuevo feature `Features/Coaches/Assistances/Queries/GetTeamConvocationsSummary.cs`,
mismo patrón vertical-slice que `GetTrainingAttendanceSummary.cs` y mismo shape de fila
que `GetEventConvocations.ConvocationResponse` (para reutilizar tipos en frontend), con
un campo adicional `EventId`:

```csharp
app.MapGet("/api/attendance/team-convocations/{teamId}",
    [Authorize] async (string teamId, IMediator mediator, CancellationToken ct) =>
        Results.Ok(await mediator.Send(new Query { TeamId = teamId }, ct)))
    .WithName(nameof(GetTeamConvocationsSummary))
    .WithTags("Assistances")
    .Produces<ConvocationRow[]>();

public record Query : IQueryApp<ConvocationRow[]>, IRequireFeaturePermission
{
    public string TeamId { get; init; } = null!;
    public string FeatureRoute => CoachFeatureRoutes.AttendanceSummary;
    public string RequiredPermission => "Read";
}

public record ConvocationRow(
    string EventId,
    string ConvocationId,
    string TeamPlayerId,
    string? PlayerId,
    string Alias,
    int? StatusId,
    int? ExcuseTypeId,
    int? AssistanceTypeId);
```

Handler: una sola query a `_db.Convocations.AsNoTracking()` filtrando por
`c.Player.TeamId == request.TeamId` (o join con `SportEvents` por `TeamId`, igual que
`GetTrainingAttendanceSummary` filtra por `trainingEventIds`), proyectando directamente
a `ConvocationRow` — sin bucles por evento en el servidor tampoco.

No se incluyen datos de evento (fecha, rival, tipo) en la respuesta: el frontend ya los
tiene de `sportEventService.getSportEvents`, así que no se duplican para mantener el
payload pequeño y el endpoint simple.

### Frontend: consumir en una sola llamada

- `attendanceSummaryService.ts`: añade

  ```ts
  export type TeamConvocationRow = {
    eventId: string;
    convocationId: string;
    teamPlayerId: string;
    playerId?: string | null;
    alias: string;
    statusId?: number | null;
    excuseTypeId?: number | null;
    assistanceTypeId?: number | null;
  };

  export async function getTeamConvocationsSummary(
    teamId: string
  ): Promise<TeamConvocationRow[]> {
    const resp = await client.get<TeamConvocationRow[]>(
      `/api/attendance/team-convocations/${teamId}`
    );
    return resp.data;
  }
  ```

- `AttendanceSummaryContent.tsx`:
  - Sustituye el `Promise.all(allEvents.map(getConvocations))` por una llamada única
    `const allConvocations = await attendanceSummaryService.getTeamConvocationsSummary(teamId)`,
    agrupada localmente por `eventId` (`Map<string, TeamConvocationRow[]>`) para
    reconstruir la misma forma que `eventsWithConvocations` (adaptando `ConvocationRow`
    al shape `ConvocationItem` que ya consume el resto del archivo: `player.id`,
    `player.playerId`, `player.alias`, `status`, `assistanceTypeId`).
  - Sustituye el `Promise.all(officialMatchEvents.map(getIdealLineup))` por una única
    llamada `const lineup = await getIdealLineup(teamId, seasonId)` (el mismo `seasonId`
    ya calculado más abajo para `getTrainingAttendanceSummary`, movido antes de este
    bloque), y usa ese mismo `lineup` para todos los eventos al construir
    `lineupByEventId` (todas las entradas apuntan al mismo lineup, ya que es un valor
    por equipo/temporada, no por evento).

## Risks / Trade-offs

- El nuevo endpoint devuelve todas las convocaciones del equipo en una respuesta; para
  equipos con temporadas muy largas esto es más payload que N respuestas pequeñas, pero
  sigue siendo 1 round-trip en vez de N — mismo trade-off ya aceptado por
  `GetTrainingAttendanceSummary`.
- Si en el futuro el ideal lineup pasa a depender del evento (partido concreto), esta
  simplificación habría que revertirla — está documentado como asunción explícita en
  Non-Goals.

## Migration Plan

Sin migración de datos. Cambio de código puro (nuevo endpoint + refactor de consumo).
Desplegar backend antes que frontend (el frontend nuevo depende del endpoint nuevo);
mientras tanto el frontend actual sigue funcionando contra el backend actual sin
romperse (no se toca ningún endpoint existente).
