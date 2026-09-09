## Why

El "Rodaje" (`PlayerReadinessCalculator`, antes mal llamado "Estado de forma") mide familiaridad
reciente con el equipo (entrenos + minutos de partido), no condición física. No existe hoy
ningún indicador de condición física real del jugador ni de su fatiga acumulada. Un entrenador
necesita saber, además del rodaje, si un jugador está físicamente preparado (forma construida
con constancia a medio plazo) y si necesita descanso (cansancio acumulado a corto plazo) antes
de decidir si lo alinea. Son dos ejes distintos y no opuestos (modelo fitness-fatiga: un
jugador puede tener buena forma de base y estar cansado a la vez), por lo que se modelan como
dos estadísticas independientes.

## What Changes

- Backend: nueva entidad persistida `TeamPlayerCondition` (`PhysicalFitness`, `Fatigue`, ambos
  0-100, `LastCalculatedDate`), una fila por `TeamPlayer`, con valores de partida 30/20 para un
  jugador sin historial esta temporada.
- Backend: `PlayerConditionDayEffect` (servicio puro, testable sin DB) calcula el efecto de un
  día sobre Forma/Cansancio según lo ocurrido ese día: entrenamiento asistido (+3 forma / +5
  cansancio), partido jugado proporcional a minutos sobre 70 min de referencia (+2 forma / +10
  cansancio a partido completo), ausencia por lesión (-4 forma / -6 cansancio, igual
  recuperación que un descanso normal), cualquier otro día sin entreno ni partido (-2 forma / -6
  cansancio).
- Backend: `PlayerConditionRecalculationService` recorre día a día desde
  `LastCalculatedDate + 1` hasta hoy los eventos reales del jugador (convocatorias de
  entrenamiento, participaciones de partido), aplica `PlayerConditionDayEffect` por día,
  clampa 0-100 y persiste el resultado — se invoca de forma perezosa cada vez que se pide el
  dato (endpoint de estadísticas), sin necesidad de enganchar hooks en cada endpoint de guardado
  de asistencia/partido.
- Backend: `GetTeamPlayerStatistics` (`GET /api/catalog/team/{teamId}/player-stats`) gana 3
  campos: `PhysicalFitness`, `Fatigue`, `Availability` (= `max(0, PhysicalFitness - Fatigue)`,
  indicador combinado de disponibilidad para jugar hoy).
- Frontend: se muestran Forma física, Cansancio y Disponibilidad en los mismos sitios donde ya
  se muestra Rodaje — tarjetas de "Estadísticas" en Squad, y badges/leyenda en las 4 pestañas de
  convocatoria (banquillo y jugadores de campo).

**Non-goals**: no se modela riesgo de lesión derivado de cansancio alto; no hay simulación
"hacia atrás" para temporadas anteriores a la creación de este cambio (un jugador existente
arranca en 30/20 igual que uno nuevo, no se reconstruye su historial completo retroactivamente
en esta iteración); el "Rodaje" no se toca ni se fusiona con esto — siguen siendo tres
indicadores independientes (Rodaje, Forma física, Cansancio) más el derivado Disponibilidad.

## Capabilities

### New Capabilities
- `player-physical-condition`: Forma física y Cansancio persistidos por jugador, recalculados
  de forma incremental día a día a partir del historial real de entrenamientos/partidos, más el
  indicador derivado Disponibilidad.

## Impact

- Backend: nueva migración EF (`AddTeamPlayerCondition`); nuevo
  `Domain/Entities/TeamPlayers/TeamPlayerCondition.cs` + su
  `EntityTypeConfiguration`; nuevo `Features/Coaches/Players/Services/PlayerConditionDayEffect.cs`
  y `PlayerConditionRecalculationService.cs`; modificación de
  `Features/Coaches/Players/Queries/GetTeamPlayerStatistics.cs`; tests nuevos en
  `tests/RFFM.Api.Tests/UnitTests/`.
- Frontend: `teamPlayerStatisticsService.ts` (3 campos nuevos); `SquadStatistics.tsx` (nuevas
  filas de estadística por tarjeta); las 4 pestañas de convocatoria y sus componentes de
  tarjeta de jugador (banquillo + campo), siguiendo el mismo patrón de badge/leyenda ya usado
  para Rodaje.
