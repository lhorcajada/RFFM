## 1. Backend: nivel de competición y fuerza (~2h)

- [x] 1.1 Red: `tests/RFFM.Api.Tests/UnitTests/CompetitionLevelTests.cs`: divisiones (incluidas
  «PRIMERA DIVISIÓN AUTONÓMICA» antes que «PRIMERA», tildes y mayúsculas), edades, nivel = suma,
  Segunda Cadete = Primera Infantil, división desconocida → null.
- [x] 1.2 Red: actualizar `SquadStrengthCalculatorTests.cs` a nombres de competición reales y añadir:
  Primera 8º > Segunda 4º; Segunda Cadete > Segunda Infantil; titular en Segunda < suplente en Primera;
  caso real de la jornada 1; participación desconocida → jugador nuevo; grupos de al menos 16; límites
  `[0,5, 2]`.
- [x] 1.3 Red: `SeasonSimulatorTests`: con el caso real, el visitante fuerte es favorito.
- [x] 1.4 Green: `CompetitionLevel.cs` y `SquadStrengthCalculator.cs` (D1–D2); `SeasonSimulator.ModelVersion = 2`.
- **Verify**: `dotnet test --filter "CompetitionLevel|SquadStrengthCalculator|SeasonSimulator|TeamRatings"`.

## 2. Backend: versión del modelo en las jornadas (~1.5h)

- [x] 2.1 Red: `RffmRoundSimulationTests`: `ModelVersion` e `IsBackfilled` al crear; `RecomputeBackfilled`
  solo si rellenada y versión mayor; mantiene la congelación.
- [x] 2.2 Red: `RivalRoundSimulationServiceTests`: rellenada con versión antigua → se recalcula; congelada
  en su momento → no; las jornadas rellenadas quedan con `IsBackfilled`.
- [x] 2.3 Red: `RivalSimulationHistoryTests`: `IsBackfilled` en la respuesta.
- [x] 2.4 Green: entidad, configuración, servicio e historial (D3–D4); regenerar la migración
  `AddRffmRoundSimulations`.
- **Verify**: `dotnet build`; `dotnet test`.

## 3. Front (~0.5h)

- [x] 3.1 Red + Green: `RivalSimulation.test.tsx` → jornada rellenada muestra «calculada a posteriori».
- **Verify**: `npm run test -- RivalSimulation`; `npm run build`.

## 4. Cierre

- [x] 4.1 Diagnóstico de solo lectura con los datos reales: nueva fuerza de FEPE y MÓSTOLES y predicción
  de la jornada 1.
- [x] 4.2 `openspec validate rival-simulation-competition-level --strict`.
- [x] 4.3 Commits junto con `rival-simulation-history`, solo tras la confirmación del usuario.
