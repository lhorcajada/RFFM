## Context

- `persist-rffm-results` guarda por grupo las jornadas (`RffmRound`) y los partidos
  (`RffmMatch`, todos los campos en crudo), y las refresca por jornada con
  `RffmRoundRefreshPolicy`. Una jornada solo se descarga cuando alguien la consulta.
- Hoy la clasificación y su popup cuestan unas 34 peticiones a la RFFM por visita:
  `CalendarService.GetCalendarAsync` (competiciones, grupos, clasificación y 30 × `api/results`)
  y `CompetitionService.GetClassification` (`group-rounds` y `standings`). Todos los consumidores
  de `GetCalendarAsync` son de un solo grupo (GetCalendar, GetGoalSectors, GetTeamCallups, y
  GetTeamCalendar y GetTeamNextMatch de Mobile). `GetClassification` lo usan también
  `ResolveTeamGroup` y `SearchCompetitionTeams`, que recorren muchos grupos: esos se quedan como
  están.
- `useClassification.ts` reordena los equipos por puntos en el cliente y pierde los desempates.

### Validación de las reglas (29/09/2026)

Script en el scratchpad: descarga todas las jornadas y la clasificación oficial tras cada jornada
(`api/standings?idGroup=&round=N`) de 12 grupos de la temporada 21 (2025-2026), elegidos al azar
entre las competiciones con clasificación y 3/1/0. Calcula la clasificación con varias variantes y
la compara con la oficial jornada a jornada:

| Aspecto | Resultado |
|---|---|
| Partidos que cuentan | los que tienen goles, **tengan o no el acta cerrada** (49 de 1.199 tenían goles con el acta abierta). PJ/puntos/GF/GC: 100 % iguales. Solo con actas cerradas: fallan 50 de 86 jornadas |
| Local/visitante y puntos de local y visitante | 100 % (2.747 filas) |
| Racha (`racha_partidos`) | 5 últimos por **orden de jornada**, del más antiguo al más reciente: 100 %. Por fecha del partido: 89 % |
| Sin enfrentamiento directo (DG, GF) | 87 % de las clasificaciones idénticas |
| Enfrentamiento directo siempre | 47-55 % |
| Enfrentamiento directo con solo la ida jugada | 61 % |
| Enfrentamiento directo **solo con todos los partidos entre ellos jugados** | 96 % |
| … **más carácter eliminatorio** (art. 46.2.d: tras separar al mejor, el resto vuelve al primer criterio) | **96-98 %** |

Resultado final con los 11 grupos completos: **214 de 220 clasificaciones idénticas (97,3 %)**.
Los fallos son siempre dos equipos seguidos intercambiados: empates de tres con la mini-liga a
medio jugar en la segunda vuelta, y empates totales en las jornadas 1-3, que la RFFM no ordena ni
por nombre ni por código (probablemente por tarjetas, un dato que no tenemos). La conciliación
(D5) los corrige cuando la jornada se cierra entera.

## Goals / Non-Goals

**Goals:** clasificación calculada con las reglas validadas, viva durante la jornada, guardada
(vigente y una foto por jornada); calendario completo desde BD; como mucho una petición a
`standings` por jornada cerrada; contratos HTTP intactos.

**Non-Goals:** los consumidores multigrupo, UI del histórico, partidos de desempate. Las
competiciones a una sola vuelta usan el orden del art. 46.3 (DG, GF, enfrentamiento directo), pero
no se han podido validar con datos.

## Decisions

### D1 · Calculadora (`RffmStandingsCalculator`, dominio, pura)

```csharp
public record RffmPointsSystem(int Win, int Draw, int Loss);
public record StandingsMatch(int Round, string LocalCode, string VisitorCode, int? LocalGoals, int? VisitorGoals);
public record StandingsTeam(string Code, string Name, string ImageUrl);
public record StandingRow(int Position, string TeamCode, string TeamName, string ImageUrl,
    int Played, int Won, int Drawn, int Lost, int GoalsFor, int GoalsAgainst,
    int HomePlayed, int HomeWon, int HomeDrawn, int HomeLost,
    int AwayPlayed, int AwayWon, int AwayDrawn, int AwayLost,
    int Points, int SanctionPoints, int HomePoints, int AwayPoints, string Streak /* "GGEPG" */);

IReadOnlyList<StandingRow> Calculate(IEnumerable<StandingsTeam> teams, IReadOnlyList<StandingsMatch> calendar,
    int upToRound, RffmPointsSystem points, IReadOnlyDictionary<string,int> sanctions)
```

- `calendar` son **todos** los partidos programados del grupo, jugados o no: sirve para saber si
  el enfrentamiento directo está completo (todos los partidos programados entre los empatados
  tienen resultado y su jornada es ≤ `upToRound`). Cuentan los partidos con goles de jornada
  ≤ `upToRound`.
- Una sola vuelta (cada pareja programada una vez): orden DG → GF → enfrentamiento directo
  (art. 46.3).
- Desempate final: nombre (ordinal, sin distinguir mayúsculas).
- Mientras falten jornadas pasadas por descargar (grupos abiertos antes solo desde Resultados) no
  se calcula con datos parciales: `StandingsJson` usa la última clasificación oficial conciliada.
  `GET /classification` devuelve la oficial de la RFFM.

### D2 · Modelo

- `RffmCompetitionGroup` gana: `PointsWin/Draw/Loss` (default 3/1/0), `StandingsRound`,
  `StandingsComputedAt`, `OfficialStandingsJson` (jsonb, última clasificación oficial, en formato
  `List<TeamResponse>`) y `OfficialStandingsRound`. `StandingsJson` pasa a contener la
  clasificación **calculada** vigente en el mismo formato `List<TeamResponse>`, así que las
  posiciones de `/calendar/matchday` siguen funcionando igual.
- Nueva `RffmStandingsSnapshot : BaseEntity` (índice único `GroupCode, Round`): `PayloadJson`
  (jsonb, `List<TeamResponse>`), `Source` (SmartEnum `Computed(1)`, `Official(2)`) y `ComputedAt`.
  Una foto por jornada: la clasificación tras la jornada N.

### D3 · Grupo completo (`RffmResultsSyncService.EnsureGroupAsync`)

Bajo el `IKeyedLock` del grupo:
1. Si el grupo no existe se crea con la jornada 1 (como hoy). La competición se busca en
   `api/competitions` de la temporada pedida y, si no está, en el resto de `SelectableSeasons`;
   de ahí salen la temporada real del grupo, la duración y los puntos. Por eso
   `GetCompetitionDurationAsync` pasa a ser `FindCompetitionAsync(code, seasons)`.
2. Se pide cada jornada con `LastSyncedAt == null` y cada jornada que devuelva un motivo en
   `RffmRoundRefreshPolicy`, con el cliente interactivo. Una vez que el grupo existe, las jornadas
   pendientes se piden **en paralelo, como mucho 4 a la vez**, y se aplican en orden. La primera
   vez son unas 30 peticiones, una sola vez por grupo y compartidas entre usuarios. Medido contra
   la RFFM: 11,8 s en secuencia y 1,8 s en paralelo.
3. Si algo cambió, o no hay clasificación: `RecomputeStandings` (D4). Se encolan las actas nuevas
   y la conciliación (D5).
4. Un fallo en una jornada no aborta el resto: esa jornada se queda sin sincronizar y se
   reintenta en la siguiente consulta.

`GetMatchDayAsync` (Resultados) también llama a `RecomputeStandings` cuando su jornada cambia.

### D4 · `RecomputeStandings`

- Calendario = todos los partidos del grupo (jornadas cargadas con sus partidos: ~240 filas).
  Equipos = todos los que aparecen en el calendario, con nombre y escudo del partido más reciente.
- Sanciones = `SanctionPoints` de `OfficialStandingsJson`.
- Foto de cada jornada N desde la 1 hasta la última jornada con algún resultado: `Calculate(…, N)`,
  con upsert de `RffmStandingsSnapshot` (`Computed`), salvo que la foto de N sea `Official` y sus
  estadísticas sigan coincidiendo (D5).
- Vigente = la foto de la última jornada con resultados → `StandingsJson`, `StandingsRound`.
- Mapeo a `TeamResponse` (en `Features`): números como strings; `Color` por posición desde
  `OfficialStandingsJson` (la franja es por puesto); `MatchStreaks` desde `Streak`;
  `ImageUrl` con el prefijo de escudos; `Penalties`, `ShowCoefficient` y `Coefficient` como en la
  oficial ("0", "0", "").

### D5 · Conciliación (`ReconcileStandingsJob`, sustituye a `RefreshStandingsJob`)

- Se encola cuando una jornada tiene **todos** sus partidos con acta cerrada y
  `OfficialStandingsRound < N`, y al crear el grupo (con la última jornada jugada).
- El worker pide `IRffmBackgroundClient.GetStandingsAsync(group, N)` y guarda
  `OfficialStandingsJson` y `OfficialStandingsRound`. Después compara con la foto calculada de N:
  - mismas estadísticas por equipo (PJ, puntos, GF, GC) y distinto orden → la foto de N pasa a
    `Official` con el orden oficial, y se registra un warning con los dos órdenes;
  - estadísticas distintas → se registra un warning (datos de la RFFM que no podemos deducir:
    partidos anulados, retirados…) y se deja el cálculo.
- Si cambian los puntos de sanción, se recalcula (D4).

### D6 · Endpoints y consumidores

- `CalendarService.GetCalendarAsync(competicion, groupId)` delega en
  `IRffmResultsSyncService.GetCalendarAsync(groupId)`: `EnsureGroupAsync` + mapeo de todas las
  jornadas (`RffmMatchDayMapper`, con posiciones). Se eliminan de `CalendarService` los métodos
  privados que quedan sin uso.
- `GET /classification` y el `GetTeamClassification` de Mobile usan
  `IRffmResultsSyncService.GetClassificationAsync(groupId)` → `ClassificationResponse` desde
  `StandingsJson`. Si alguna jornada pasada sigue sin sincronizar tras `EnsureGroupAsync`, se
  devuelve `CompetitionService.GetClassification` (la oficial de la RFFM). La query pasa a ser
  `IRequest` (escribe en BD).
- `ResolveTeamGroup` y `SearchCompetitionTeams` siguen usando `CompetitionService`.

### D7 · Frontend

`useClassification.ts`: ordena por `position` (y por `points` si falta la posición), con un test
nuevo. Sin más cambios: el popup sigue usando `GET /calendar`.

## Risks / Trade-offs

- **Primera visita a un grupo**: ~2 s, una vez por grupo. Hoy cada visita cuesta 34 peticiones.
  Las siguientes tardan ~10 ms (medido).
- **Dos intercambios de posición por cada ~100 jornadas** en empates múltiples a medio jugar,
  hasta que la conciliación los corrige al cerrarse la jornada.
- **Datos que la RFFM no expone en los resultados** (partidos anulados, equipos retirados): se
  detectan en la conciliación y se registran; no se corrigen automáticamente.
- **Carga en BD**: recalcular hasta 30 fotos por cambio es trivial (unos pocos cientos de filas en
  memoria).

## Migration Plan

Migración `AddRffmStandings` (FederationDbContext): columnas nuevas en `RffmCompetitionGroups`
(puntos con valores por defecto 3/1/0) y la tabla `RffmStandingsSnapshots`. Commit separado. Los
grupos ya guardados recalculan su clasificación en la siguiente consulta, porque no tienen
`StandingsRound`.
