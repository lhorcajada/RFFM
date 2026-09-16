## Backend

### `Features/Coaches/Teams/Queries/GetTeam.cs`

Añadir un campo al `TeamResponse` record y resolverlo en el handler reutilizando la entidad de
dominio ya existente `RFFM.Api.Domain.Entities.Competitions.MatchDurationMinutesByCategory`
(creada para `GetTeamPlayerStatistics`, sin tocarla):

```csharp
public record TeamResponse(string Id,
    string Name,
    GetTeams.CategoryResponse Category,
    GetTeams.LeagueResponse League,
    GetClubResponse Club,
    string? UrlPhoto,
    string? JoinCode,
    int? RffmCompetitionId,
    int? RffmGroupId,
    int? StandardHalfDurationMinutes); // null si la categoría no es F11 (Youth/U14/U12/U10)
```

En el handler, tras cargar `team`:

```csharp
var hasStandardDuration = MatchDurationMinutesByCategory.TryGetMinutes(team.CategoryId, out var standardMinutes);
return new TeamResponse(team.Id, team.Name,
    new GetTeams.CategoryResponse(team.CategoryId, team.Category.Name),
    ...,
    team.RffmCompetitionId,
    team.RffmGroupId,
    hasStandardDuration ? standardMinutes : null);
```

Añadir `using RFFM.Api.Domain.Entities.Competitions;` si no está ya importado (ya lo usa
`GetTeamPlayerStatistics.cs`, mismo namespace).

### Tests

Si existe un test xUnit para `GetTeam`/`TeamsRequestHandler`, añadir casos: categoría F11 (p.ej.
U10 → `StandardHalfDurationMinutes = 30`) y categoría no F11 (→ `null`). Si no existe archivo de
test para este handler, crear uno mínimo siguiendo el patrón de
`GetTeamPlayerStatisticsHandlerTests.cs` (mismo estilo de Arrange-Act-Assert, mismo DbContext de
test in-memory).

## Frontend

### `services/teamService.ts`

Añadir el campo al tipo existente:

```ts
export type TeamResponse = {
  id: string;
  name: string;
  category: { id: number; name: string };
  ...
  standardHalfDurationMinutes: number | null;
};
```

No hace falta tocar `getTeamById` — ya devuelve el objeto completo del backend.

### `pages/convocations/components/SimulacionTab.tsx` y `PartidoEnDirectoTab.tsx`

Mismo patrón en ambos componentes:

1. `const [team, setTeam] = useState<TeamResponse | null>(null);` + `useEffect` que llama
   `getTeamById(teamId)` al montar (o cuando cambia `teamId`), igual que otros `useEffect` de carga
   ya presentes en estos archivos.
2. Un `useRef(false)` `halfDurationTouchedRef` que se pone a `true` la primera vez que el
   entrenador cambia la duración manualmente. El handler que se pasa a
   `SimulationConfig`/`LiveMatchTimer` como `onHalfDurationChange` pasa a ser un wrapper local:
   ```ts
   const handleHalfDurationChange = useCallback((minutes: number) => {
     halfDurationTouchedRef.current = true;
     sim.setHalfDuration(minutes); // o live.setHalfDuration(minutes)
   }, [sim]);
   ```
3. Un `useEffect` que, cuando `team?.standardHalfDurationMinutes` esté disponible, el partido siga
   en fase previa (`!sim.isRunning && sim.currentMinute === 0` en Simulación /
   `live.matchPhase === "preMatch"` en Directo) y `!halfDurationTouchedRef.current`, llama a
   `sim.setHalfDuration(team.standardHalfDurationMinutes)` / `live.setHalfDuration(...)` una única
   vez. Si `standardHalfDurationMinutes` es `null` (categoría no F11), no se toca nada y se
   mantiene el valor por defecto actual del hook (35 / 45).
4. Pasar `onHalfDurationChange={handleHalfDurationChange}` al componente hijo en vez de
   `sim.setHalfDuration` / `live.setHalfDuration` directamente.

No se cambia la firma pública de `useMatchSimulation`/`useLiveMatch` — toda la lógica nueva vive en
los componentes Tab, que ya son los que orquestan la carga de datos del partido.

### Tests (Vitest + Testing Library)

- `SimulacionTab.matchDurationByCategory.test.tsx` y
  `PartidoEnDirectoTab.matchDurationByCategory.test.tsx` (nuevos, siguiendo el patrón de mocks ya
  usado en los `*.isFriendly.test.tsx` de la misma carpeta):
  - Mockear `getTeamById` devolviendo `standardHalfDurationMinutes: 30` (Alevín) → el campo de
    duración mostrado por `SimulationConfig`/`LiveMatchTimer` debe reflejar 30, no el default
    hardcodeado.
  - Mockear `standardHalfDurationMinutes: null` (categoría no F11) → se mantiene el default
    hardcodeado actual (35 / 45).
  - Si el entrenador cambia la duración manualmente antes de que resuelva el fetch (o justo
    después), el valor manual no se sobrescribe cuando llega la respuesta del team.
