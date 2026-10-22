## Context

- **Resultados y calendario** de la liga del equipo: `RffmRound` (por `GroupCode`) con sus
  `RffmMatch` en `FederationDbContext`. Goles en `LocalGoals`/`VisitorGoals` (texto; se parsean con
  `int.TryParse`, igual que `RffmResultsSyncService.ParseGoals`). Un partido **tiene resultado** si
  ambos goles se pueden parsear (mismo criterio que `StandingsMatch.HasResult`); si no, está
  **pendiente**.
- **Puntos por resultado** y **puntos de sanción**: `RffmCompetitionGroup.Points` y
  `RffmStandingsMapper.Sanctions(RffmStandingsMapper.Parse(group.OfficialStandingsJson))`.
- **Plantillas**: `LeagueSquadStatsReport` (temporada actual + competición + grupo) → `LeagueSquadTeam`
  → `LeagueSquadPlayer`. Estadísticas por jugador y temporada en `RffmPlayerSeasonStats`
  (`Called`, `Starter`, `Substitute`, `Played`, `Goals`, `HasActivity`, `ParticipationsJson` con
  `TeamPosition`/`TeamPoints`/`CompetitionName`/`GroupName`, leído con
  `PlayerSeasonTotalsMapper.ReadParticipations`).
- **Liga del equipo**: `RivalStatsLeague.ResolveAsync` (404 si no existe, 409 sin competición).
- Temporada anterior: `RffmSeasons.Previous(options, seasonId)`.

## Goals / Non-Goals

**Goals**: probabilidades por partido pendiente y clasificación proyectada; modelo explicable,
determinista (mismos datos → misma respuesta) y cubierto por tests unitarios sin base de datos.

**Non-Goals**: ajustar por la categoría de procedencia; zonas de ascenso/descenso; persistir
simulaciones; backtesting en pantalla; Mobile.

## Decisions

### D1 — Modelo puro en `Domain/Services/MatchSimulation/`

El cálculo no toca EF ni HTTP: recibe datos y devuelve resultados. Así se testea con datos en
memoria y el endpoint solo carga y mapea.

```
Domain/Services/MatchSimulation/
  SimulationInput.cs        // records de entrada
  SquadStrengthCalculator.cs // D2: fuerza de plantilla (prior)
  TeamRatingsCalculator.cs   // D3: ataque/defensa por equipo
  MatchProbabilities.cs      // D4: Poisson analítico por partido
  SeasonSimulator.cs         // D5: Monte Carlo de la clasificación
```

Entrada:

```csharp
public record SimTeam(string Code, string Name, string? ShieldUrl);
public record SimMatch(int Round, string LocalCode, string VisitorCode, int? LocalGoals, int? VisitorGoals, DateOnly? Date)
{
    public bool HasResult => LocalGoals.HasValue && VisitorGoals.HasValue;
}
public record SimPlayerParticipation(string CompetitionName, string GroupName, int TeamPosition);
public record SimPlayer(
    int CurrentCalled, int CurrentStarter, int CurrentSubstitute,   // temporada actual (0 si no hay ficha)
    bool HasPreviousSeason, int PreviousCalled, int PreviousStarter, int PreviousPlayed, int PreviousGoals,
    IReadOnlyList<SimPlayerParticipation> PreviousParticipations);
public record SimulationInput(
    IReadOnlyList<SimTeam> Teams, IReadOnlyList<SimMatch> Calendar,
    IReadOnlyDictionary<string, IReadOnlyList<SimPlayer>> SquadsByTeam,  // vacío si no hay informe
    RffmPointsSystem Points, IReadOnlyDictionary<string, int> SanctionPoints);
```

### D2 — Fuerza de plantilla (prior)

Para cada jugador con temporada anterior (`HasPreviousSeason`):

- `positionScore`: media sobre sus participaciones de `1 − (pos − 1) / (N − 1)`, donde `N` es el
  mayor `TeamPosition` visto para esa misma `CompetitionName + GroupName` entre **todos** los
  jugadores de la entrada, con mínimo `max(pos, 10)` para no inflar grupos con pocos datos. Sin
  participaciones → `0.5`.
- `starterRate = PreviousStarter / PreviousCalled` (0 si no fue convocado).
- `goalRate = min(PreviousGoals / PreviousPlayed, 1.5) / 1.5` (0 si no jugó).
- `quality = 0.60·positionScore + 0.25·starterRate + 0.15·goalRate`.

Jugador **sin temporada anterior** (nuevo): `quality = 0.95 · mediaLiga`, donde `mediaLiga` es la
media de `quality` de todos los jugadores con temporada anterior (0.5 si no hay ninguno).

Peso del jugador en su equipo según la temporada actual:
`weight = 0.25 + CurrentStarter + 0.5·CurrentSubstitute` (el 0.25 da algo de peso a quien aún no ha
jugado; así al principio de la temporada todos pesan igual).

`Q(equipo) = Σ weight·quality / Σ weight`. Fuerza relativa `s = Q / media(Q de los equipos con
plantilla)`, acotada a `[0.6, 1.6]`. Equipo sin plantilla (o sin informe) → `s = 1`.

Prior: `attackPrior = s`, `defensePrior = 1 / s` (defensa < 1 = encaja menos que la media).

### D3 — Ataque y defensa por equipo

Con los partidos con resultado:

- `μHome` = media de goles locales, `μAway` = media de goles visitantes. Se encogen hacia
  `1.5`/`1.2` con `M = 10` partidos: `μ = (Σgoles + M·default) / (n + M)`.
- `μ = (μHome + μAway) / 2`.
- Por equipo con `n` partidos jugados: `attackResults = (GF / n) / μ`,
  `defenseResults = (GA / n) / μ` (si `n = 0`, 1).
- Mezcla: `w = n / (n + K)` con `K = 6`;
  `attack = w·attackResults + (1 − w)·attackPrior`, igual para defensa.

Goles esperados de un partido: `λLocal = μHome·attack(local)·defense(visitante)`,
`λVisitante = μAway·attack(visitante)·defense(local)`, acotados a `[0.1, 8]`.

### D4 — Probabilidades por partido (analítico, sin azar)

Poisson independiente para cada equipo, sumando marcadores de `0` a `10` goles por lado y
renormalizando: `pLocal`, `pEmpate`, `pVisitante`, `mostLikelyScore` (marcador de mayor
probabilidad; empate de probabilidades → el de menos goles totales). Así las probabilidades de un
partido son exactas y estables.

### D5 — Clasificación proyectada (Monte Carlo)

- `Iterations = 10_000`, `Random` con **semilla fija** (`20261022`) → respuesta determinista.
- Cada iteración parte de la clasificación actual (puntos − sanción, GF, GA de los partidos con
  resultado) y simula cada partido pendiente con dos muestras de Poisson (algoritmo de Knuth;
  `λ ≤ 8`).
- Orden de cada iteración: puntos, diferencia de goles, goles a favor y, si persiste el empate,
  orden aleatorio de la propia iteración. **No** se usa `RffmStandingsCalculator` (el enfrentamiento
  directo multiplicaría el coste por 10.000 y apenas cambia probabilidades agregadas).
- Por equipo: `expectedPoints` (media), `positionProbabilities[i]` (fracción de iteraciones en el
  puesto `i + 1`), `mostLikelyPosition`, `currentPoints`, `currentPosition` (misma ordenación
  simplificada sobre los datos actuales).
- Sin partidos pendientes: la proyección es la clasificación actual con probabilidad 1.

### D6 — Endpoint `GetRivalSimulation`

`Features/Coaches/RivalStats/GetRivalSimulation.cs`, `IFeatureModule`:

```csharp
app.MapGet("/api/teams/{teamId}/rival-stats/simulation", ...)
   .WithName(nameof(GetRivalSimulation)).WithTags(RivalStatsConstants.Feature)
   .Produces<RivalSimulationResponse>().Produces<ProblemDetails>(404).Produces<ProblemDetails>(409)
   .RequireAuthorization();

public record RivalSimulationQuery(string TeamId) : IRequest<RivalSimulationResponse?>,
    IRequireFeaturePermission, IRequireTeamMembership
{ FeatureRoute => CoachFeatureRoutes.Convocations; RequiredPermission => "Read"; }
```

`IRequest` (no `IQueryApp`), igual que `GetRivalStats`: los resultados cambian con cada
sincronización y no deben quedarse 1 h en caché. Al ser query, no lleva validador (como el resto del
feature).

Handler (`AppDbContext`, `FederationDbContext`, `IOptions<RffmOptions>`):

1. `RivalStatsLeague.ResolveAsync`.
2. `RffmRounds` con `Matches` de `GroupCode == league.GroupCode` (`AsNoTracking`). Sin partidos →
   devuelve `null` → **404** ProblemDetails «Calendario no disponible».
3. `RffmCompetitionGroup` del grupo → puntos y sanciones (por defecto `RffmPointsSystem.Default`, sin
   sanciones).
4. Informe de plantillas `Completed` de la liga (si existe) y `RffmPlayerSeasonStats` de sus
   jugadores para la temporada actual y la anterior → `SquadsByTeam`.
5. Ejecuta D3–D5 y mapea.

```csharp
public record RivalSimulationResponse(
    int PlayedMatches, int PendingMatches, bool UsesSquadStrength, string? OwnTeamCode, int Iterations,
    List<MatchPredictionResponse> Matches, List<ProjectedStandingResponse> Standings);

public record MatchPredictionResponse(int Round, DateOnly? Date,
    string LocalTeamCode, string LocalTeamName, string? LocalShieldUrl,
    string VisitorTeamCode, string VisitorTeamName, string? VisitorShieldUrl,
    double LocalWinProbability, double DrawProbability, double VisitorWinProbability,
    double LocalExpectedGoals, double VisitorExpectedGoals, int MostLikelyLocalGoals, int MostLikelyVisitorGoals);

public record ProjectedStandingResponse(string TeamCode, string TeamName, string? ShieldUrl,
    int CurrentPosition, int CurrentPoints, double ExpectedPoints, int MostLikelyPosition,
    double ChampionProbability, List<double> PositionProbabilities,
    double Attack, double Defense, double SquadStrength);
```

`Matches` ordenados por jornada y orden del partido; `Standings` por `ExpectedPoints` desc.
`UsesSquadStrength = true` si hay informe `Completed` con al menos un equipo con plantilla.
Probabilidades redondeadas a 4 decimales; ataque/defensa/fuerza a 2.

### D7 — Front: página «Simulación»

- `services/rivalStatsService.ts`: tipos `RivalSimulation`, `MatchPrediction`, `ProjectedStanding` y
  `getRivalSimulation(teamId)` (`GET ${basePath}/simulation`).
- `hooks/useRivalSimulation.ts`: `{ simulation, loading, error }` para el `teamId`.
- `pages/rivalStats/simulation/RivalSimulation.tsx` (+ `.module.css`), lazy en `routes.tsx` como
  `rival-stats/simulation` con `RequireFeaturePermission featureRoute={Convocations}` (igual que
  `rival-stats`). `useAuditPageAccess("RivalSimulation")`.
- Cabecera: `ContentLayout` con título «Simulación», botón «Volver» a `/coach/rival-stats`
  (conservando la query string), y un texto corto: «Probabilidades orientativas calculadas con N
  partidos disputados». Si `!usesSquadStrength`: `Alert` info «Genera las estadísticas de rivales
  para tener en cuenta las plantillas; ahora solo se usan los resultados.»
- Pestañas MUI `Tabs`: **Partidos** y **Clasificación**.
  - **Partidos**: tarjetas agrupadas por jornada (cabecera «Jornada N · fecha»). Interruptor «Solo
    mi equipo» (activo por defecto si hay `ownTeamCode`). Cada `MatchPredictionCard` muestra escudos y
    nombres, barra de tres segmentos (local / empate / visitante) con sus porcentajes, marcador más
    probable y goles esperados. Sin pendientes → `EmptyState` «No quedan partidos por disputar».
  - **Clasificación**: `ProjectedStandingCard` por equipo en orden de puntos esperados: puesto
    proyectado, escudo y nombre (resaltado el propio), puntos actuales → esperados, puesto más
    probable con su probabilidad, probabilidad de ser campeón, y una mini barra de distribución por
    puestos (un segmento por puesto con opacidad proporcional a la probabilidad).
- Botón «Simulación» en la barra de `RivalStats.tsx` (visible si el equipo tiene competición).
- Sin tablas; tarjetas apiladas que funcionan desde 360px. CSS Modules + tema Coach.
- Porcentajes con `Intl.NumberFormat("es-ES", { style: "percent", maximumFractionDigits: 0 })`.

## Risks / Trade-offs

- **Defensa al inicio**: el prior de defensa es el inverso del de ataque porque no hay datos
  individuales defensivos. Se compensa a medida que hay resultados.
- **Grupos con pocos datos**: `N` se estima con las participaciones vistas (D2), con mínimo 10.
- **Categoría distinta la temporada pasada**: no se ajusta (fuera de alcance); el peso del prior
  cae con las jornadas.
- **Coste**: 10.000 iteraciones × ~200 partidos ≈ 2M muestras de Poisson; < 1 s. Si hiciera falta,
  se reduce `Iterations` sin cambiar el contrato.
