## Why

El "Cansancio" (`TeamPlayerCondition.Fatigue`, mostrado como "C" y usado dentro de "Ef" en toda
la app) y "Forma física" (`PhysicalFitness`, solo expuesta en el PDF de export) siempre acaban
en 0%. La causa es el modelo de deltas diarios persistidos
(`PlayerConditionDayEffect`/`PlayerConditionRecalculationService`): cada día sin entreno/partido
registrado se trata como "Descanso" con delta negativo fijo, aplicado día a día desde
`LastCalculatedDate` hasta hoy. Con el ritmo real de entreno (2 sesiones/semana, martes y
jueves) y partidos no semanales, el balance semanal es negativo incluso en el mejor caso, así
que ambos valores convergen a 0 y quedan clampados ahí permanentemente — el dato es inútil en
producción.

## What Changes

- **BREAKING**: se elimina por completo `PhysicalFitness`/`Availability` (sin consumidor
  visual salvo el PDF de export, que se está retirando en paralelo). Esto incluye la entidad
  `TeamPlayerCondition`, su `EntityTypeConfiguration`, el `DbSet` en `AppDbContext`,
  `PlayerConditionDayEffect`, `PlayerConditionRecalculationService`, y los campos
  `PhysicalFitness`/`Availability` del DTO `PlayerStatisticsDto`
  (`GetTeamPlayerStatistics.cs`). Migración EF nueva que elimina la tabla
  `TeamPlayerConditions`.
- Se sustituye el `Fatigue` persistido/incremental por un cálculo **derivado y sin estado**,
  calcado del patrón de `PlayerReadinessCalculator` (Rodaje): función pura
  `PlayerFatigueCalculator`, ventana móvil de 7 días de eventos reales
  (`Convocation`/`MatchParticipation`), sin días "de descanso" explícitos ni acumulación de
  estado — un hueco en el calendario simplemente no genera eventos en la ventana.
- `GetTeamPlayerStatistics` deja de invocar `PlayerConditionRecalculationService` y calcula
  `Fatigue` a partir de los datos ya cargados por el handler (entrenos/minutos de partido en
  ventana), con una ventana propia de 7 días independiente de la ventana de 8 semanas de
  Rodaje.

## Capabilities

### New Capabilities
- `player-fatigue`: Cansancio (0-100) derivado sin estado a partir de asistencia a
  entrenamientos y minutos de partido en una ventana móvil de 7 días.

### Modified Capabilities
(ninguna spec existente en `openspec/specs/` cubre `player-physical-condition` — su change de
origen ya está archivado sin haber promovido una spec global; no hay delta que aplicar)

## Impact

- Backend: elimina `Domain/Entities/TeamPlayers/TeamPlayerCondition.cs`,
  `Infrastructure/Persistence/Configuration/Entities/TeamPlayerConditionEntityConfiguration.cs`,
  `Features/Coaches/Players/Services/PlayerConditionDayEffect.cs`,
  `Features/Coaches/Players/Services/PlayerConditionRecalculationService.cs`; nueva migración
  EF `RemoveTeamPlayerCondition`; nuevo
  `Features/Coaches/Players/Services/PlayerFatigueCalculator.cs`; modifica
  `Features/Coaches/Players/Queries/GetTeamPlayerStatistics.cs` y `AppDbContext`; elimina/ajusta
  tests en `tests/RFFM.Api.Tests/UnitTests/` (`PlayerConditionDayEffectTests.cs`,
  `PlayerConditionRecalculationServiceTests.cs`, `TeamPlayerConditionTests.cs`,
  `GetTeamPlayerStatisticsHandlerTests.cs`); nuevo
  `PlayerFatigueCalculatorTests.cs`.
- Frontend (fuera de alcance de este change, coordinado en paralelo por otro agente): retirar
  `physicalFitness`/`availability` de `teamPlayerStatisticsService.ts` y sus consumidores
  (`PlayerCromo.tsx`, `IdealLineup.tsx`, export PDF).
