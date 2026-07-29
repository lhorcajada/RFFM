## Architecture Decisions

### 1. Representación del campo: string simple, mismo patrón que `Section`

`Section` (`TaskTrainingBase.Section`) ya resuelve el mismo problema de forma: 3 valores cerrados, sin multi-selección, sin necesidad de relacionarlo con otras entidades. Se replica exactamente:

- Propiedad `public string Methodology { get; set; } = "Integrado";` en `TaskTrainingBase` (default `"Integrado"` — valor intermedio, mismo criterio que `Section` usa `"Principal"` como default).
- Valores permitidos (sin acentos, como el resto de valores-enum-string del proyecto, p.ej. `VueltaALaCalma`): `"Analitico"`, `"Integrado"`, `"Global"`.
- Los acentos solo existen en las **etiquetas** de presentación (frontend `METHODOLOGY_LABELS`), igual que `SECTION_LABELS` traduce `VueltaALaCalma` → "Vuelta calma".
- Validación con `.Must(...)` en `CreateExerciseValidator`/`UpdateExerciseValidator`, igual que `Section`. No se crea tabla catálogo (a diferencia de `ExerciseType`, que es multi-selección).

### 2. Migración EF

Nueva migración generada con `.\manage-migrations.ps1` (no escrita a mano): añade la columna `Methodology` (`nvarchar(50)` o equivalente Postgres `varchar(50)`, `NOT NULL`, default `'Integrado'` para las filas existentes — mismo patrón que la migración `AddExerciseSection`). El default de la columna a nivel de migración es solo para backfill de filas existentes; el default `"Integrado"` en el modelo C# es el que aplica a partir de ahora en `TaskTrainingBase`.

### 3. Backend — Features a modificar

**`CreateExercise.cs`**:
- `CreateExerciseCommand` gana el parámetro `string Methodology`.
- `CreateExerciseValidator` añade `RuleFor(x => x.Methodology).Must(m => m is "Analitico" or "Integrado" or "Global").WithMessage("Methodology must be Analitico, Integrado or Global.")` (mismo estilo que la regla de `Section`).
- Handler: `exercise.Methodology = request.Methodology;` (nueva línea junto a `Section = request.Section,` en el inicializador del objeto).

**`UpdateExercise.cs`**: mismo patrón — nuevo parámetro `Methodology` en `UpdateExerciseCommand`, misma regla en `UpdateExerciseValidator`, `exercise.Methodology = request.Methodology;` en el handler.

**`GetExercises.cs`**:
- Nuevo parámetro opcional de querystring `string? methodology` en el endpoint y en `GetExercisesQuery` (mismo patrón que `scenarioId`).
- Filtro en el handler: `if (!string.IsNullOrEmpty(request.Methodology)) query = query.Where(tb => tb.Methodology == request.Methodology);`
- `ExerciseListItem` gana el campo `string Methodology`, poblado en la proyección (`tb.Methodology`).

**`GetExerciseById.cs`**: `ExerciseListItem` ya se actualiza en el punto anterior (registro compartido); el handler pasa `exercise.Methodology` en el `new ExerciseListItem(...)`.

### 4. Frontend — tipos y catálogo de opciones

`types/training.ts`:
```ts
export type ExerciseMethodology = "Analitico" | "Integrado" | "Global";
```
Se añade `methodology: ExerciseMethodology` a `Exercise` y a `CreateExerciseRequest` (y por tanto a `UpdateExerciseRequest`, que es un `Omit` de este).

`pages/trainings/new/constants.ts`:
```ts
export const methodologyOptions: { value: ExerciseMethodology; label: string }[] = [
  { value: "Analitico", label: "Analítico" },
  { value: "Integrado", label: "Integrado" },
  { value: "Global", label: "Global" },
];
```
`emptyExercise` gana `methodology: "Integrado"` (mismo default que el backend).

`pages/trainings/exerciseTypeLabels.ts`:
```ts
export const METHODOLOGY_LABELS: Record<ExerciseMethodology, string> = {
  Analitico: "Analítico",
  Integrado: "Integrado",
  Global: "Global",
};
```

### 5. Frontend — formulario (`ExerciseFormPanel.tsx` + `useExerciseForm.ts`)

Se clona el bloque `FormControl`+`Select` de "Seccion" (líneas ~136-151 de `ExerciseFormPanel.tsx`) para "Metodologia", en el mismo `Box className={styles.row}`. `setField("methodology", e.target.value as ExerciseMethodology)` reutiliza el `setField` genérico ya existente en `useExerciseForm.ts` — no requiere cambios en el hook salvo:
- `applyExercise` (en `useExerciseForm.ts`): añadir `methodology: exercise.methodology,` al `setForm({...})` para que editar un ejercicio cargue su metodología actual.

Al ser un campo obligatorio con 3 valores y un default siempre presente en `emptyExercise`, no hace falta validación adicional en `handleSave` (a diferencia de `types`, que puede quedar vacío por ser multi-select) — el `Select` simple siempre tiene un valor seleccionado.

### 6. Frontend — tarjeta (`ExerciseCromo.tsx`)

Se añade un pill de metodología junto al de `Section` en `metaRow`, reutilizando la clase `sspPill` genérica (o una nueva `methodologyPill` si se quiere un color distintivo — se opta por reutilizar `sspPill` para no tocar CSS Modules, ya que no hay requisito visual específico de color):

```tsx
<span className={styles.sspPill}>{METHODOLOGY_LABELS[exercise.methodology] ?? exercise.methodology}</span>
```

Import adicional: `METHODOLOGY_LABELS` desde `../exerciseTypeLabels`.

### 7. Frontend — filtro por metodología (`Trainings.tsx` + `trainingService.ts`)

`trainingService.getExercises` gana una opción más en el objeto `opts`:
```ts
opts?: { subSubPrincipleId?: string | null; subPrincipleId?: string | null; scenarioId?: string | null; methodology?: string | null }
```
y añade `methodology` a `params` si está presente — mismo patrón que los otros tres filtros ya existentes.

`Trainings.tsx` no tiene hoy ningún control de filtro explícito en UI (el único filtro activo, `subSubPrincipleId`, llega por querystring de navegación, no por un selector). Para "filtrar el listado por metodología" se añade un `Select` simple (MUI, `size="small"`) en el `toolbarRow` de la pestaña "Ejercicios", con opciones "Todas" + `methodologyOptions`:

```tsx
const [methodologyFilter, setMethodologyFilter] = useState<ExerciseMethodology | "">("");
```

Se pasa a `trainingService.getExercises(clubId, { subSubPrincipleId: ..., methodology: methodologyFilter || undefined })` tanto en el `useEffect` de carga inicial como en `refreshExercises`, y `methodologyFilter` se añade a las dependencias del `useEffect`. El filtrado ocurre en el backend (vía querystring), no en cliente, siguiendo el mismo patrón que `subSubPrincipleId`.

## Files

**Backend** (modificados):
- `Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/Training/TasksTraining/TaskTrainingBase.cs`
- `Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/Configuration/Aggregates/Trainings/TaskTrainingBaseEntityConfiguration.cs`
- `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Trainings/Exercises/CreateExercise.cs`
- `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Trainings/Exercises/UpdateExercise.cs`
- `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Trainings/Exercises/GetExercises.cs`
- `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Trainings/Exercises/GetExerciseById.cs`
- Nueva migración EF (generada con `.\manage-migrations.ps1`)

**Frontend** (modificados):
- `Front/src/apps/coach/types/training.ts`
- `Front/src/apps/coach/pages/trainings/new/constants.ts`
- `Front/src/apps/coach/pages/trainings/exerciseTypeLabels.ts`
- `Front/src/apps/coach/pages/trainings/new/components/ExerciseFormPanel.tsx`
- `Front/src/apps/coach/pages/trainings/new/hooks/useExerciseForm.ts`
- `Front/src/apps/coach/pages/trainings/components/ExerciseCromo.tsx`
- `Front/src/apps/coach/pages/trainings/Trainings.tsx`
- `Front/src/apps/coach/services/trainingService.ts`

## Tests (TDD — Red → Green → Refactor)

**Backend** (`RFFM.Api.Tests`, xUnit + Moq, `PostgresContainerFixture` real como en el resto de handlers de `Exercises`):
- `CreateExerciseHandlerTests` (o archivo existente si ya hay uno): crea un ejercicio con `Methodology = "Analitico"` → se persiste correctamente; validador rechaza `Methodology` fuera de `{Analitico, Integrado, Global}` y rechaza vacío.
- `UpdateExerciseHandlerTests`: actualizar `Methodology` de un ejercicio existente se refleja en `TaskTrainingBases`; validador rechaza valor inválido.
- `GetExercisesHandlerTests`: `ExerciseListItem.Methodology` viene poblado; filtro `?methodology=Global` devuelve solo ejercicios con esa metodología, deja fuera los demás.
- `GetExerciseByIdHandlerTests`: `ExerciseListItem.Methodology` viene poblado en la respuesta de un único ejercicio.

**Frontend** (Vitest + Testing Library):
- `ExerciseFormPanel` (o test del hook `useExerciseForm` si el panel no tiene test propio): el selector de metodología existe, tiene las 3 opciones, `emptyExercise` trae `"Integrado"` por defecto, y al editar un ejercicio existente (`applyExercise`) el valor cargado coincide con `exercise.methodology`.
- `ExerciseCromo.test.tsx`: el pill de metodología se muestra con la etiqueta correcta (`METHODOLOGY_LABELS`) para cada uno de los 3 valores.
- `Trainings.test.tsx` (o nuevo test si no existe): el selector de filtro por metodología existe en la pestaña "Ejercicios"; al cambiarlo, `trainingService.getExercises` se llama con el parámetro `methodology` actualizado.

Coverage objetivo: handlers backend ≥80%, componentes frontend ≥75% (según CLAUDE.md).
