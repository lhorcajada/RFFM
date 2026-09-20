## 1. Rodaje: peso de `Fisico` 0.30 (TDD)

- [x] 1.1 Actualizar `tests/RFFM.Api.Tests/UnitTests/PlayerReadinessCalculatorTests.cs` (Red):
      el caso "entreno Físico puro aporta 0" pasa a "aporta con peso 0.30" (menos que Técnico
      0.60 y Táctico 1.00); el caso de sesión con `["Tactico","Fisico"]` espera media 0.65; el
      resto sin cambios.
- [x] 1.2 Cambiar `ReadinessTrainingWeights[Fisico]` de `0.00` a `0.30` en
      `Features/Coaches/Players/Services/PlayerReadinessCalculator.cs` y actualizar su comentario
      de razonamiento (Green). Ver `design.md` → Decisión 11.
- [x] 1.3 `dotnet test --filter PlayerReadinessCalculatorTests` en verde.

## 2. Helpers puros de Estado de forma (TDD)

- [x] 2.1 Crear `FormStatusRecencyTests.cs` (Red): `d = 0` y `d = 7` → 1.0; `d = 8` → ~0.952;
      `d = 21` → 0.5; `d = 42` → ~0.177.
- [x] 2.2 Implementar `FormStatusRecency.Weight(int daysAgo)` en
      `Features/Coaches/Players/Services/` con las constantes `RecencyFullWeightDays = 7`,
      `RecencyHalfLifeDays = 14` (Green). Ver Decisión 2.
- [x] 2.3 Crear `FormStatusOutcomeTests.cs` (Red), una fila por línea de la tabla de la
      Decisión 4: Lesión → Falta (aunque haya `Attendance`); Decisión técnica → Excluida;
      `Attendance`/`LateArrival` → Asistida; `UnexcusedAbsence`/`ExcusedAbsence` → Falta;
      `Deconvoke` sin asistencia → Excluida; `Justified` sin asistencia → Falta; pendiente →
      Excluida.
- [x] 2.4 Implementar `FormStatusOutcome.Classify(...)` y el enum `{ Attended, Absent, Excluded }`
      (Green), con el mismo orden de comprobación que `PlayerReadinessCalculator.PointsFor`.

## 3. `PlayerFormStatusCalculator` reescrito (TDD)

- [x] 3.1 Reescribir `tests/RFFM.Api.Tests/UnitTests/PlayerFormStatusCalculatorTests.cs` (Red),
      casos fallidos primero:
      - sin sesiones ni partidos computables → `FormStatus` `null`;
      - eventos con `DaysAgo > 42` no cuentan;
      - una falta (injustificada, justificada, lesión) queda en el denominador y aporta 0;
      - decisión técnica / pendiente → excluida (`ExcludedTrainings`/`ExcludedMatches`);
      - falta a `Fisico` reduce más que a `Tactico`; falta a `Tecnico` puro no reduce;
      - sesión con varios tipos = media; sin tipo = 1.00;
      - todas las sesiones `Tecnico` puras → `TrainingTypeWeightFallbackUsed` y ratio por
        asistencia/recencia;
      - un partido con 10' vs 70' (Cadete) → ratio 0.143 / 1.0; más de 70' se acota a 1.0;
      - partido con falta = 0 y en denominador; suplente presente sin minutos = 0; excluido si
        decisión técnica;
      - tipo de partido (Liga vs Amistoso) no altera el ratio;
      - un solo bloque disponible → peso aplicado 1.00; ambos vacíos → `null`;
      - los cinco casos A-E del ejemplo del `design.md` (100/90, 81, 55, 46, 50);
      - asiste a todo + juega completo + Cansancio 0 → 100; solo entrena sin jugar +
        Cansancio 0 → 55; Cansancio 100 → factor 0.5.
- [x] 3.2 Implementar `PlayerFormStatusCalculator` (Green) con la firma y el `Result` de la
      Decisión 10 (`categoryHalfMinutes` → `duración = 2×`, `minutosCompletos = 0.875×`), pesos
      nominales 0.55/0.45, redondeo `MidpointRounding.AwayFromZero`. Eliminar
      `BaselineTrainings`/`BaselineMatches`/`ExpectedMinutesPerMatch` de esta clase (las
      constantes de `PlayerReadinessCalculator` se mantienen).
- [x] 3.3 Refactor: comentario de razonamiento por constante (como en los calculadores
      existentes); `MatchTypeWeighting` deja de referenciarse desde Estado de forma (actualizar
      su comentario XML).
- [x] 3.4 `dotnet test --filter PlayerFormStatusCalculatorTests` en verde.

## 4. `GetTeamPlayerStatistics` y DTOs (TDD)

- [x] 4.1 Actualizar `GetTeamPlayerStatisticsHandlerTests.cs` (Red): Cadete con datos completos
      → `FormStatus` 100 y breakdown con `FullMatchMinutes` 70 y `CategoryMatchMinutes` 80;
      categoría sin duración estándar (F7) → `FormStatus` y breakdown `null`; `Fatigue` y
      `FatigueFactor` del breakdown coinciden con `PlayerStatisticsDto.Fatigue`; jugador con
      falta a partido → ratio 0; jugador no convocado → partido excluido (`ExcludedMatches`).
- [x] 4.2 Sustituir `FormStatusBreakdownDto`, `FormStatusConsideredTrainingDto` y
      `FormStatusConsideredMatchDto` por los de `design.md` → Decisión 9.
- [x] 4.3 En el handler: calcular Cansancio antes que Estado de forma; construir por jugador la
      lista de partidos del equipo en ventana (eventos Liga/Amistoso/Torneo con participación
      `finished`, dentro de `JoinedDate..LeftDate`), clasificando con `FormStatusOutcome`;
      clasificar las convocatorias de entreno; llamar al calculador solo si
      `hasStandardMinutes`; mapear el `Result` al DTO. Sin queries de tabla nuevas.
- [x] 4.4 `dotnet test --filter GetTeamPlayerStatisticsHandlerTests` en verde.

## 5. Verificación backend

- [x] 5.1 `dotnet build` y `dotnet test` completos en `Back/ExtractionApi` sin errores ni tests
      saltados.
- [x] 5.2 `openspec validate player-form-status-received-offered-load --strict` en verde.

## 5b. Factor de volumen de entrenos (Decisión 12)

- [x] 5b.1 Tests Red del calculador: volumen de entrenos, un solo bloque, Lucas ≈ 67, Zuri ≤ 20,
      ideal = 100; ajustar tests existentes que asumían 100 con pocos eventos.
- [x] 5b.2 Implementar el factor en `PlayerFormStatusCalculator` y campos aditivos en
      `FormStatusBreakdownDto` + mapeo en el handler.
- [x] 5b.3 `dotnet build` y `dotnet test` en verde (1408 tests).
- [x] 5b.5 Quitar el volumen de partidos (calendario del equipo, no del jugador): eliminar
      `ReferenceMatches`, `MatchVolumeFactor`, `MatchRatioComponent`; añadir
      `MatchMinutesPossibleTotal`; tests y docs actualizados (1407 tests en verde).
- [x] 5b.4 Frontend: mostrar `TrainingRatioComponent`, `TrainingVolumeFactor`, sesiones de
      referencia y minutos jugados/posibles (`MatchMinutesPlayedTotal`/`MatchMinutesPossibleTotal`)
      (front-specialist).

## 6. Frontend (front-specialist) — `Front/src/apps/coach`

Depende de los DTOs de la sección 4. TDD con Vitest + Testing Library; CSS Modules; tarjetas,
nunca tablas; sin `any`; textos en español.

- [x] 6.1 `services/teamPlayerStatisticsService.ts` (+ `__tests__/teamPlayerStatisticsService.test.ts`,
      Red primero): actualizar los tipos `FormStatusBreakdown`, `FormStatusConsideredTraining` y
      `FormStatusConsideredMatch` a los campos de `design.md` → Decisión 9. Eliminar los campos
      retirados (`trainingSessionsBaseline`, `weightedMatchMinutesInWindow`,
      `matchMinutesExpected`, `sessionsConsidered`, `trainingWeight`, `matchWeight`,
      `contribution`). Manejar `trainingComponent`/`matchComponent` nulables.
- [x] 6.2 `components/PlayerFormBars/PlayerFormBars.tsx` (+ test): el desplegable de desglose
      pasa a explicar el cálculo en cuatro pasos, en este orden:
      1. **Entrenos 55%**: "Recibidas X de Y sesiones ofrecidas (peso por tipo y recencia) → Z%"
         (`trainingSessionsAttended`/`trainingSessionsOffered`,
         `trainingComponent`); lista de sesiones (tarjetas apiladas) con fecha, tipos, peso de
         tipo, peso de recencia y "asistió / faltó (motivo)". Si `trainingTypeWeightFallbackUsed`,
         nota "las sesiones Técnicas puras se cuentan con peso 1".
      2. **Partidos 45%**: "Minutos jugados / minutos completos (`fullMatchMinutes`) por
         partido → W%"; por partido: minutos, ratio en %, recencia y estado (`Played`,
         `NotPlayed`, `Absent`).
      3. **Cansancio N% → factor (1−N/200)** (`fatigue`, `fatigueFactor`).
      4. **Resultado = (0.55×Z + 0.45×W) × factor** usando `trainingWeightApplied` /
         `matchWeightApplied` (mostrar aviso cuando difieran de los nominales: "no hay partidos
         en la ventana, el bloque de entrenos pesa 100%") y `baseScore`.
      Mostrar `excludedTrainings`/`excludedMatches` como texto informativo ("N eventos
      excluidos por decisión técnica o sin resultado"). Mostrar la regla de recencia
      (`recencyFullWeightDays`, `recencyHalfLifeDays`, `windowDays`) en una nota corta.
- [x] 6.3 `pages/squad/components/SquadStatistics.tsx` y `pages/player/PlayerDetail.tsx`
      (+ tests existentes en `pages/squad/components/__tests__/`): ajustar a los tipos nuevos;
      `formStatus` `null` sigue mostrando "—" (ahora también para equipos F7 o menores).
      Actualizar el tooltip de Estado de forma (ya no "70/30 sobre 8 semanas").
- [x] 6.4 `pages/squad/squadStatsPdfExport.ts` (+ `__tests__/squadStatsPdfExport.test.ts`): la
      exportación usa los mismos campos nuevos; sin columnas de tabla fija para el desglose.
- [x] 6.5 `npm run test` y `npm run build` en verde en `Front/`. Comprobar visualmente el
      desplegable en ~360 px y en escritorio.

## 7. Cierre

- [x] 7.1 Open Questions 2 y 4 resueltas por el usuario (Deconvoke = falta; bloque vacío solo
      renormaliza si el equipo no tuvo eventos). Implementado en `FormStatusOutcome` y
      `PlayerFormStatusCalculator` con tests (caso Zuri en `GetTeamPlayerStatisticsHandlerTests`).
- [x] 7.2 `openspec validate player-form-status-received-offered-load --strict`, verificación
      (`openspec-verify-change`) y archivo tras archivar el change previo
      `player-form-status-training-match-weighting`.
