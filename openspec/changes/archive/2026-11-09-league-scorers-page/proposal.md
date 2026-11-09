## Why

El entrenador no tiene forma de ver quién marca en su liga: los goles solo existen dentro de cada acta de la RFFM. Las actas cerradas ya se guardan en BD (`RffmMatchRecords`), así que se pueden explotar sin llamar a la federación.

## What Changes

- Nueva página «Goleadores» en la app Coach, para la liga (grupo) del equipo que se está viendo.
- Vista por jornada: selector de jornada y, por cada partido, tarjeta con equipos, marcador, fecha y lista de goles (minuto, jugador, equipo, tipo: penalti / en propia puerta).
- Clasificación acumulada de máximos goleadores hasta la jornada seleccionada.
- Nuevo endpoint de lectura en la API que construye ambas vistas leyendo los goles del `PayloadJson` de `RffmMatchRecords`, unido a `RffmMatch` / `RffmRound`.
- Solo se muestra lo que hay en BD en ese momento: no se descargan actas de la RFFM. Un partido cerrado sin acta guardada se marca como «Acta pendiente» y no suma goles.
- Los goles en propia puerta se listan en el partido pero no cuentan en la clasificación del jugador.
- Sin tablas nuevas ni migraciones. Sin cambios en el guardado de actas.
- Entrada de navegación a la página desde el menú del equipo.

## Capabilities

### New Capabilities
- `league-scorers`: consulta de goles por jornada y clasificación de goleadores de la liga del equipo, a partir de las actas guardadas.
- `coach-league-scorers-page`: página «Goleadores» de la app Coach (selector de jornada, tarjetas por partido, ranking, estados vacío/pendiente, responsive).

### Modified Capabilities
<!-- Ninguna: el guardado de actas (rffm-results-persistence) no cambia. -->

## Impact

- **Back** (`Back/ExtractionApi/src/RFFM.Api`): nuevo slice de lectura en `Features/Coaches/` (query + endpoint + DTOs, un `.cs`), servicio que deserializa `MatchRffm` desde `PayloadJson` y agrega goles. Lee `FederationDbContext` (`RffmMatchRecords`, `RffmMatches`, `RffmRounds`, `RffmCompetitionGroups`) y resuelve el grupo desde el equipo (`AppDbContext`). Sin migración.
- **Front** (`Front/src/apps/coach`): nueva página lazy con su `routes.tsx`, servicio, hook, CSS Module y tests; entrada en el menú de equipo. Sin tablas (tarjetas/listas responsive).
- **Versionado**: `feat` en API y Web → subir minor de `Directory.Build.props` y `Front/package.json`.
- **Riesgo**: deserializar un acta completa por partido; acotado porque una jornada tiene pocos partidos y el ranking recorre las actas de un solo grupo. Si resulta lento, pasar a tabla de goles queda fuera de este change.

## Proposal Research Documentation

**Local files**:
- Back/ExtractionApi/src/RFFM.Api/Features/Federation/Teams/Services/ActaService.cs
- Back/ExtractionApi/src/RFFM.Api/Features/Federation/Teams/Models/MatchRffm.cs
- Back/ExtractionApi/src/RFFM.Api/Domain/Entities/Federation/Results/RffmMatchRecord.cs
- Back/ExtractionApi/src/RFFM.Api/Domain/Entities/Federation/Results/RffmMatch.cs
- Back/ExtractionApi/src/RFFM.Api/Features/Federation/MatchResults/Services/RffmResultsWorker.cs
- Back/ExtractionApi/src/RFFM.Api/Features/Federation/MatchResults/Services/RffmResultsSyncService.cs
- Back/ExtractionApi/src/RFFM.Api/Features/Federation/SquadHistory/Services/SquadHistoryActaAggregator.cs
- Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/Configuration/Entities/RffmResultsEntityConfiguration.cs
- openspec/specs/coach-results-page/spec.md
- Front/src/apps/coach/routes.tsx
- .design/goleadores/project/Main.dc.html
- .design/goleadores/project/Mobile.dc.html

**External URLs**:
- None

## Additional Notes

- `Goal` del acta: `codjugador`, `nombre_jugador`, `minuto` (puede ser `90+2'` o vacío), `tipo_gol`. `SquadHistoryActaAggregator` trata `tipo_gol == "102"` como gol en propia puerta; el catálogo completo de `tipo_gol` (penalti) debe confirmarse con un acta real durante el diseño.
- `codjugador` puede venir vacío: agrupar entonces por nombre + equipo.
- El worker de segundo plano puede estar desactivado (`rffmBackgroundEnabled`); en ese caso solo hay actas de las abiertas bajo demanda, y la página debe reflejarlo con «Acta pendiente».
- El diseño de referencia usa datos de ejemplo inventados; no son datos reales.
