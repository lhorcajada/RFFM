## Why

En `/coach/squad?teamId=` → pestaña Estadísticas, dos problemas de UI en móvil: la barra de
"Ordenar por" (`ToggleButtonGroup` con 8 opciones) desborda el ancho de pantalla, y el `Select` de
posición se encoge hasta quedar ilegible en el layout flex actual (`SquadStatistics.module.css`).
Además, el orden por defecto es `readiness` ("Rodaje") en vez de `ef` ("Estado de forma"), que es
la métrica que el cuerpo técnico usa primero para decidir convocatorias.

En cuanto a datos: la tarjeta y el PDF exportado solo muestran `matchesPlayed` (partidos jugados) y
`trainingsAttended`, sin mostrar cuántos partidos NO ha asistido el jugador por su cuenta (ni el PDF
incluye Forma física/Cansancio). Tampoco existe ningún indicador de progreso de minutos jugados
respecto al objetivo de temporada: un jugador debe llegar a fin de temporada con al menos el 30% de
los minutos totales que el equipo ha disputado (solo aplica a categorías F11: Juvenil/Cadete/
Infantil/Alevín, con duración de partido 45/40/35/30 min respectivamente, tomando el mínimo entre
esa duración estándar y la duración real registrada del partido — relevante en amistosos más cortos).

## What Changes

- Backend (`GetTeamPlayerStatistics`): añadir `MatchesAbsentAttributableToPlayer` (int) — partidos
  del equipo (Partido/Amistoso/Torneo, finalizados) donde la ausencia es imputable al jugador: fue
  convocado y no se presentó (justificado o no), o fue desconvocado por un motivo que no es
  `ExcuseType.TechnicalDecision`. No cuenta si nunca fue convocado, ni si fue desconvocado por
  decisión técnica del entrenador.
- Backend: nuevo enum `MatchDurationByCategory` (estilo `Category`/`AssistanceType`) con minutos
  estándar de partido F11 por categoría (Juvenil 45, Cadete 40, Infantil 35, Alevín 30). Solo
  aplica a esas 4 categorías; el resto no calcula el objetivo de minutos.
- Backend: calcular por equipo `SeasonTotalPossibleMinutes` = suma, para cada partido/amistoso/
  torneo finalizado del equipo esta temporada, de `min(duración estándar de la categoría, máximo
  MinutesPlayed entre las participaciones de ese partido)`. Exponer por jugador
  `MinutesPlayedPercentOfSeasonTotal` y `AttributableAbsentMinutesPercentOfSeasonTotal` (nulos si
  la categoría del equipo no es F11).
- Backend (PDF/export): incluir Forma física (`physicalFitness`) y Cansancio (`fatigue`) en
  `exportSquadStatisticsPdf`.
- Frontend: `SquadStatistics.tsx` — orden por defecto `ef` en vez de `readiness`; nueva sección en
  la tarjeta con el % de minutos jugados vs objetivo 30%, y el desglose de % minutos/partidos no
  asistidos por cuenta del jugador; nuevo stat "Ausencias" (partidos no asistidos) junto a
  "Partidos".
- Frontend (CSS): `SquadStatistics.module.css` — toolbar de orden con scroll horizontal contenido
  (no desborda la página) en viewport ≤400px; el `Select` de posición mantiene un ancho mínimo
  legible en vez de encogerse con `flex`.

## Capabilities

### Modified Capabilities
- `player-statistics`: añade ausencias imputables al jugador y progreso de minutos hacia el
  objetivo de temporada (30%, solo categorías F11).

## Impact

- Backend: `Features/Coaches/Players/Queries/GetTeamPlayerStatistics.cs`, nuevo
  `Domain/Entities/Competitions/MatchDurationByCategory.cs` (o similar), xUnit tests.
- Frontend: `teamPlayerStatisticsService.ts` (nuevos campos), `SquadStatistics.tsx`,
  `SquadStatistics.module.css`, `squadStatsPdfExport.ts`, Vitest tests existentes
  (`SquadStatistics.sortAndFilter.test.tsx`, `squadStatsPdfExport.test.ts`, etc.).
