## Context

Verified facts:
- Las actas cerradas se guardan en `RffmMatchRecords` (`RecordCode` único, `PayloadJson` jsonb con el `MatchRffm` serializado) por `RffmResultsWorker` (jobs `FetchMatchRecordJob`, con reencolado al arrancar) y por `ActaService` bajo demanda.
- `MatchRffm` expone `LocalGoalsList` / `AwayGoalsList` de `Goal` (`PlayerCode`, `PlayerName`, `Minute`, `GoalType`). `SquadHistoryActaAggregator` trata `GoalType == "102"` como gol en propia puerta.
- `RffmRound` (por `GroupCode` y `Number`) tiene `RffmMatch` con `RecordCode`, `RecordClosed`, equipos, marcador, fecha y hora. `RffmCompetitionGroup.GroupCode` es string; `Team.RffmGroupId` / `RffmCompetitionId` son `int?`.
- Las queries del coach declaran `IRequireTeamMembership` y `IRequireFeaturePermission` (la página Resultados usa la ruta de permiso `Convocations`).
- El worker puede estar desactivado (`rffmBackgroundEnabled`).

Assumptions (a confirmar con un acta real en la fase RED): el valor de `tipo_gol` para penalti; que `GroupCode` coincide con `Team.RffmGroupId.ToString()`.

## Goals / Non-Goals

Goals:
- Una sola llamada devuelve las rondas, los partidos con goles de la jornada pedida y el ranking acumulado hasta esa jornada.
- Cero llamadas a la RFFM al servir la petición.
- Página Coach responsive con tarjetas, siguiendo `.design/goleadores/`.

Non-goals:
- Tabla de goles desnormalizada, migración o backfill (opción B descartada por ahora).
- Descargar o completar actas faltantes desde la página.
- Estadísticas distintas de goles (asistencias, tarjetas) o filtros por equipo.
- Cambiar `ActaService`, el worker o `SquadHistoryActaAggregator`.

## Decisions

### D1. Leer el `PayloadJson` y agregar en memoria
Query en `Features/Coaches/` que carga, para el grupo del equipo, los `RffmMatch` de las rondas ≤ la pedida (solo columnas necesarias) y los `PayloadJson` de sus actas con `RecordCode IN (...)`, deserializa a `MatchRffm` y agrega. Alternativas: tabla `RffmMatchGoals` (más rápida en el ranking, pero migración, backfill y segundo punto de escritura) y consulta jsonb en PostgreSQL (acopla a SQL jsonb y es más difícil de probar). Se acepta el coste de deserializar porque una liga son cientos de actas y se hace una vez por petición. Satisface: «Scorers come only from stored actas» y «Accumulated scorers ranking».

### D2. Un endpoint, un slice
`GET /api/teams/{teamId}/league-scorers?round={n}` en un único `GetLeagueScorers.cs` (endpoint, query, handler, DTOs), con `IRequireTeamMembership` e `IRequireFeaturePermission` (`Convocations`, `Read`), igual que `GetTeamMatchReports`. Sin `round` usa la última ronda con algún partido cerrado. Respuesta: `{ rounds: int[], round: int, matches: [...], scorers: [...] }`.

### D3. Lógica pura separada para poder testearla
`LeagueScorersBuilder` (clase estática, sin EF) recibe partidos y actas ya cargados y devuelve DTOs: ordena goles por minuto (`90+2'` → 92; vacío al final), clasifica tipo (propia = `"102"`, penalti = código a confirmar), agrupa jugadores por `PlayerCode` o, si está vacío, por nombre normalizado + equipo, excluye propias del ranking, ordena y recorta a 20. El handler solo carga datos y delega.

### D4. Gol en propia puerta
Se devuelve como gol del partido con tag «En propia», acreditado al equipo de la lista en que viene en el acta (como lo guarda la RFFM), y no suma al jugador.

### D5. Estados de partido
`PendingActa = match.IsFinal && no existe acta`. Partidos no cerrados salen sin goles ni flag. Equipo sin `RffmGroupId`/`RffmCompetitionId` → `ProblemDetails` 400 con código de error de dominio; grupo sin sincronizar → respuesta vacía (200).

### D6. Frontend
Página `apps/coach/pages/scorers/Scorers.tsx` (lazy, ruta `scorers`, permiso `Convocations`) con `scorersService.ts` en `apps/coach/services`, hook `useLeagueScorers(teamId, round)`, componentes `RoundSelector`, `MatchGoalsCard`, `ScorersRanking` y CSS Modules. Sin tablas; tema Coach existente; estados loading/error/vacío con `rffm.show_snackbar` solo si procede. Entrada en el menú de equipo junto a «Resultados».

### D7. Descarga explícita de actas pendientes
`Rffm:BackgroundEnabled` es `false` por defecto, por lo que el worker no guarda actas y solo se guardan las que alguien abre con «Ver acta». La lectura (D1) sigue sin llamar a la RFFM; se añade `POST /api/teams/{teamId}/league-scorers/actas?round=N` (`RefreshLeagueActas.cs`) que, a petición del entrenador, reutiliza `IActaService` (que ya guarda las actas cerradas) para las actas cerradas de esa jornada que faltan, con tope de 30 por petición y tolerancia a fallos individuales. Alternativas descartadas: descargar al abrir la página (mezcla lectura y escritura y llama a la RFFM sin que el usuario lo pida) y activar el worker (activa además otros procesos en segundo plano).

## Target State

El coach abre «Goleadores» y ve la última jornada con goles, sus partidos y goles con minuto, el ranking acumulado y puede cambiar de jornada. Lo no guardado aparece como «Acta pendiente». La API no sale a internet en esta ruta.

## Risks / Trade-offs

- Rendimiento del ranking: deserializar todas las actas del grupo en cada petición. Mitigación: cargar solo `PayloadJson` de las actas del grupo hasta la ronda pedida, `AsNoTracking`, y medir en la fase de rendimiento; el caché de 1 h existente es opción posterior.
- `tipo_gol` desconocido: un gol de penalti se mostraría como normal. Mitigación: confirmar contra un acta real antes de fijar constantes; tests de caracterización con JSON real.
- Huecos de actas con el worker desactivado: el ranking infravalora. Mitigación: la señal «Acta pendiente» y el recuento visible de partidos pendientes.
- Jugador con código vacío y nombre variable: posibles duplicados. Aceptado; se normaliza mayúsculas/espacios.

## Migration Plan

Not applicable: no hay cambios de esquema ni de datos; el endpoint y la página son aditivos y se pueden retirar sin efectos.

## Validation Strategy

- Unit (xUnit) de `LeagueScorersBuilder`: orden por minutos incluidos `90+2'` y vacíos; propia excluida del ranking; agrupación por código y por nombre+equipo; acumulado hasta la ronda; límite de 20; desempates.
- Handler con `FederationDbContext`/`AppDbContext` reales (sin mocks de BD): equipo sin liga, no miembro, grupo sin rondas, partido cerrado sin acta → `PendingActa`, ronda por defecto; verificar que no se usa `IHttpClientFactory`.
- Front (Vitest + Testing Library): selector de ronda y estado pressed, tarjeta con goles y tags, «Acta pendiente», «Sin goles», error con «Reintentar», sin liga, ranking con líder.
- Una pasada visual en 390 px y escritorio contra `.design/goleadores/`.

## ADR / DDR Evaluation

Ninguno: reutiliza la persistencia de actas existente y los patrones de slice vertical; no introduce decisiones transversales nuevas. Si más adelante se pasa a tabla de goles (opción B) sí valdría un ADR.

## Open Questions

None. Dos puntos a confirmar durante la implementación, sin bloquear el diseño: valor de `tipo_gol` de penalti y coincidencia `GroupCode` ↔ `Team.RffmGroupId`.
