## Context

- `rival-match-simulation` ya calcula, con `SeasonSimulator.Run(SimulationInput)` (determinista,
  semilla fija), las predicciones de los partidos pendientes y la clasificación proyectada.
  `GetRivalSimulation.Handler` carga calendario (`RffmRound`/`RffmMatch`), puntos y sanciones
  (`RffmCompetitionGroup`) y plantillas (`LeagueSquadStatsReport` + `RffmPlayerSeasonStats`).
- Modelo hermano para guardar algo por jornada: `RffmStandingsSnapshot` (`GroupCode` + `Round`,
  payload `jsonb`, índice único).
- Las migraciones de `FederationDbContext` viven en `Infrastructure/Migrations/Federation/` y se crean con
  `.\manage-migrations.ps1 -Action create -Context FederationDbContext -MigrationName ...`.

## Goals / Non-Goals

**Goals**: guardar la simulación previa a cada jornada; rellenar las jornadas pasadas «como si no se
supiera el resultado»; comparar predicción y resultado real (1X2) por partido, por jornada y en total;
ver la clasificación proyectada de cada jornada.

**Non-Goals**: acierto por marcador exacto; recalcular simulaciones congeladas; Mobile.

## Decisions

### D1 — Entidad `RffmRoundSimulation` (FederationDbContext)

`Domain/Entities/Federation/Results/RffmRoundSimulation.cs`, compartida por todos los equipos de Coach
que juegan la liga (igual que `RffmStandingsSnapshot`):

```csharp
public class RffmRoundSimulation : BaseEntity
{
    public string GroupCode { get; private set; }
    public int SeasonId { get; private set; }
    public int Round { get; private set; }
    public int PlayedMatchesUsed { get; private set; }
    public bool UsesSquadStrength { get; private set; }
    public string MatchesJson { get; private set; }    // jsonb: predicciones de los partidos de la jornada
    public string StandingsJson { get; private set; }  // jsonb: clasificación proyectada en ese momento
    public DateTime ComputedAt { get; private set; }
    public DateTime? FrozenAt { get; private set; }
    public bool IsFrozen => FrozenAt.HasValue;

    public static RffmRoundSimulation Create(string groupCode, int seasonId, int round, RoundSimulationData data, DateTime now);
    public bool Replace(RoundSimulationData data, DateTime now); // false (sin cambios) si está congelada
    public void Freeze(DateTime now);                             // idempotente
}
public record RoundSimulationData(int PlayedMatchesUsed, bool UsesSquadStrength, string MatchesJson, string StandingsJson);
```

Configuración en `RffmResultsEntityConfiguration.cs` (`RffmRoundSimulations`, `jsonb`, `Ignore(IsFrozen)`,
índice único `GroupCode + Round`). Migración `AddRffmRoundSimulations` (commit separado).

### D2 — Simulación «a fecha de» una jornada (dominio, puro)

`Domain/Services/MatchSimulation/SimulationAsOf.cs`:

```csharp
public static SimulationInput AsOfRound(SimulationInput input, int round, bool ignoreCurrentInvolvement)
```

- Los partidos con `Round >= round` pierden su resultado (pasan a pendientes); los anteriores se
  conservan tal cual (con o sin resultado).
- Con `ignoreCurrentInvolvement`, los campos de temporada actual de cada `SimPlayer`
  (`CurrentCalled/Starter/Substitute`) pasan a 0: la implicación actual ya contiene las jornadas que
  se quieren «olvidar», así que todos los jugadores pesan igual (el 0.25 base de D2 de la simulación).

`RoundStatus` (`Upcoming`, `InProgress`, `Played`) y `RoundSimulationPolicy`:

```csharp
public static RoundStatus Status(IReadOnlyList<SimMatch> roundMatches, DateOnly today);
// Played: todos con resultado; InProgress: alguno con resultado o la fecha más temprana de sus
// partidos ≤ today; Upcoming: el resto (sin fechas y sin resultados → Upcoming).
public static IReadOnlyList<int> RoundsToSimulate(IReadOnlyList<SimMatch> calendar, DateOnly today);
// Todas las jornadas desde la primera hasta la primera Upcoming incluida (si no hay Upcoming, todas).
public static MatchOutcomeKind PredictedOutcome(MatchOutcome outcome);
// Mayor probabilidad; empate de probabilidades: Draw > Home > Away.
public static MatchOutcomeKind ActualOutcome(int localGoals, int visitorGoals);
```

`MatchOutcomeKind` = enum interno del modelo `Home | Draw | Away`, serializado como texto en la API.

### D3 — Servicio de simulaciones por jornada

`Features/Coaches/RivalStats/Services/RivalSimulationInputLoader.cs`: se extrae de
`GetRivalSimulation.Handler` la carga de calendario, equipos, puntos, sanciones y plantillas
(`LoadAsync(RivalStatsLeague, ct) → RivalSimulationData?` con `Input`, `Teams` por código y
`UsesSquadStrength`). `GetRivalSimulation` pasa a usarlo sin cambiar su contrato.

`Features/Coaches/RivalStats/Services/RivalRoundSimulationService.cs` (scoped,
`FederationDbContext`, `RivalSimulationInputLoader`, `TimeProvider`):

```
SyncAsync(league, ct):
  data = loader.LoadAsync(league); si null → return
  today = DateOnly(UTC de TimeProvider)
  existing = simulaciones del GroupCode
  para cada round en RoundsToSimulate(calendar, today):
    status = Status(partidos de round, today); started = status != Upcoming
    snapshot = existing[round]
    si snapshot?.IsFrozen → continuar
    si started y snapshot != null → snapshot.Freeze(now)            // última predicción previa al inicio
    si no:
      result = SeasonSimulator.Run(AsOfRound(data.Input, round, ignoreCurrentInvolvement: started))
      payload = predicciones de los partidos de ESA jornada + clasificación proyectada (mismos
                records que la respuesta de GetRivalSimulation, D5)
      crear o Replace; si started → Freeze(now)
  SaveChanges (DbUpdateException por índice único → otra petición concurrente ya guardó: se ignora)
```

Registro en `ServiceCollectionExtensions` junto a los servicios de rival-stats.

### D4 — Endpoints

`Features/Coaches/RivalStats/SyncRivalSimulationRounds.cs`:
`PUT /api/teams/{teamId}/rival-stats/simulation/rounds` → `ICommand` (`SyncRivalSimulationRoundsCommand(TeamId)`,
`IRequireFeaturePermission` Convocations/Read, `IRequireTeamMembership`) + `Validator` (`TeamId`
obligatorio) → `204`. Idempotente: volver a llamarlo no cambia simulaciones congeladas. `409`/`404` de
`RivalStatsLeague.ResolveAsync`. Se usa `PUT` porque sincroniza un recurso (el historial) sin crear uno
nuevo por llamada.

`Features/Coaches/RivalStats/GetRivalSimulationHistory.cs`:
`GET /api/teams/{teamId}/rival-stats/simulation/rounds` → `IRequest` (sin caché, como el resto del
feature):

```csharp
public record RivalSimulationHistoryResponse(string? OwnTeamCode, int TotalHits, int TotalEvaluated,
    List<RoundSimulationResponse> Rounds);
public record RoundSimulationResponse(int Round, DateOnly? Date, string Status, bool IsFrozen, DateTime ComputedAt,
    int PlayedMatchesUsed, bool UsesSquadStrength, int Hits, int Evaluated,
    List<RoundMatchResponse> Matches, List<RoundStandingResponse> Standings);
public record RoundMatchResponse(/* campos de MatchPredictionResponse */,
    string PredictedOutcome, int? ActualLocalGoals, int? ActualVisitorGoals, string? ActualOutcome, bool? Hit);
public record RoundStandingResponse(/* campos de ProjectedStandingResponse */, int? ActualPosition, int? ActualPoints);
```

- Rondas ordenadas por número; solo las que tienen simulación guardada.
- Resultado real: el partido actual de la misma jornada con mismo local y visitante. `Hit` solo si
  tiene resultado. `Evaluated` = partidos con resultado; `Hits` = aciertos; totales = suma.
- `Status` y `Date` (fecha más temprana de sus partidos) con D2 sobre el calendario actual.
- `ActualPosition`/`ActualPoints`: clasificación real actual (misma ordenación simplificada que el
  simulador: puntos − sanción, DG, GF, nombre), igual para todas las jornadas.
- Sin calendario → `RivalSimulationHistoryResponse` con listas vacías (no 404: el historial vacío es
  un estado válido).

### D5 — Contratos compartidos

`MatchPredictionResponse` y `ProjectedStandingResponse` se mueven de `GetRivalSimulation` a
`Features/Coaches/RivalStats/RivalSimulationContracts.cs` (mismo namespace y forma JSON) para
serializarlos en `MatchesJson`/`StandingsJson` y reutilizarlos en el historial. El mapeo
`SimulationResult → respuestas` (redondeos incluidos) pasa a `RivalSimulationMapper`.

### D6 — Front

- `rivalStatsService.ts`: tipos `MatchOutcomeKind`, `RoundStatus`, `RoundMatch`, `RoundStanding`,
  `RoundSimulation`, `RivalSimulationHistory`; `syncRivalSimulationRounds(teamId)` (PUT) y
  `getRivalSimulationHistory(teamId)` (GET).
- `useRivalSimulation.ts`: además de la simulación actual devuelve `history`; antes de pedir el
  historial llama a `syncRivalSimulationRounds` (si falla, se pide igualmente el historial guardado).
  Si falla el historial, `history = null` y la página sigue mostrando la simulación actual.
- `MatchPredictionCard`: prop opcional `result?: { localGoals: number; visitorGoals: number; hit: boolean }`.
  Con resultado: línea «Resultado: 2 - 1», chip «Acertado» (color `success`) o «Fallado» (`error`) y
  borde/franja del mismo color (clases `hit`/`miss` en CSS Module).
- `ProjectedStandingCard`: prop opcional `actualPosition?: number | null` → «Puesto real: 3º».
- `RivalSimulation.tsx`:
  - «Partidos»: `Select` «Ver» con «Próximos partidos» (vista actual) y «Jornada N» por cada jornada
    guardada (etiqueta con «· jugada» / «· en juego» según `status`). Por defecto «Próximos
    partidos». En una jornada guardada: resumen «Aciertos en la jornada: 3 de 4» (si `evaluated > 0`)
    y tarjetas con `result`. Encima del selector, si `totalEvaluated > 0`: «Aciertos totales: 5 de 8
    (63 %)». El filtro «Solo mi equipo» se aplica en ambas vistas.
  - «Clasificación»: `Select` «Proyección» con «Actual» y «Antes de la jornada N»; en una jornada
    guardada las tarjetas usan su `standings` (orden guardado) con `actualPosition`.
- Sin tablas, tarjetas desde 360px, CSS Modules + tema Coach.

## Risks / Trade-offs

- **Jornadas rellenadas a posteriori**: no usan la implicación actual de los jugadores (D2), así que
  pueden diferir algo de lo que se habría predicho en su momento; se marcan igual que las demás.
- **Partidos aplazados**: un partido de una jornada anterior jugado más tarde cuenta en las
  simulaciones calculadas después de jugarse; las congeladas no cambian.
- **PUT al abrir la página**: escribe en BD en cada visita mientras haya jornadas sin congelar
  (como mucho la próxima jornada). Coste: una simulación por jornada no congelada (< 1 s).
