# Implement — Add Exercises at Scenario Level

Guion técnico para `openspec-implementer`. Cambio Frontend + Backend. TDD estricto en los bloques indicados: ajustar/escribir tests ANTES del código de producción, confirmar que fallan (Red), implementar (Green).

> ⚠️ El usuario tiene la API backend corriendo localmente. Antes de `dotnet build`/`dotnet test`/`dotnet run`/`dotnet ef`, PARA y pide confirmación explícita de que el proceso está detenido. Si no puedes obtener esa confirmación (por ejemplo, ejecución no interactiva), NO ejecutes esos comandos backend; deja el trabajo backend hecho a nivel de código/migración generada pero sin verificar con `dotnet`, y repórtalo como pendiente con la mayor claridad posible.

Contexto: se extiende el patrón existente de vínculo de ejercicio de DOS niveles mutuamente excluyentes (`SubPrincipleId` XOR `SubSubPrincipleId`) a TRES (`ScenarioId` XOR `SubPrincipleId` XOR `SubSubPrincipleId`). En cada paso, seguir el mismo patrón ya usado para `SubPrincipleId` — es la referencia más fiable de cómo se hizo la última vez.

## Paso 1 — Backend: dominio y persistencia

1. `Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/Training/TasksTraining/TaskTrainingBase.cs`:
   - Añadir, junto a `SubPrincipleId`: `/// <summary>Optional: the scenario this exercise targets (mutually exclusive with SubPrincipleId/SubSubPrincipleId).</summary>` seguido de `public string? ScenarioId { get; set; }`.
   - Añadir, junto a `public SubPrinciple? SubPrinciple { get; set; }`: `public GameScenario? Scenario { get; set; }`.
2. `Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/Configuration/Aggregates/Trainings/TaskTrainingBaseEntityConfiguration.cs`:
   - Junto a la configuración de `SubPrincipleId`: `builder.Property(tb => tb.ScenarioId).IsRequired(false).HasMaxLength(36);`
   - Junto a `builder.HasOne(tb => tb.SubPrinciple)...`: `builder.HasOne(tb => tb.Scenario).WithMany().HasForeignKey(tb => tb.ScenarioId).IsRequired(false).OnDelete(DeleteBehavior.SetNull);`

## Paso 2 — Backend: contrato de API

1. `Features/Coaches/Trainings/Exercises/CreateExercise.cs`:
   - `CreateExerciseCommand`: añadir `string? ScenarioId` como parámetro (junto a `SubSubPrincipleId`/`SubPrincipleId`).
   - Handler: añadir `ScenarioId = request.ScenarioId,` en la construcción de `TaskTrainingBase`.
   - Validador: sustituir la regla `Must(x => string.IsNullOrEmpty(x.SubSubPrincipleId) != string.IsNullOrEmpty(x.SubPrincipleId))` por:
     ```csharp
     RuleFor(x => x)
         .Must(x => new[] { x.ScenarioId, x.SubPrincipleId, x.SubSubPrincipleId }
             .Count(id => !string.IsNullOrEmpty(id)) == 1)
         .WithMessage("Exactly one of ScenarioId, SubPrincipleId or SubSubPrincipleId must be provided.");
     ```
2. `Features/Coaches/Trainings/Exercises/UpdateExercise.cs`: mismo patrón — `UpdateExerciseCommand` gana `ScenarioId`; handler añade `exercise.ScenarioId = request.ScenarioId;`; validador con la misma regla de tres vías que en el paso anterior.
3. `Features/Coaches/Trainings/Exercises/GetExercises.cs`:
   - Ruta: añadir parámetro `string? scenarioId` a la lambda del endpoint y pasarlo al `GetExercisesQuery`.
   - `GetExercisesQuery`: añadir `string? ScenarioId`.
   - Handler: `.Include(tb => tb.Scenario)` junto a los otros `Include`; añadir `if (!string.IsNullOrEmpty(request.ScenarioId)) query = query.Where(tb => tb.ScenarioId == request.ScenarioId);`.
   - `ExerciseListItem`: añadir `string? ScenarioId, string? ScenarioName` como nuevos parámetros del record (colocarlos justo antes de `SubSubPrincipleId` o justo después de `SubPrincipleName` — elegir una posición y aplicarla consistentemente en ambos archivos que construyen este record).
   - Actualizar la construcción de `ExerciseListItem` en el `Select` para pasar `tb.ScenarioId, tb.Scenario?.Name`.
4. `Features/Coaches/Trainings/Exercises/GetExerciseById.cs`:
   - `.Include(tb => tb.Scenario)`.
   - Actualizar la construcción de `ExerciseListItem` para incluir `exercise.ScenarioId, exercise.Scenario?.Name` en la misma posición elegida en el paso anterior.

## Paso 3 — Backend: migración EF Core

1. Con la API parada (confirmar explícitamente con el usuario antes), generar:
   ```
   cd Back/ExtractionApi
   dotnet ef migrations add AddScenarioIdToTaskTrainingBase --project src/RFFM.Api --startup-project src/RFFM.Host --context AppDbContext
   ```
2. Revisar el `Up()`/`Down()` generados: deben añadir/quitar la columna `ScenarioId` (`varchar(36)`, nullable) en `TaskTrainingBases` y su FK hacia `GameScenarios` con `ON DELETE SET NULL`.
3. NO aplicar la migración a la base de datos (`dotnet ef database update`) sin permiso explícito adicional del usuario — dejarla generada y reportarla como pendiente de aplicar.

## Paso 4 — Backend: tests

1. `tests/RFFM.Api.Tests/UnitTests/CreateExerciseHandlerTests.cs`: localizar el/los test(s) de exclusión mutua de `SubSubPrincipleId`/`SubPrincipleId` y extenderlos: añadir un caso de éxito con solo `ScenarioId`, y casos de fallo con dos o tres ids a la vez, y con ninguno.
2. `tests/RFFM.Api.Tests/UnitTests/UpdateExerciseHandlerTests.cs`: mismo tratamiento.
3. `tests/RFFM.Api.Tests/UnitTests/GetExercisesHandlerTests.cs`: añadir un caso que filtra por `scenarioId` y verifica que solo devuelve los ejercicios de ese escenario.
4. `tests/RFFM.Api.Tests/UnitTests/GetExerciseByIdHandlerTests.cs`: añadir un caso que verifica `ScenarioId`/`ScenarioName` en la respuesta cuando el ejercicio está vinculado a un escenario.

Verificar (avisar antes): `dotnet build && dotnet test`. Confirmar 100% verde antes de continuar con frontend.

## Paso 5 — Frontend: tipos y servicios

1. `Front/src/apps/coach/types/training.ts`:
   - `Exercise`: añadir `scenarioId?: string | null; scenarioName?: string | null;` (junto a los campos de subprincipio/sub-subprincipio).
   - `CreateExerciseRequest`: añadir `scenarioId?: string | null;`.
2. `Front/src/apps/coach/services/trainingService.ts`: en `getExercises(clubId, opts)`, `opts` gana `scenarioId?: string | null`; si está presente, añadirlo a los `params` de la petición GET.

Verificar: `npm run build` (usar los errores de tipos como red de seguridad para localizar usos residuales).

## Paso 6 — Frontend: `PrincipleExercisesSection.tsx`

1. `export type PrincipleLevelKind = "subSubPrinciple" | "subPrinciple" | "scenario";`
2. `loadExercises`: cambiar el cálculo de `opts` a un `switch`/cadena de condicionales sobre `levelKind` con tres ramas: `subSubPrinciple` → `{ subSubPrincipleId: levelApiId }`, `subPrinciple` → `{ subPrincipleId: levelApiId }`, `scenario` → `{ scenarioId: levelApiId }`.
3. `buildExerciseParams`: añadir una rama `else if (levelKind === "scenario") { createParams.set("scenarioId", levelApiId); createParams.set("scenarioName", levelName); }` (ajustar la estructura condicional existente para acomodar las tres ramas).

## Paso 7 — Frontend: `ScenarioAccordion.tsx` (`ScenarioDetailView`)

1. Añadir `const [exerciseCount, setExerciseCount] = useState(0);` al inicio de `ScenarioDetailView`.
2. Envolver el título/cabecera del escenario (o crear un contenedor de cabecera si no existe uno ya reutilizable) para incluir, junto al nombre, el chip de conteo: `{exerciseCount > 0 && (<Chip icon={<FitnessCenterIcon style={{ fontSize: 12 }} />} label={`${exerciseCount} ej.`} size="small" className={styles.exerciseChip} />)}` — mismo patrón visual que en `SubPrincipleDetailView` (líneas ~95-102 de este mismo archivo). Si `ScenarioDetailView` no tiene hoy un elemento de cabecera propio con el nombre del escenario (revisar: `detailTitle={(s) => \`Escenario ${s.order}\`}` se define en el `DrillDownPanel` padre, no dentro de `ScenarioDetailView`), añadir una `Box` de cabecera al principio del JSX de `ScenarioDetailView` que muestre el chip (puede ir sin repetir el nombre si el título ya lo maneja `DrillDownPanel`, priorizando consistencia visual con el resto de la vista sobre duplicar el título).
3. Al final de `ScenarioDetailView`, tras el bloque `{scenario.subPrinciples.length > 0 ? (...) : (...)}`, montar:
   ```tsx
   {clubId && scenario.apiId && (
     <PrincipleExercisesSection
       clubId={clubId}
       teamId={teamId}
       levelKind="scenario"
       levelApiId={scenario.apiId}
       levelName={scenario.name}
       active
       onCountChange={setExerciseCount}
     />
   )}
   ```
   (mismo patrón que el montaje en `SubPrincipleDetailView`, líneas ~122-132 de este archivo). Comprobar que `Scenario.apiId` llega poblado desde `gameModelService.ts` (mapeo API→modelo) — si no lo estuviera, es un bug a reportar, no a silenciar con `?? ""`.

## Paso 8 — Frontend: formulario de creación/edición de ejercicio

1. `pages/trainings/new/NewExercisePage.tsx`:
   - Leer `const scenarioId = params.get("scenarioId");` y `const scenarioName = params.get("scenarioName");` (mismo patrón que `subPrincipleId`/`spName`).
   - Pasar `scenarioId` a `useExerciseForm({ clubId, scenarioId, subSubPrincipleId, subPrincipleId, ... })`.
2. `hooks/useExerciseForm.ts`:
   - `resolveLevelIds`: cambiar la firma a `resolveLevelIds(scenarioId, subSubPrincipleId, subPrincipleId)` con prioridad: sub-subprincipio > subprincipio > escenario (el nivel más específico gana; solo se conserva uno, el resto se fuerza a `null`). Devuelve `{ scenarioId: string | null; subSubPrincipleId: string | null; subPrincipleId: string | null }`.
   - `UseExerciseFormParams`: añadir `scenarioId: string | null`.
   - Todas las llamadas a `resolveLevelIds(...)` en el archivo (inicialización de `form`, `applyExercise`, el `useEffect` de reset) pasan a incluir el tercer argumento/orden nuevo — revisar cada call site.
   - `applyExercise`: `resolveLevelIds(exercise.scenarioId ?? scenarioId, exercise.subSubPrincipleId ?? subSubPrincipleId, exercise.subPrincipleId ?? subPrincipleId)`.
   - `setLevel(kind: "subSubPrinciple" | "subPrinciple" | "scenario")`: al fijar un nivel, los otros dos pasan a `null`:
     ```ts
     const setLevel = (kind: "subSubPrinciple" | "subPrinciple" | "scenario") => {
       setForm((prev) => ({
         ...prev,
         subSubPrincipleId: kind === "subSubPrinciple" ? (subSubPrincipleId ?? prev.subSubPrincipleId ?? null) : null,
         subPrincipleId: kind === "subPrinciple" ? (subPrincipleId ?? prev.subPrincipleId ?? null) : null,
         scenarioId: kind === "scenario" ? (scenarioId ?? prev.scenarioId ?? null) : null,
         essentialSkillIds: kind === "subPrinciple" || kind === "scenario" ? [] : prev.essentialSkillIds,
       }));
     };
     ```
   - El `useEffect` que resetea `form` al cambiar props (`[clubId, subSubPrincipleId, subPrincipleId]`) pasa a incluir `scenarioId` en las dependencias y en la llamada a `resolveLevelIds`.
3. `components/ExerciseFormPanel.tsx`:
   - `Props`: añadir `scenarioId: string | null; scenarioName: string | null;`.
   - El bloque del `Select` "Vinculado a" (hoy condicionado a `subSubPrincipleId && subPrincipleId`) pasa a mostrarse cuando **al menos dos** de los tres ids (`scenarioId`, `subPrincipleId`, `subSubPrincipleId`) estén disponibles. Construir las `MenuItem` condicionalmente:
     ```tsx
     {(Number(!!scenarioId) + Number(!!subPrincipleId) + Number(!!subSubPrincipleId)) >= 2 && (
       <FormControl size="small" className={styles.field}>
         <InputLabel id="exercise-level-label">Vinculado a</InputLabel>
         <Select
           labelId="exercise-level-label"
           value={
             formData.scenarioId ? "scenario" : formData.subPrincipleId ? "subPrinciple" : "subSubPrinciple"
           }
           label="Vinculado a"
           onChange={(e: SelectChangeEvent) =>
             setLevel(e.target.value as "subSubPrinciple" | "subPrinciple" | "scenario")
           }
         >
           {scenarioId && <MenuItem value="scenario">Escenario: {scenarioName}</MenuItem>}
           {subPrincipleId && <MenuItem value="subPrinciple">Subprincipio: {subPrincipleName}</MenuItem>}
           {subSubPrincipleId && <MenuItem value="subSubPrinciple">Habilidad: {subSubPrincipleName}</MenuItem>}
         </Select>
       </FormControl>
     )}
     ```
   - Propagar `scenarioId`/`scenarioName` desde `NewExercisePage.tsx` hasta `ExerciseFormPanel` (revisar la firma de `ExerciseFormPanel` y su punto de montaje en `NewExercisePage.tsx`).

## Paso 9 — Frontend: tests (TDD)

**Red** (escribir/ajustar antes de tocar producción en los pasos 6-8, o inmediatamente después si el orden natural del guion lo dicta — lo importante es que existan y se compruebe que fallan antes de darlos por buenos):

1. `hooks/__tests__/useExerciseForm.test.ts`: casos de `resolveLevelIds` con los tres niveles — cada uno en solitario, prioridad cuando llegan varios por fallback de URL, y `setLevel` alternando entre los tres.
2. `components/__tests__/ExerciseFormPanel.test.tsx`: el selector "Vinculado a" no aparece con un solo id disponible; aparece con dos o tres; las opciones mostradas corresponden exactamente a los ids disponibles.
3. `components/__tests__/ScenarioAccordion.test.tsx`: mock de `trainingService.getExercises`/`PrincipleExercisesSection` (si el archivo ya mockea `PrincipleExercisesSection` o `SubSubPrincipleCard` para otros tests, seguir el mismo patrón) verificando que el detalle de escenario monta la sección de ejercicios con `levelKind="scenario"` y que el chip de conteo aparece en la cabecera.

Verificar: `npm run test -- useExerciseForm ExerciseFormPanel ScenarioAccordion && npm run build`.

## Paso 10 — Verificación final

1. `npm run test` completo (frontend) → 100% pass, sin skips.
2. `npm run build` → sin errores TypeScript.
3. `dotnet test` completo (backend) → 100% pass. **Avisar antes de ejecutar por si la API está corriendo localmente.**
4. Informar resumen: archivos tocados (backend y frontend), migración generada (pendiente de aplicar a la BD), tests añadidos/ajustados, y recordatorio de prueba manual (crear un ejercicio directamente en un escenario, comprobar el chip de conteo, reasignar un ejercicio entre los tres niveles desde el formulario).
