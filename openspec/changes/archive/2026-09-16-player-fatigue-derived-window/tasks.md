## 1. Calculador puro (TDD)

- [x] 1.1 Escribir `tests/RFFM.Api.Tests/UnitTests/PlayerFatigueCalculatorTests.cs` (Red): sin
      eventos → 0; solo entrenos parcial/completo → proporcional; solo partido con minutos
      parciales/completos → proporcional; combinación completa → 100; ningún componente supera
      100 por encima de la referencia.
- [x] 1.2 Implementar `Features/Coaches/Players/Services/PlayerFatigueCalculator.cs` (Green):
      función pura, ventana de 7 días, pesos 40% entreno / 60% partido, referencia 2
      entrenos/70 min partido, `Fatigue` siempre `int` (no nullable).
- [x] 1.3 Confirmar `dotnet test --filter PlayerFatigueCalculatorTests` en verde.

## 2. Integración en el handler

- [x] 2.1 En `Features/Coaches/Players/Queries/GetTeamPlayerStatistics.cs`, añadir queries de
      ventana de 7 días (`fatigueWindowStart`) para entrenos asistidos y minutos de partido por
      jugador, siguiendo el mismo patrón de las queries de 8 semanas ya existentes para Rodaje.
- [x] 2.2 Sustituir la llamada a `conditionService.RecalculateAsync(...)` por
      `PlayerFatigueCalculator.Calculate(...)` usando los datos de la ventana de 7 días.
- [x] 2.3 Eliminar `PhysicalFitness`/`Availability` de `PlayerStatisticsDto` y de la
      construcción del resultado; eliminar la inyección de `PlayerConditionRecalculationService`
      del constructor del `Handler`.
- [x] 2.4 Actualizar `tests/RFFM.Api.Tests/UnitTests/GetTeamPlayerStatisticsHandlerTests.cs`:
      eliminar/reescribir los tests que referencian `PhysicalFitness`/`Availability`
      (`NewPlayerWithNoActivity_PhysicalConditionDefaultsToInitialValues`,
      `Availability_IsNeverNegative_WhenFatigueExceedsPhysicalFitness`), quitar el argumento
      `PlayerConditionRecalculationService` de las instanciaciones del `Handler`, y añadir
      cobertura de `Fatigue` derivado con datos sembrados en la ventana de 7 días.

## 3. Limpieza de código muerto

- [x] 3.1 Eliminar `Domain/Entities/TeamPlayers/TeamPlayerCondition.cs`.
- [x] 3.2 Eliminar
      `Infrastructure/Persistence/Configuration/Entities/TeamPlayerConditionEntityConfiguration.cs`.
- [x] 3.3 Eliminar `Features/Coaches/Players/Services/PlayerConditionDayEffect.cs`.
- [x] 3.4 Eliminar `Features/Coaches/Players/Services/PlayerConditionRecalculationService.cs`.
- [x] 3.5 Eliminar el `DbSet<TeamPlayerCondition> TeamPlayerConditions` de
      `Infrastructure/Persistence/AppDbContext.cs`.
- [x] 3.6 Eliminar `tests/RFFM.Api.Tests/UnitTests/PlayerConditionDayEffectTests.cs`,
      `PlayerConditionRecalculationServiceTests.cs`, `TeamPlayerConditionTests.cs`.

## 4. Migración de base de datos

- [x] 4.1 Generar migración `RemoveTeamPlayerCondition` con `.\manage-migrations.ps1` desde
      `Back/ExtractionApi` (elimina la tabla `TeamPlayerConditions`).
- [x] 4.2 Revisar el `Designer.cs`/`AppDbContextModelSnapshot.cs` generado para confirmar que
      no queda ninguna referencia a `TeamPlayerCondition`.

## 5. Verificación

- [x] 5.1 `dotnet build` en verde.
- [x] 5.2 `dotnet test` completo en verde (áreas afectadas: `RFFM.Api.Tests`).
- [x] 5.3 No commitear/pushear — dejar los cambios en el working tree para revisión del
      usuario.
