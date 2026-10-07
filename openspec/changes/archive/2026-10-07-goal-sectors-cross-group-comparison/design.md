## Context

- Endpoint: `Back/ExtractionApi/src/RFFM.Api/Features/Federation/Teams/Queries/GetGoalSectors.cs`
  (`IFeatureModule` + `IQueryApp<List<GoalSectorsResponse>>`). Hoy: un `competitionId`/`groupId`, ids RFFM
  literales por defecto, una sola `MatchTime`, actas con temporada `21` hardcodeada, `throw new Exception`
  si faltan equipos.
- Front: `GoalSectorsComparison.tsx` + `hooks/useGoalSectorsComparison.ts`; filtro en
  `shared/components/ui/StatsControls` y gráfica/tarjetas en `SectorChart` / `SectorDataTable`. Los tres
  componentes compartidos solo los usa esta página.
- `GoalSectorsAggregator` está registrado pero no lo usa nadie; no se toca.

## Decisions

### D1 — Contrato de API retrocompatible
Se mantiene la ruta. Parámetros:

```csharp
app.MapGet("/teams/{teamCode}/goal-sectors", async (IMediator mediator, CancellationToken ct,
        int competitionId, int groupId, int teamCode1, int teamCode2,
        int? competitionId2, int? groupId2) =>
    {
        var request = new QueryApp(
            new TeamSelection(teamCode1, competitionId, groupId),
            new TeamSelection(teamCode2, competitionId2 ?? competitionId, groupId2 ?? groupId));
        return Results.Ok(await mediator.Send(request, ct));
    })
```

- Los `int` no anulables sin default hacen que Minimal API devuelva `400` si faltan (igual que
  `GetCalendarRequiredParamsTests`). Se eliminan los ids literales por defecto.
- `public record TeamSelection(int TeamCode, int CompetitionId, int GroupId);`
  `public record QueryApp(TeamSelection Team1, TeamSelection Team2) : IQueryApp<List<GoalSectorsResponse>>;`
  — el record forma parte de la clave de caché del `CachingBehavior`, así que dos combinaciones distintas no
  colisionan.
- Se elimina el `throw new Exception("No hay equipos que comparar")` (ya no es alcanzable).

### D2 — Cálculo por equipo
El handler procesa cada `TeamSelection` con un método privado `BuildTeamAsync(selection, competitions, ct)`:

1. `matchTime = competitions.FirstOrDefault(c => c.CompetitionId == selection.CompetitionId)?.MatchTime ?? 90`
   (se pide `GetCompetitionsAsync` una sola vez).
2. Calendario `GetCalendarAsync(selection.CompetitionId, selection.GroupId)` → partidos ya jugados del equipo.
3. Actas con `rffmOptions.Value.CurrentSeasonId` (inyectar `IOptions<RffmOptions>`), competición y grupo
   del propio equipo.
4. `AgroupGoalsBySector` existente sin cambios de lógica.
5. `response.MatchTime = matchTime`.

`GoalSectorsResponse` gana `public int MatchTime { get; set; }`.

### D3 — Filtro de página nuevo (reemplaza `StatsControls`)
Nuevo `pages/Statistics/Components/GoalSectorsComparisonFilters.tsx` (+ `.module.css`), específico de la
página (react.md §3.2):

```
<RffmSeasonSelector />
<Grid container spacing={2}>
  <Grid item xs={12} md={6}><TeamSidePanel title="Equipo 1" idPrefix="team1" … /></Grid>
  <Grid item xs={12} md={6}><TeamSidePanel title="Equipo 2" idPrefix="team2" … /></Grid>
</Grid>
```

- `TeamSidePanel` (mismo directorio): `Paper` con `role="group"` y `aria-label={title}`, apila
  `CompetitionSelector`, `GroupSelector` y el `Select` de equipo. Carga los equipos con
  `getTeamsForClassification({ season, competition, group })` (misma lógica que hoy en `StatsControls`).
- Estado controlado por el padre: `type TeamSide = { competitionId: string; groupId: string; teamCode: string }`.
  `value: { team1: TeamSide; team2: TeamSide }` + `onChange`.
- Prefill: `getSettingsForUser(user.id)` → combinación principal → ambos lados (y `applySeasonId`), igual
  que hoy; se vuelve a cargar en `rffm.saved_combinations_changed`. `useClearOnSeasonChange` limpia ambos.
- Al cambiar competición de un lado → limpia grupo+equipo de ese lado; grupo → limpia equipo.
- `CompetitionSelector` y `GroupSelector` ganan prop opcional `idPrefix` para que `labelId` sea único
  (`${idPrefix}-competition-select-label`); sin `idPrefix` se mantiene el id actual. Necesario porque hay
  dos instancias en la página.
- Se borran `shared/components/ui/StatsControls/StatsControls.tsx` y su `.module.css` (con los
  `:global(.MuiOutlinedInput-*)` que contaminaban la app). Ajustes de tamaño, si hacen falta, vía `sx`
  local o el CSS Module nuevo con selectores con scope.
- El botón «Comparar» sigue en `actionBar`; habilitado si ambos lados están completos.

### D4 — Comparación por tramo
`shared/utils/goalSectors.ts`:

```ts
export type SectorComparisonRow = {
  index: number;
  aStart: number; aEnd: number;
  bStart: number; bEnd: number;
  aGoals: number; aAgainst: number;
  bGoals: number; bAgainst: number;
};
export function buildSectorComparisonRows(a: TeamGoalSectors, b: TeamGoalSectors): SectorComparisonRow[];
export function formatSectorLabel(row: SectorComparisonRow): string; // "1-15'" | "1-14' / 1-15'"
```

- Empareja por índice tras ordenar por `startMinute`; filtra filas todo-cero. `TeamGoalSectors` gana
  `matchTime: number`.
- `SectorDataRow` se sustituye por `SectorComparisonRow`. `SectorChart` recibe `rows` + totales/nombres en
  vez de recalcular el merge (elimina la lógica duplicada del hook y la gráfica); `SectorDataTable` usa
  `formatSectorLabel`.

### D5 — Hook
`useGoalSectorsComparison`:
- `selection: { team1: TeamSide; team2: TeamSide }`.
- `handleCompare` llama a `getTeamsGoalSectorsComparison({ teamCode: team1.teamCode, competitionId, groupId,
  teamCode1, teamCode2, competitionId2, groupId2 })` (`TeamService` añade los dos params).
- La selección usada en la última comparación se guarda (`comparedSelection`) para que el popup no cambie
  si el usuario toca el filtro después.
- `handleGoalsAgainstClick(row, teamIndex)`: competición/grupo del lado comparado, `matchTime` del equipo
  para `resolveSectorMinute`, y rango `aStart/aEnd` o `bStart/bEnd` según el lado. La clave de caché
  incluye competición y grupo del lado.

## Risks / Trade-offs

- Comparar 80' con 90' por tramo compara periodos de distinta longitud absoluta; es la opción elegida por
  el usuario y la etiqueta lo hace explícito.
- Dos calendarios + dos listas de actas por petición si los grupos difieren: coste similar al actual
  (las actas ya se piden por equipo) y la respuesta queda cacheada 1h.
