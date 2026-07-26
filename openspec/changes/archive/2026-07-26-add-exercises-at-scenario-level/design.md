# Design — Add Exercises at Scenario Level

Extiende el patrón de tres niveles existente (hoy: subprincipio XOR sub-subprincipio) a un tercer nivel, **escenario**, siguiendo exactamente los mismos patrones ya usados para `SubPrincipleId`.

## 1. Backend — Dominio y persistencia

- `Domain/Aggregates/Training/TasksTraining/TaskTrainingBase.cs`:
  - Añadir `public string? ScenarioId { get; set; }` (comentario: "Optional: the scenario this exercise targets (mutually exclusive with SubPrincipleId/SubSubPrincipleId).").
  - Añadir `public GameScenario? Scenario { get; set; }` (requiere `using RFFM.Api.Domain.Aggregates.GameModels;`, ya importado en este archivo).
- `Infrastructure/Persistence/Configuration/Aggregates/Trainings/TaskTrainingBaseEntityConfiguration.cs`:
  - `builder.Property(tb => tb.ScenarioId).IsRequired(false).HasMaxLength(36);` (junto a las de `SubSubPrincipleId`/`SubPrincipleId`).
  - `builder.HasOne(tb => tb.Scenario).WithMany().HasForeignKey(tb => tb.ScenarioId).IsRequired(false).OnDelete(DeleteBehavior.SetNull);` (mismo patrón que `SubPrinciple`).

## 2. Backend — Features (contrato de API)

- `CreateExercise.cs`:
  - `CreateExerciseCommand`: añadir `string? ScenarioId` (junto a `SubSubPrincipleId`/`SubPrincipleId`).
  - Handler: `exercise.ScenarioId = request.ScenarioId;` junto a las otras dos asignaciones.
  - Validador: cambiar la regla de exclusión mutua de dos vías a tres vías — exactamente uno de `ScenarioId`, `SubPrincipleId`, `SubSubPrincipleId` debe estar informado:
    ```csharp
    RuleFor(x => x)
        .Must(x => new[] { x.ScenarioId, x.SubPrincipleId, x.SubSubPrincipleId }
            .Count(id => !string.IsNullOrEmpty(id)) == 1)
        .WithMessage("Exactly one of ScenarioId, SubPrincipleId or SubSubPrincipleId must be provided.");
    ```
- `UpdateExercise.cs`: mismo patrón — `UpdateExerciseCommand` gana `ScenarioId`; handler asigna `exercise.ScenarioId = request.ScenarioId;`; validador con la misma regla de tres vías.
- `GetExercises.cs`:
  - Endpoint: añadir parámetro `string? scenarioId` a la ruta y al `GetExercisesQuery`.
  - Handler: `.Include(tb => tb.Scenario)`; `if (!string.IsNullOrEmpty(request.ScenarioId)) query = query.Where(tb => tb.ScenarioId == request.ScenarioId);`.
  - `ExerciseListItem`: añadir `string? ScenarioId, string? ScenarioName` (mismo orden relativo que `SubSubPrincipleId`/`SubPrincipleId`, después de esos dos para minimizar el diff en llamadas existentes al constructor posicional — revisar y adaptar todas las construcciones de `ExerciseListItem` en `GetExercises.cs` y `GetExerciseById.cs`).
- `GetExerciseById.cs`: `.Include(tb => tb.Scenario)`; incluir `exercise.ScenarioId, exercise.Scenario?.Name` en la construcción de `ExerciseListItem`.

## 3. Backend — Migración EF Core

- Generar migración `AddScenarioIdToTaskTrainingBase` (avisar antes si la API local está corriendo).
- Columna nullable `ScenarioId` (`varchar(36)`) + FK a `GameScenarios` con `OnDelete: SetNull`, análoga a la de `SubPrincipleId` (ver migración de referencia si existe una equivalente para ese campo).

## 4. Backend — Tests

- `CreateExerciseHandlerTests.cs` / `UpdateExerciseHandlerTests.cs`: añadir casos con `ScenarioId` informado (éxito), casos con dos o tres ids informados a la vez (falla validación), caso con ninguno informado (falla validación). Revisar los tests existentes de exclusión mutua de dos vías y extenderlos a tres.
- `GetExercisesHandlerTests.cs`: caso de filtrado por `scenarioId`.
- `GetExerciseByIdHandlerTests.cs`: caso que verifica `ScenarioId`/`ScenarioName` en la respuesta.

## 5. Frontend — Tipos y servicios

- `types/training.ts`:
  - `Exercise`: añadir `scenarioId?: string | null; scenarioName?: string | null;`.
  - `CreateExerciseRequest`: añadir `scenarioId?: string | null;`.
- `services/trainingService.ts`:
  - `getExercises(clubId, opts)`: `opts` gana `scenarioId?: string | null`; si está presente, añadir a los params de la petición.

## 6. Frontend — `PrincipleExercisesSection.tsx`

- `PrincipleLevelKind`: `"subSubPrinciple" | "subPrinciple" | "scenario"`.
- `loadExercises`: el `opts` pasado a `trainingService.getExercises` se decide por `levelKind` (añadir rama `scenario` → `{ scenarioId: levelApiId }`).
- `buildExerciseParams`: añadir rama `scenario` → `createParams.set("scenarioId", levelApiId); createParams.set("scenarioName", levelName);` (nombres de query param a definir en NewExercisePage.tsx, paso 8).

## 7. Frontend — `ScenarioAccordion.tsx` (`ScenarioDetailView`)

- Añadir `const [exerciseCount, setExerciseCount] = useState(0);` en `ScenarioDetailView` (hoy no lo tiene).
- Añadir el chip de conteo en la cabecera del escenario, mismo patrón que `SubPrincipleDetailView` (líneas 95-102 de este archivo): `{exerciseCount > 0 && <Chip icon={<FitnessCenterIcon .../>} label={`${exerciseCount} ej.`} size="small" className={styles.exerciseChip} />}`. Requiere envolver el bloque de contexto/media/principios en un header similar al de `SubPrincipleDetailView` (`spDetailHeader`) — reutilizar o crear una clase CSS equivalente `scenarioDetailHeader` en `ScenarioAccordion.module.css` si no existe ya un contenedor de cabecera adecuado.
- Montar `PrincipleExercisesSection` al final de `ScenarioDetailView` (tras el `DrillDownPanel` de subprincipios), con `levelKind="scenario"`, `levelApiId={scenario.apiId}`, `levelName={scenario.name}`, `active`, `onCountChange={setExerciseCount}`. **Nota**: `Scenario` (tipo `gameModel.ts`) ya tiene `apiId?: string` — comprobar que está poblado en el flujo de listado (mismo patrón que `sp.apiId` en `SubPrincipleDetailView`).
- Import: `FitnessCenterIcon` ya está importado en este archivo (usado en `SubPrincipleDetailView`); reutilizar. Importar `PrincipleExercisesSection` ya está importado.

## 8. Frontend — Formulario de creación/edición de ejercicio

- `NewExercisePage.tsx`:
  - Leer nuevo query param `scenarioId` y `scenarioName` (patrón idéntico a `subPrincipleId`/`spName`).
  - Pasar `scenarioId` a `useExerciseForm`.
- `hooks/useExerciseForm.ts`:
  - `resolveLevelIds` pasa a `resolveLevelIds(scenarioId, subSubPrincipleId, subPrincipleId)` con prioridad sub-subprincipio > subprincipio > escenario (el más específico gana; si llegan varios ids por fallback de URL, solo se conserva el más específico y el resto se fuerza a `null`). Devuelve `{ scenarioId, subSubPrincipleId, subPrincipleId }`.
  - `UseExerciseFormParams` gana `scenarioId: string | null`.
  - `applyExercise`: usar `resolveLevelIds(exercise.scenarioId ?? scenarioId, exercise.subSubPrincipleId ?? subSubPrincipleId, exercise.subPrincipleId ?? subPrincipleId)`.
  - `setLevel(kind: "subSubPrinciple" | "subPrinciple" | "scenario")`: al fijar un nivel, los otros dos se ponen a `null` (extender la función existente de dos a tres ramas).
  - `useEffect` de reset por cambio de props: incluir `scenarioId` en las dependencias y en `resolveLevelIds`.
- `components/ExerciseFormPanel.tsx`:
  - `Props` gana `scenarioId: string | null; scenarioName: string | null;`.
  - El `Select` "Vinculado a" (líneas 184-199) pasa a mostrarse si hay **al menos dos** de los tres ids disponibles (antes exigía los dos exactos); las opciones (`MenuItem`) se generan condicionalmente según qué ids estén disponibles: `Escenario: {scenarioName}` / `Subprincipio: {subPrincipleName}` / `Habilidad: {subSubPrincipleName}`. El `value` del `Select` se deriva de cuál de los tres campos de `formData` está poblado.

## 9. Tests (TDD)

- Backend: casos descritos en §4.
- Frontend:
  - `PrincipleExercisesSection` no tiene test dedicado hoy (se testea indirectamente vía `SubSubPrincipleCard.test.tsx`/`ScenarioAccordion.test.tsx`); añadir cobertura del caso `levelKind="scenario"` en `ScenarioAccordion.test.tsx` (mock de `trainingService.getExercises` con `scenarioId`, verificar sección de ejercicios visible en el detalle de escenario y chip de conteo en la cabecera).
  - `useExerciseForm.test.ts`: casos de `resolveLevelIds` con los tres niveles y prioridad de especificidad.
  - `ExerciseFormPanel.test.tsx`: el selector "Vinculado a" muestra las tres opciones disponibles cuando aplica, y solo las que corresponden cuando faltan ids.
