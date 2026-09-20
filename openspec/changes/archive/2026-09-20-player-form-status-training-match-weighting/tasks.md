## 1. Helpers compartidos de ponderación (TDD)

- [x] 1.1 Crear `tests/RFFM.Api.Tests/UnitTests/TrainingTypeWeightingTests.cs` (Red): tipo único
      presente devuelve su peso; varios tipos presentes devuelven la media aritmética solo de los
      presentes; lista vacía devuelve el peso neutro `1.00`; tipo no reconocido en el diccionario
      se ignora en la media (defensivo).
- [x] 1.2 Implementar `Features/Coaches/Players/Services/TrainingTypeWeighting.cs` (Green): ver
      `design.md` → Decisión 1.
- [x] 1.3 Crear `tests/RFFM.Api.Tests/UnitTests/MatchTypeWeightingTests.cs` (Red): `Match` → 1.00,
      `FriendlyMatch` → 0.70, `Tournament` → 0.70, `EventTypeId` no reconocido → 1.00 (neutro).
- [x] 1.4 Implementar `Features/Coaches/Players/Services/MatchTypeWeighting.cs` (Green): ver
      `design.md` → Decisión 2.

## 2. PlayerFatigueCalculator — ponderación por tipo (TDD)

- [x] 2.1 Reescribir `tests/RFFM.Api.Tests/UnitTests/PlayerFatigueCalculatorTests.cs` (Red):
      conservar todos los casos existentes (ahora con listas de tuplas sin tipo/tipo por
      defecto `Match`, deben seguir dando el mismo resultado que antes del cambio — retrocompat);
      añadir: entreno `Fisico` vs `Tecnico` con el mismo `daysAgo` → `Fisico` pesa más; partido
      `Match` vs `FriendlyMatch` con los mismos minutos → `Match` pesa más; sesión con
      `["Fisico","Tecnico"]` → media de ambos pesos; sesión sin tipos → peso neutro (mismo
      resultado que el modelo actual).
- [x] 2.2 Cambiar la firma de `Calculate` en
      `Features/Coaches/Players/Services/PlayerFatigueCalculator.cs` para recibir
      `IReadOnlyList<(int DaysAgo, IReadOnlyList<string> TrainingTypes)>` y
      `IReadOnlyList<(int DaysAgo, int MinutesPlayed, int EventTypeId)>`, aplicando
      `TrainingTypeWeighting`/`MatchTypeWeighting` (Green). Declarar la tabla de pesos
      `FatigueTrainingWeights` (Físico 1.00 / Táctico 0.70 / Técnico 0.40) con el comentario de
      razonamiento de `design.md` → Decisión 1.
- [x] 2.3 Confirmar `dotnet test --filter PlayerFatigueCalculatorTests` en verde.

## 3. PlayerReadinessCalculator — ponderación por tipo (TDD)

- [x] 3.1 Reescribir `tests/RFFM.Api.Tests/UnitTests/PlayerReadinessCalculatorTests.cs` (Red):
      conservar los casos existentes; añadir: entreno `Tactico` vs `Tecnico` con el mismo
      resultado de asistencia → `Tactico` aporta más; entreno `Fisico` puro → aporta `0` al
      `TrainingComponent` aunque la asistencia sea real; partido `Match` vs `FriendlyMatch` con
      los mismos minutos → `Match` pesa más; sesión con varios tipos → media solo de los
      presentes; sesión sin tipos → peso neutro (mismo resultado que el modelo actual).
- [x] 3.2 Añadir `TrainingTypes: IReadOnlyList<string>` a `TrainingOutcome` y cambiar la firma de
      minutos de partido a `IReadOnlyList<(int MinutesPlayed, int EventTypeId)>` en
      `Features/Coaches/Players/Services/PlayerReadinessCalculator.cs`, aplicando
      `TrainingTypeWeighting`/`MatchTypeWeighting` (Green). Declarar
      `ReadinessTrainingWeights` (Táctico 1.00 / Técnico 0.60 / Físico 0.00) con el comentario de
      razonamiento de `design.md` → Decisión 1. Documentar en el XML doc del record que
      `MatchMinutesInWindow` pasa a ser una suma ponderada, no minutos reales.
- [x] 3.3 Confirmar `dotnet test --filter PlayerReadinessCalculatorTests` en verde.

## 4. Nuevo PlayerFormStatusCalculator (TDD)

- [x] 4.1 Crear `tests/RFFM.Api.Tests/UnitTests/PlayerFormStatusCalculatorTests.cs` (Red): sin
      datos → `FormStatus` `null`; asistencia `Fisico` vs `Tactico` con el mismo resultado →
      `Fisico` aporta más; asistencia `Tecnico` puro → aporta `0`; ausencia justificada/lesión →
      aporta `0` (a diferencia de Rodaje); partido `Match` vs `FriendlyMatch` con los mismos
      minutos → `Match` pesa más; sesión con varios tipos → media solo de los presentes; sesión
      sin tipos → peso neutro; ambos componentes saturan a 100 sin superarlo.
- [x] 4.2 Implementar `Features/Coaches/Players/Services/PlayerFormStatusCalculator.cs` (Green)
      según `design.md` → Decisión 3, reutilizando `WindowWeeks`/`BaselineTrainings`/
      `BaselineMatches`/`ExpectedMinutesPerMatch` de `PlayerReadinessCalculator`.
- [x] 4.3 Confirmar `dotnet test --filter PlayerFormStatusCalculatorTests` en verde.

## 5. Integración en el handler

- [x] 5.1 En `Features/Coaches/Players/Queries/GetTeamPlayerStatistics.cs`, ampliar el
      `Select(...)` de `trainingEventsInWindow` con `se.TrainingTypes` y construir
      `trainingEventTrainingTypesById`; ampliar el `Select(...)` de `matchEventsInWindow` con
      `se.EventTypeId` y construir `matchEventEventTypeById` (sin queries nuevas).
- [x] 5.2 Actualizar `trainingsAttendedInFatigueWindowByPlayer` y
      `matchMinutesInFatigueWindowByPlayer` para incluir `TrainingTypes`/`EventTypeId` junto al
      dato ya existente, y actualizar la llamada a `PlayerFatigueCalculator.Calculate(...)`.
- [x] 5.3 Actualizar la construcción de `trainingOutcomes` (añadir `TrainingTypes`) y
      `matchMinutesInWindowByPlayer` (pasar a `List<(int MinutesPlayed, int EventTypeId)>`), y la
      llamada a `PlayerReadinessCalculator.Calculate(...)`.
- [x] 5.4 Construir `trainingAttendancesInWindowByPlayer` (a partir de
      `trainingConvocationsInWindow`, reutilizando la condición de asistencia real ya usada por
      Rodaje) y llamar `PlayerFormStatusCalculator.Calculate(...)` por jugador, reutilizando
      `matchMinutesInWindowByPlayer` ya ponderable por tipo.
- [x] 5.5 Añadir `FormStatus`/`FormStatusBreakdown` (nuevo record `FormStatusBreakdownDto`) al
      `PlayerStatisticsDto` y a la construcción del resultado por jugador, según `design.md` →
      Decisión 7.

## 6. Tests de integración del handler

- [x] 6.1 Actualizar `tests/RFFM.Api.Tests/UnitTests/GetTeamPlayerStatisticsHandlerTests.cs`:
      confirmar que los tests existentes de `Fatigue`/`Readiness` siguen pasando sembrando
      eventos sin `TrainingTypes` (retrocompat, peso neutro).
- [x] 6.2 Añadir tests end-to-end para `FormStatus`: jugador sin datos → `null`; jugador con
      entrenos `Fisico` recientes y partido de Liga → `FormStatus` alto; jugador con solo entrenos
      `Tecnico` → `FormStatus` bajo/nulo salvo por minutos de partido.
- [x] 6.3 Añadir al menos un test end-to-end que confirme la ponderación por tipo de entreno en
      `Fatigue` y en `Readiness` usando datos sembrados con `SeedSportEventAsync` (incluyendo
      `TrainingTypes`) y `SeedConvocationAsync`.

## 7. Verificación

- [x] 7.1 `dotnet build` en verde.
- [x] 7.2 `dotnet test` completo en verde (área afectada: `RFFM.Api.Tests`).
- [x] 7.3 (superado: el frontend se implementó después en el change player-form-status-received-offered-load) Revisar que no se ha tocado ningún archivo bajo `Front/` en este change (el frontend se
      aborda en un change posterior, ver `design.md` → Non-Goals).
- [x] 7.4 No commitear/pushear — dejar los cambios en el working tree para revisión del usuario.
