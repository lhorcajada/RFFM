# Implement — add-exercise-methodology

Script técnico para el agente `openspec-implementer`. TDD estricto (Red → Green → Refactor) por bloque. No avances al siguiente bloque sin que los tests del bloque actual pasen.

Convenciones detectadas en el repo:
- Tests backend en `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/`, xUnit, `#nullable enable`, namespace `RFFM.Api.Tests.UnitTests`, `[Collection(PostgresCollection.Name)]` con `PostgresContainerFixture` real (no InMemory).
- `CreateExerciseCommand`/`UpdateExerciseCommand` son **records posicionales**. Los tests existentes (`CreateExerciseHandlerTests.cs`, `UpdateExerciseHandlerTests.cs`, `GetExercisesHandlerTests.cs`, `GetExerciseByIdHandlerTests.cs`) construyen estos comandos con los primeros parámetros posicionales y el resto por nombre (`Section: "Principal"`, etc.). **Importante**: coloca el nuevo parámetro `Methodology` en la definición del record justo después de `Section` (no antes) y pásalo siempre por nombre (`Methodology: "..."`) en todos los call-sites — así no se rompe el orden posicional existente en ningún test.
- Antes de tocar el Bloque 2, ejecuta `grep -rn "new CreateExerciseCommand\|CreateCommand(\|BaseCommand(" Back/ExtractionApi/tests` y `grep -rn "new UpdateExerciseCommand\|UpdateCommand(" Back/ExtractionApi/tests` para localizar TODOS los call-sites que necesitan el nuevo argumento `Methodology`. Cada helper privado (`BaseCommand`, `CreateCommand`, `UpdateCommand`) en los test files existentes debe añadir `Methodology: "Integrado"` (valor por defecto neutro) a su construcción — así todos los tests existentes siguen compilando y pasando sin cambios de comportamiento.
- Tests frontend co-ubicados en `__tests__/` junto al archivo, Vitest + Testing Library.

---

## Bloque 1 — Backend: Dominio y persistencia

### 1.1 Green (no hay Red aislado: es un campo de dominio, se verifica vía los bloques 2-4)

Editar `Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/Training/TasksTraining/TaskTrainingBase.cs`:

```csharp
/// <summary>Section of the training session: Calentamiento, Principal, VueltaALaCalma.</summary>
public string Section { get; set; } = "Principal";

/// <summary>Training methodology: Analitico, Integrado, Global.</summary>
public string Methodology { get; set; } = "Integrado";
```

Editar `Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/Configuration/Aggregates/Trainings/TaskTrainingBaseEntityConfiguration.cs`, justo después de la configuración de `Section`:

```csharp
builder.Property(tb => tb.Section)
    .IsRequired()
    .HasMaxLength(50);

builder.Property(tb => tb.Methodology)
    .IsRequired()
    .HasMaxLength(50);
```

Generar la migración (no escribirla a mano):

```bash
cd Back/ExtractionApi
.\manage-migrations.ps1
```

Nombra la migración `AddExerciseMethodology` cuando el script lo pida. Verifica que la migración generada añade la columna `Methodology` como `NOT NULL` con un valor por defecto `'Integrado'` para el backfill de filas existentes (mismo patrón que la migración `AddExerciseSection`); si el script no propone un default automáticamente, añade `defaultValue: "Integrado"` a la llamada `AddColumn` generada antes de aplicarla.

`dotnet build` debe compilar sin errores (con los call-sites existentes aún sin `Methodology`, este build fallará hasta el Bloque 2 — es esperado, continúa).

---

## Bloque 2 — Backend: `CreateExercise.cs`

### 2.1 Red

Editar `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/CreateExerciseHandlerTests.cs`:

- En `BaseCommand`, añadir `Methodology: "Integrado"` junto a `Section: "Principal"`.
- Añadir estos tests nuevos al final de la clase, antes del cierre:

```csharp
[Fact]
public async Task Handle_PersistsMethodology()
{
    await using var seedDb = _fixture.CreateDbContext();
    var (userId, clubId, _) = await SeedClubAsync(seedDb);

    await using var db = _fixture.CreateDbContext();
    var handler = new CreateExerciseHandler(db);
    var command = BaseCommand(clubId, userId, new List<string> { "Physical" }) with { Methodology = "Global" };

    var id = await handler.Handle(command, CancellationToken.None);

    await using var verifyDb = _fixture.CreateDbContext();
    var exercise = await verifyDb.TaskTrainingBases.SingleAsync(e => e.Id == id);

    Assert.Equal("Global", exercise.Methodology);
}

[Theory]
[InlineData("Analitico")]
[InlineData("Integrado")]
[InlineData("Global")]
public async Task Validator_AcceptsValidMethodology(string methodology)
{
    await using var seedDb = _fixture.CreateDbContext();
    var (userId, clubId, _) = await SeedClubAsync(seedDb);

    var command = BaseCommand(clubId, userId, new List<string> { "Physical" }) with { Methodology = methodology };
    var validator = new CreateExerciseValidator();

    var result = await validator.ValidateAsync(command);

    Assert.True(result.IsValid);
}

[Fact]
public async Task Validator_RejectsInvalidMethodology()
{
    await using var seedDb = _fixture.CreateDbContext();
    var (userId, clubId, _) = await SeedClubAsync(seedDb);

    var command = BaseCommand(clubId, userId, new List<string> { "Physical" }) with { Methodology = "NotAValidMethodology" };
    var validator = new CreateExerciseValidator();

    var result = await validator.ValidateAsync(command);

    Assert.False(result.IsValid);
}

[Fact]
public async Task Validator_RejectsEmptyMethodology()
{
    await using var seedDb = _fixture.CreateDbContext();
    var (userId, clubId, _) = await SeedClubAsync(seedDb);

    var command = BaseCommand(clubId, userId, new List<string> { "Physical" }) with { Methodology = "" };
    var validator = new CreateExerciseValidator();

    var result = await validator.ValidateAsync(command);

    Assert.False(result.IsValid);
}
```

`dotnet test --filter CreateExerciseHandlerTests` → deben fallar en compilación (`Methodology` no existe en `CreateExerciseCommand`).

### 2.2 Green

Editar `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Trainings/Exercises/CreateExercise.cs`:

- Añadir `string Methodology` al record, justo después de `string Section`:

```csharp
public record CreateExerciseCommand(
    string ClubId,
    string Name,
    string Description,
    List<string> Types,
    int DurationTotal,
    int PlayersNumber,
    int GoalPeekersNumber,
    string FieldSpace,
    string? SubSubPrincipleId,
    string? SubPrincipleId,
    string? ScenarioId,
    string Section,
    string Methodology,
    List<string> EssentialSkillIds,
    string? BoardStateJson,
    int? Series,
    int? DurationSeries,
    int? RestSeries,
    int? TouchesNumber,
    int? WildCards
) : IRequest<string>, IRequireFeaturePermission
```

- En el handler, añadir `Methodology = request.Methodology,` junto a `Section = request.Section,`.
- En `CreateExerciseValidator`, añadir junto a la regla de `Section`:

```csharp
RuleFor(x => x.Methodology).Must(m => m is "Analitico" or "Integrado" or "Global")
    .WithMessage("Methodology must be Analitico, Integrado or Global.");
```

`dotnet test --filter CreateExerciseHandlerTests` → deben pasar todos los tests (existentes + nuevos).

**Nota**: este cambio en el record posicional también rompe la compilación de `GetExercisesHandlerTests.cs` y `UpdateExerciseHandlerTests.cs` (usan `CreateExerciseCommand`/`CreateCommand` para sembrar datos). No los arregles todavía si el Bloque 3/4 los cubre — pero si `dotnet build` falla por ellos antes de llegar a esos bloques, añade `Methodology: "Integrado"` a sus helpers `CreateCommand` ahora mismo para mantener el build verde.

### 2.3 Refactor

Sin cambios estructurales adicionales.

---

## Bloque 3 — Backend: `UpdateExercise.cs`

### 3.1 Red

Editar `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/UpdateExerciseHandlerTests.cs`:

- En `CreateCommand` (helper de seed) y `UpdateCommand`, añadir `Methodology: "Integrado"`.
- Añadir tests nuevos:

```csharp
[Fact]
public async Task Handle_UpdatesMethodology()
{
    await using var seedDb = _fixture.CreateDbContext();
    var (userId, clubId, _) = await SeedClubAsync(seedDb);

    await using var createDb = _fixture.CreateDbContext();
    var createHandler = new CreateExerciseHandler(createDb);
    var exerciseId = await createHandler.Handle(
        CreateCommand(clubId, userId, new List<string> { "Physical" }),
        CancellationToken.None);

    await using var updateDb = _fixture.CreateDbContext();
    var updateHandler = new UpdateExerciseHandler(updateDb);
    await updateHandler.Handle(
        UpdateCommand(exerciseId, userId, new List<string> { "Physical" }) with { Methodology = "Global" },
        CancellationToken.None);

    await using var verifyDb = _fixture.CreateDbContext();
    var exercise = await verifyDb.TaskTrainingBases.SingleAsync(e => e.Id == exerciseId);

    Assert.Equal("Global", exercise.Methodology);
}

[Fact]
public async Task Validator_RejectsInvalidMethodology()
{
    var command = UpdateCommand("fake-id", "fake-user", new List<string> { "Physical" }) with { Methodology = "NotValid" };
    var validator = new UpdateExerciseValidator();

    var result = await validator.ValidateAsync(command);

    Assert.False(result.IsValid);
}
```

`dotnet test --filter UpdateExerciseHandlerTests` → deben fallar en compilación (`Methodology` no existe en `UpdateExerciseCommand`).

### 3.2 Green

Editar `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Trainings/Exercises/UpdateExercise.cs`:

- Añadir `string Methodology` al record `UpdateExerciseCommand`, justo después de `string Section` (misma posición relativa que en `CreateExerciseCommand`).
- En el handler, añadir `exercise.Methodology = request.Methodology;` junto a `exercise.Section = request.Section;`.
- En `UpdateExerciseValidator`, añadir la misma regla `.Must(...)` que en `CreateExerciseValidator`.

`dotnet test --filter UpdateExerciseHandlerTests` → deben pasar todos los tests.

### 3.3 Refactor

Sin cambios adicionales.

---

## Bloque 4 — Backend: `GetExercises.cs` / `GetExerciseById.cs`

### 4.1 Red

Editar `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/GetExercisesHandlerTests.cs`:

- En `CreateCommand` (helper de seed), añadir `Methodology: "Integrado"`.
- Añadir tests nuevos:

```csharp
[Fact]
public async Task Handle_ProjectsMethodology()
{
    await using var seedDb = _fixture.CreateDbContext();
    var (userId, clubId, _) = await SeedClubAsync(seedDb);

    await using var createDb = _fixture.CreateDbContext();
    var createHandler = new CreateExerciseHandler(createDb);
    await createHandler.Handle(
        CreateCommand(clubId, userId, new List<string> { "Physical" }) with { Methodology = "Analitico" },
        CancellationToken.None);

    await using var queryDb = _fixture.CreateDbContext();
    var handler = new GetExercisesHandler(queryDb);
    var result = await handler.Handle(
        new GetExercisesQuery(clubId, SubSubPrincipleId: null, SubPrincipleId: null, ScenarioId: null, Methodology: null, UserId: userId),
        CancellationToken.None);

    var item = Assert.Single(result);
    Assert.Equal("Analitico", item.Methodology);
}

[Fact]
public async Task Handle_FilteredByMethodology_ReturnsOnlyMatchingExercises()
{
    await using var seedDb = _fixture.CreateDbContext();
    var (userId, clubId, _) = await SeedClubAsync(seedDb);

    await using var createDb = _fixture.CreateDbContext();
    var createHandler = new CreateExerciseHandler(createDb);
    var globalId = await createHandler.Handle(
        CreateCommand(clubId, userId, new List<string> { "Tactical" }) with { Methodology = "Global" },
        CancellationToken.None);
    await createHandler.Handle(
        CreateCommand(clubId, userId, new List<string> { "Physical" }) with { Methodology = "Analitico" },
        CancellationToken.None);

    await using var queryDb = _fixture.CreateDbContext();
    var handler = new GetExercisesHandler(queryDb);
    var result = await handler.Handle(
        new GetExercisesQuery(clubId, SubSubPrincipleId: null, SubPrincipleId: null, ScenarioId: null, Methodology: "Global", UserId: userId),
        CancellationToken.None);

    var list = result.ToList();
    Assert.Single(list);
    Assert.Equal(globalId, list[0].Id);
}
```

`dotnet test --filter GetExercisesHandlerTests` → deben fallar en compilación (`GetExercisesQuery` no tiene `Methodology`, `ExerciseListItem.Methodology` no existe).

Editar `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/GetExerciseByIdHandlerTests.cs`: localiza el helper de creación de ejercicio (mismo patrón `CreateCommand`/`BaseCommand`) y añade `Methodology: "Integrado"`; añade un test análogo a `Handle_ProjectsMethodology` verificando `result.Methodology` en la respuesta de un único ejercicio.

### 4.2 Green

Editar `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Trainings/Exercises/GetExercises.cs`:

- Endpoint: añadir parámetro `string? methodology` a la lambda del `MapGet`, pasarlo al `GetExercisesQuery`.
- `GetExercisesQuery`: añadir `string? Methodology` (posicional, junto a `ScenarioId`):

```csharp
public record GetExercisesQuery(string ClubId, string? SubSubPrincipleId, string? SubPrincipleId, string? ScenarioId, string? Methodology, string UserId) : IRequest<IEnumerable<ExerciseListItem>>, IRequireFeaturePermission
```

- Handler: añadir el filtro junto a los otros tres:

```csharp
if (!string.IsNullOrEmpty(request.Methodology))
    query = query.Where(tb => tb.Methodology == request.Methodology);
```

- `ExerciseListItem`: añadir `string Methodology` (junto a `Section`):

```csharp
public record ExerciseListItem(
    string Id,
    string Name,
    string Description,
    IEnumerable<string> Types,
    string Section,
    string Methodology,
    int DurationTotal,
    ...);
```

- Actualizar la construcción del `ExerciseListItem` en el handler para pasar `tb.Methodology` en la posición correspondiente (justo después de `tb.Section`).

Editar `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Trainings/Exercises/GetExerciseById.cs`: actualizar la construcción de `ExerciseListItem` en el handler para incluir `exercise.Methodology` en la misma posición.

`dotnet test --filter "GetExercisesHandlerTests|GetExerciseByIdHandlerTests"` → deben pasar todos los tests. Ejecuta también `dotnet test --filter "CreateExerciseHandlerTests|UpdateExerciseHandlerTests"` para confirmar que el cambio posicional en `ExerciseListItem` no rompió nada (esos tests no construyen `ExerciseListItem` directamente, pero confírmalo).

### 4.3 Refactor

`dotnet build` limpio, sin warnings de parámetros no usados.

---

## Bloque 5 — Frontend: tipos y catálogo

Sin test dedicado (son solo tipos/constantes; se verifican indirectamente en los bloques 6-8).

Editar `Front/src/apps/coach/types/training.ts`:

```ts
export type ExerciseMethodology = "Analitico" | "Integrado" | "Global";
```

Añadir `methodology: ExerciseMethodology;` a `interface Exercise` (junto a `section`) y a `interface CreateExerciseRequest` (junto a `section`). `UpdateExerciseRequest` lo hereda automáticamente (es un `Omit<CreateExerciseRequest, "clubId">`).

Editar `Front/src/apps/coach/pages/trainings/new/constants.ts`:

```ts
import type { CreateExerciseRequest, ExerciseMethodology, ExerciseSection, ExerciseType } from "../../../types/training";
// ...
export const methodologyOptions: { value: ExerciseMethodology; label: string }[] = [
  { value: "Analitico", label: "Analítico" },
  { value: "Integrado", label: "Integrado" },
  { value: "Global", label: "Global" },
];
```

Añadir `methodology: "Integrado",` al objeto `emptyExercise` (junto a `section: "Principal",`).

Editar `Front/src/apps/coach/pages/trainings/exerciseTypeLabels.ts`:

```ts
import type { ExerciseMethodology, ExerciseSection, ExerciseType } from "../../types/training";
// ...
export const METHODOLOGY_LABELS: Record<ExerciseMethodology, string> = {
  Analitico: "Analítico",
  Integrado: "Integrado",
  Global: "Global",
};
```

`npm run build` debe fallar aquí (esperado) porque `ExerciseFormPanel`/`ExerciseCromo` aún no usan el campo obligatorio nuevo en algunos objetos parciales de test — continúa a los bloques 6-7 para resolverlo.

---

## Bloque 6 — Frontend: Formulario

### 6.1 Red

Busca el test existente del hook/formulario de ejercicio (`grep -rn "useExerciseForm\|ExerciseFormPanel" Front/src/apps/coach --include=*.test.tsx`). Si no existe ningún test de este hook/panel todavía, crea `Front/src/apps/coach/pages/trainings/new/hooks/__tests__/useExerciseForm.test.tsx` con al menos:

```tsx
it("emptyExercise trae 'Integrado' como metodologia por defecto", () => {
  expect(emptyExercise.methodology).toBe("Integrado");
});
```

y un test de `ExerciseFormPanel` (nuevo archivo `__tests__/ExerciseFormPanel.test.tsx` si no existe, siguiendo el patrón de mocks de `form` que uses en otros tests de este directorio) que verifique que el `Select` de metodología renderiza las 3 opciones (`Analítico`, `Integrado`, `Global`).

Ejecuta `npm run test -- ExerciseFormPanel useExerciseForm` → deben fallar (el selector no existe todavía).

### 6.2 Green

Editar `Front/src/apps/coach/pages/trainings/new/components/ExerciseFormPanel.tsx`:

- Importar `methodologyOptions` desde `../constants` (junto a `sectionOptions, typeOptions`) y `ExerciseMethodology` desde `../../../../types/training` (junto a `ExerciseSection, ExerciseType`).
- Añadir, dentro del mismo `Box className={styles.row}` donde está el `Select` de "Seccion", un tercer `FormControl` clonado:

```tsx
<FormControl size="small" className={styles.typeSelect}>
  <InputLabel>Metodologia</InputLabel>
  <Select
    value={formData.methodology}
    label="Metodologia"
    onChange={(e: SelectChangeEvent) =>
      setField("methodology", e.target.value as ExerciseMethodology)
    }
  >
    {methodologyOptions.map((o) => (
      <MenuItem key={o.value} value={o.value}>
        {o.label}
      </MenuItem>
    ))}
  </Select>
</FormControl>
```

Editar `Front/src/apps/coach/pages/trainings/new/hooks/useExerciseForm.ts`: en `applyExercise`, añadir `methodology: exercise.methodology,` al objeto pasado a `setForm({...})` (junto a `section: exercise.section,`).

`npm run test -- ExerciseFormPanel useExerciseForm` → deben pasar.

### 6.3 Refactor

`npm run build` — confirmar que no hay errores de TypeScript por el nuevo campo obligatorio.

---

## Bloque 7 — Frontend: Tarjeta `ExerciseCromo`

### 7.1 Red

Editar `Front/src/apps/coach/pages/trainings/components/__tests__/ExerciseCromo.test.tsx`:

- En `buildExercise()`, añadir `methodology: "Integrado",` al objeto base (para que `Exercise` siga siendo un tipo válido tras hacerlo obligatorio).
- Añadir un test nuevo:

```tsx
it("muestra un pill con la metodologia del ejercicio", () => {
  render(
    <ExerciseCromo
      exercise={buildExercise({ methodology: "Global" })}
      onEdit={vi.fn()}
      onDuplicate={vi.fn()}
      onPrint={vi.fn()}
      onDelete={vi.fn()}
    />
  );

  expect(screen.getByText("Global")).toBeInTheDocument();
});
```

`npm run test -- ExerciseCromo` → el test nuevo debe fallar (el pill no existe todavía); los tests existentes deben seguir compilando gracias al `methodology` añadido en `buildExercise()`.

### 7.2 Green

Editar `Front/src/apps/coach/pages/trainings/components/ExerciseCromo.tsx`:

- Importar `METHODOLOGY_LABELS` junto a `TYPE_LABELS, SECTION_LABELS` desde `../exerciseTypeLabels`.
- En `metaRow`, añadir el pill junto al de `section`:

```tsx
<div className={styles.metaRow}>
  <span className={`${styles.sectionPill} ${styles[`sectionPill_${exercise.section}`] ?? ""}`}>
    {SECTION_LABELS[exercise.section] ?? exercise.section}
  </span>
  <span className={styles.sspPill}>
    {METHODOLOGY_LABELS[exercise.methodology] ?? exercise.methodology}
  </span>
  {exercise.subSubPrincipleName && (
    <span className={styles.sspPill}>{exercise.subSubPrincipleName}</span>
  )}
</div>
```

`npm run test -- ExerciseCromo` → deben pasar todos los tests.

### 7.3 Refactor

Sin cambios adicionales.

---

## Bloque 8 — Frontend: Filtro en `Trainings.tsx`

### 8.1 Red

Crea `Front/src/apps/coach/pages/trainings/__tests__/Trainings.test.tsx` si no existe (revisa primero si hay un test de esta página en otra ruta con `grep -rn "from \"../Trainings\"\|from \"./Trainings\"" Front/src/apps/coach --include=*.test.tsx`; si existe, añade los tests ahí en vez de crear un archivo nuevo). Mockea `trainingService` (`getExercises`, `getSessions`) y `useTeamAndClub`/`useTeamDashboardBack` siguiendo el patrón de mocks ya usado en tests de páginas similares del proyecto (busca un test de página existente en `pages/trainings` o `pages/` para copiar el setup de mocks de router/hooks). Test mínimo:

```tsx
it("permite filtrar el listado de ejercicios por metodologia", async () => {
  const getExercises = vi.spyOn(trainingService, "getExercises").mockResolvedValue([]);
  render(<Trainings />); // con el wrapping de router/mocks necesario
  await waitFor(() => expect(getExercises).toHaveBeenCalled());

  const select = screen.getByLabelText(/metodolog/i);
  fireEvent.mouseDown(select);
  fireEvent.click(await screen.findByText("Global"));

  await waitFor(() =>
    expect(getExercises).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({ methodology: "Global" }),
    ),
  );
});
```

`npm run test -- Trainings` → debe fallar (no existe el selector de metodología todavía).

### 8.2 Green

Editar `Front/src/apps/coach/services/trainingService.ts`:

```ts
async getExercises(
  clubId: string,
  opts?: { subSubPrincipleId?: string | null; subPrincipleId?: string | null; scenarioId?: string | null; methodology?: string | null }
): Promise<Exercise[]> {
  const params: Record<string, string> = { clubId };
  if (opts?.subSubPrincipleId) params.subSubPrincipleId = opts.subSubPrincipleId;
  if (opts?.subPrincipleId) params.subPrincipleId = opts.subPrincipleId;
  if (opts?.scenarioId) params.scenarioId = opts.scenarioId;
  if (opts?.methodology) params.methodology = opts.methodology;
  const res = await client.get<Exercise[]>("/api/trainings/exercises", { params });
  return res.data;
},
```

Editar `Front/src/apps/coach/pages/trainings/Trainings.tsx`:

- Importar `Select`, `MenuItem`, `FormControl`, `InputLabel` de `@mui/material` (añadir a la importación existente) y `ExerciseMethodology` de `../../types/training`, y `methodologyOptions`/`METHODOLOGY_LABELS` según corresponda (usar `methodologyOptions` de `./new/constants` para las opciones y sus labels).
- Añadir estado:

```tsx
const [methodologyFilter, setMethodologyFilter] = useState<ExerciseMethodology | "">("");
```

- Actualizar el `useEffect` de carga y `refreshExercises` para pasar `methodology: methodologyFilter || undefined` y añadir `methodologyFilter` a las dependencias del `useEffect`:

```tsx
useEffect(() => {
  if (!clubId) return;
  setLoadingEx(true);
  trainingService.getExercises(clubId, {
    subSubPrincipleId: initialSspId ?? undefined,
    methodology: methodologyFilter || undefined,
  })
    .then(setExercises)
    .catch(() => setExercises([]))
    .finally(() => setLoadingEx(false));
}, [clubId, initialSspId, methodologyFilter]);
```

(mismo cambio en `refreshExercises`).

- Añadir el `Select` en el `toolbarRow` de la pestaña "Ejercicios" (dentro de `{tab === 0 && (...)}`, antes o junto al `Chip` de filtro existente):

```tsx
<Box className={styles.toolbarRow}>
  {initialSspName && (
    <Chip
      label={`Filtro: ${initialSspName}`}
      size="small"
      className={styles.filterLabel}
      onDelete={() => navigate(`/coach/trainings?teamId=${teamId}`)}
    />
  )}
  <FormControl size="small" sx={{ minWidth: 160 }}>
    <InputLabel id="methodology-filter-label">Metodologia</InputLabel>
    <Select
      labelId="methodology-filter-label"
      label="Metodologia"
      value={methodologyFilter}
      onChange={(e) => setMethodologyFilter(e.target.value as ExerciseMethodology | "")}
    >
      <MenuItem value="">Todas</MenuItem>
      {methodologyOptions.map((o) => (
        <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
      ))}
    </Select>
  </FormControl>
</Box>
```

Nota: hoy el `<Box className={styles.toolbarRow}>` solo se renderiza `{initialSspName && (...)}`; cambia la condición para que el contenedor se renderice siempre en la pestaña de ejercicios (el filtro de metodología debe estar visible aunque no haya `initialSspName`).

`npm run test -- Trainings` → debe pasar.

### 8.3 Refactor

`npm run build` limpio.

---

## Bloque 9 — Verificación final

```bash
# Backend
cd Back/ExtractionApi
dotnet build
dotnet test

# Frontend
cd Front
npm run build
npm run test
```

Manual (requiere backend + frontend corriendo):
1. Crear un ejercicio nuevo → seleccionar metodología "Analítico" → guardar → verificar que la tarjeta muestra el pill "Analítico".
2. Editar ese ejercicio → cambiar a "Global" → guardar → recargar listado → pill actualizado a "Global".
3. Usar el filtro de metodología en la pestaña "Ejercicios" → solo se muestran los ejercicios con la metodología seleccionada.

Si todo pasa: `openspec validate add-exercise-methodology` y mover la carpeta a `openspec/changes/archive/2026-07-27-add-exercise-methodology/`.
