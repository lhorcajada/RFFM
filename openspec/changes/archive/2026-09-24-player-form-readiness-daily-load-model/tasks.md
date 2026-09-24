## 1. Motor `DailyLoadModel` (TDD) — back-specialist

- [x] 1.1 Crear `tests/RFFM.Api.Tests/UnitTests/DailyLoadModelTests.cs` (Red):
      - sin eventos → `Value` 0, sin pasos;
      - un evento con carga 1 y k 0.16 → `100·(1 − e^(−0.16))`;
      - saturación: el valor nunca supera 100;
      - monotonía: mismos días, cargas (1.5·106/70 repartidas 70/36 y 36/70) vs (1.5·108/70
        repartidas 90/18) → la de más carga ≥;
      - gracia: 4 días de descanso no restan; los días 5, 7, 14, 21, 28 dan 99.5, 97, 77.5, 56.5,
        35.5 desde 100 (parámetros de EF);
      - suelo en 0;
      - día con evento de carga 0 corta la racha;
      - varios eventos el mismo día suman carga;
      - pasos: uno "Activity" por día activo, uno "Decay" por racha con pérdida (`Date`/`EndDate`),
        ninguno para rachas dentro de la gracia; `CurrentRestStreakDays` correcto.
- [x] 1.2 Implementar `Features/Coaches/Players/Services/DailyLoadModel.cs` (Green) según
      `design.md` → Decisión 1.
- [x] 1.3 `dotnet test --filter DailyLoadModelTests` en verde.

## 2. `PlayerFormStatusCalculator` sobre el motor (TDD) — back-specialist

- [x] 2.1 Reescribir `PlayerFormStatusCalculatorTests.cs` (Red), un test por escenario de
      `specs/player-form-status/spec.md`: `null` sin actividad; Físico hoy → 15; carga por tipo;
      Técnico puro mantiene y no suma; 70' Cadete → 21; Liga = Amistoso; 106' vs 108' monótono;
      convocado con 0' = descanso; motivo de falta irrelevante + `MissedEvents`; vacaciones de
      7 días → 97; inicio en la fecha de inicio de la reproducción.
- [x] 2.2 Reescribir `PlayerFormStatusCalculator.cs` (Green): constantes de la Decisión 2,
      nuevas firmas de la Decisión 6, sin parámetro `fatigue`. Eliminar `FormStatusRecency.cs`
      y `FormStatusRecencyTests.cs`.
- [x] 2.3 `dotnet test --filter PlayerFormStatusCalculatorTests` en verde.

## 3. `PlayerReadinessCalculator` sobre el motor (TDD) — back-specialist

- [x] 3.1 Reescribir `PlayerReadinessCalculatorTests.cs` (Red) por escenario de
      `specs/player-readiness/spec.md`: Táctico 10 vs Técnico 6; Físico 0.30; mixta 0.65; sin tipo
      1.00; Liga 14 vs Amistoso 10; monotonía; 21 días → 100; 28/42/56 → 93/65/37; solo asistencia real.
- [x] 3.2 Reescribir `PlayerReadinessCalculator.cs` (Green) conservando
      `ReadinessTrainingWeights` y `MatchTypeWeighting`.
- [x] 3.3 `dotnet test --filter PlayerReadinessCalculatorTests` en verde.

## 4. Handler y contrato (TDD) — back-specialist

- [x] 4.1 Actualizar `GetTeamPlayerStatisticsHandlerTests.cs` (Red): DTO `DailyLoadBreakdownDto`
      para EF y Rodaje; EF no cambia con `Fatigue`; entrenos de hace 70 días influyen; categoría
      sin duración → EF `null` y Rodaje con valor.
- [x] 4.2 `GetTeamPlayerStatistics.cs` (Green): ventana de carga a 84 días, nuevos DTOs
      (Decisión 5), eliminación de los antiguos, mapeo de `MissedEvents`, EF sin `Fatigue`.
- [x] 4.3 `dotnet build` y `dotnet test` completos en verde.

## 5. Frontend (TDD) — front-specialist

- [x] 5.1 `teamPlayerStatisticsService.ts` + su test: tipo `DailyLoadBreakdown` común.
- [x] 5.2 `DailyLoadBreakdownView.test.tsx` (Red): cabecera con valor y racha ("Empieza a bajar
      en N días" / "Bajando desde hace N días"), pasos de actividad y de descanso como
      tarjetas, faltas con motivo, sin tablas.
- [x] 5.3 `DailyLoadBreakdownView.tsx` + `.module.css` (Green); eliminar
      `FormStatusBreakdownView`/`ReadinessBreakdownView` y sus tests; actualizar
      `MetricInfoDialog` (sin multiplicador de Cansancio) y `breakdownFixtures.ts`.
- [x] 5.4 `liveReadiness.ts` + tests (Red → Green) con la fórmula de la Decisión 7.
- [x] 5.5 Ajustar fixtures del resto de tests que construyen `formStatusBreakdown`/
      `readinessBreakdown` (SquadStatistics, Simulación, Partido en directo, PlayerDetail).
- [x] 5.6 `npm run test` y `npm run build` en verde; comprobación visual del popup validada por el usuario.

## 6. Verificación

- [x] 6.1 `openspec validate player-form-readiness-daily-load-model --strict`.
- [x] 6.2 Revisar con el usuario el caso real de la captura (125/120/110/106/108') en la app.
