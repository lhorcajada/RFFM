## Why

Cada jugador de categoría F11 debe acabar la temporada con al menos el 30% de los minutos que ha
disputado el equipo. Si no llega, hoy la tarjeta de Estadísticas solo muestra el % jugado y
"Partidos no asistidos: N". No hay forma de demostrar si no llegó porque el entrenador no lo
alineó o porque el propio jugador no fue a los partidos: rechazó la convocatoria, la aceptó y no
se presentó, o estuvo lesionado, enfermo o sancionado.

El backend ya distingue las ausencias imputables al jugador (`AttributableAbsenceCalculator`) y
calcula el % de minutos que perdió por ellas (`AttributableAbsentMinutesPercentOfSeasonTotal`),
pero ese dato no se muestra y no hay detalle por partido.

## What Changes

- **Minutos disponibles**: minutos totales de la temporada menos los minutos de los partidos con
  ausencia imputable al jugador. Las lesiones restan, como cualquier otro motivo que no sea
  decisión técnica. Si el jugador fue convocado, fue al partido y no jugó, esos minutos siguen
  siendo disponibles (es decisión del entrenador).
- **Veredicto del objetivo** por jugador:
  - `Met`: ≥ 30% del total.
  - `NotMetByOwnAbsences`: < 30% del total pero ≥ 30% de sus minutos disponibles.
  - `NotMet`: < 30% también sobre sus minutos disponibles.
- **Lista de ausencias imputables** por jugador, con fecha, rival, minutos del partido, tipo
  ("Rechazó la convocatoria" / "No se presentó") y motivo.
- Backend (`GetTeamPlayerStatistics`): nuevos campos `MinutesPlayedPercentOfAvailable`,
  `MinutesTargetStatus` y `AttributableAbsences`. Los existentes no cambian.
- Frontend (`SquadStatistics`): etiqueta con el veredicto, barra con un tramo rayado para los
  minutos perdidos por sus ausencias, y lista desplegable de ausencias en tarjetas.
- PDF de estadísticas: veredicto, % sobre minutos disponibles y la lista de ausencias.

## Capabilities

### New Capabilities
- `player-season-minutes-target`: objetivo de minutos de temporada con separación de
  responsabilidad entre jugador y entrenador.

## Impact

- Backend: `Features/Coaches/Players/Queries/GetTeamPlayerStatistics.cs` (+ tests). Sin
  migraciones ni queries nuevas de tabla (solo se amplía la proyección de eventos con el rival).
- Frontend: `teamPlayerStatisticsService.ts`, `SquadStatistics.tsx` (+ `.module.css`),
  `playerStatsText.ts`, `squadStatsPdfExport.ts` y sus tests.
