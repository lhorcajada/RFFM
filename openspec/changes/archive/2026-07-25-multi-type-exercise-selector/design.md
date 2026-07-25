## Overview

Sustituye la herencia TPH de `TaskTrainingBase` (`Physical/Technical/TacticalTaskTraining`) por una relación many-to-many con una nueva entidad `ExerciseType`, siguiendo exactamente el patrón ya usado para `EssentialSkill` vía `TaskTrainingSkill`. Añade 3 tipos nuevos (Juego, Cognitivo, Psicológico) sembrados por seeder. El frontend pasa el `Select` de tipo a multi-selección y las tarjetas muestran un chip por tipo.

---

## Backend

### 1. Nueva entidad `ExerciseType` + tabla puente `TaskTrainingType`

`Domain/Aggregates/Training/TasksTraining/ExerciseType.cs` (nuevo):

```csharp
namespace RFFM.Api.Domain.Aggregates.Training.TasksTraining
{
    public class ExerciseType : BaseEntity
    {
        public string Name { get; private set; } = string.Empty;

        protected ExerciseType() { }

        public static ExerciseType Create(string name) => new() { Name = name };
    }
}
```

`Domain/Aggregates/Training/TasksTraining/TaskTrainingType.cs` (nuevo, join entity — mismo estilo que `TaskTrainingSkill.cs`):

```csharp
namespace RFFM.Api.Domain.Aggregates.Training.TasksTraining
{
    /// <summary>Join entity: an exercise can have 1..N exercise types (Físico, Técnico, ...).</summary>
    public class TaskTrainingType
    {
        public string TaskTrainingBaseId { get; set; } = null!;
        public string ExerciseTypeId { get; set; } = null!;

        public TaskTrainingBase TaskTrainingBase { get; set; } = null!;
        public ExerciseType ExerciseType { get; set; } = null!;
    }
}
```

Los 6 valores válidos (nombre = clave usada en el contrato de API, igual que hoy): `Physical`, `Technical`, `Tactical`, `Game`, `Cognitive`, `Psychological`. Las etiquetas en español (Físico, Técnico, Táctico, Juego, Cognitivo, Psicológico) viven solo en frontend (`typeOptions`, `TYPE_LABELS`), igual que hoy — el backend no traduce.

### 2. `TaskTrainingBase` — eliminar TPH, fusionar campos

`Domain/Aggregates/Training/TasksTraining/TaskTrainingBase.cs`: se añaden los campos hoy exclusivos de subclase, todos con default (no nullable, igual que su tipo original — se persisten en 0 cuando no aplican, como ya pasa implícitamente en `PhysicalTaskTraining` cuando no se usa):

```csharp
public int Series { get; set; }
public int DurationSeries { get; set; }
public int RestSeries { get; set; }
public TimeSpan Time { get; set; } = TimeSpan.Zero;
public int TouchesNumber { get; set; }
public int WildCards { get; set; }

public List<TaskTrainingType> Types { get; set; } = new();
```

Se **eliminan** `PhysicalTaskTraining.cs`, `TechnicalTaskTraining.cs`, `TacticalTaskTraining.cs`.

### 3. `TaskTrainingBaseEntityConfiguration.cs`

- Se elimina el bloque `builder.HasDiscriminator<string>(...)`.
- Se añaden mapeos de los campos fusionados (`Series`, `DurationSeries`, `RestSeries`, `Time`, `TouchesNumber`, `WildCards` — todos `IsRequired()` con default 0/`TimeSpan.Zero`, mismo patrón que `Points`).
- Se añade:

```csharp
builder.HasMany(tb => tb.Types)
    .WithOne(t => t.TaskTrainingBase)
    .HasForeignKey(t => t.TaskTrainingBaseId)
    .OnDelete(DeleteBehavior.Cascade);
```

Nueva `Configuration/Aggregates/Trainings/TaskTrainingTypeConfiguration.cs` y `ExerciseTypeConfiguration.cs` (mismo patrón que `TaskTrainingSkillConfiguration.cs`):

```csharp
internal class TaskTrainingTypeConfiguration : IEntityTypeConfiguration<TaskTrainingType>
{
    public void Configure(EntityTypeBuilder<TaskTrainingType> builder)
    {
        builder.ToTable("TaskTrainingTypes");
        builder.HasKey(t => new { t.TaskTrainingBaseId, t.ExerciseTypeId });
        builder.Property(t => t.TaskTrainingBaseId).IsRequired().HasMaxLength(36);
        builder.Property(t => t.ExerciseTypeId).IsRequired().HasMaxLength(36);

        builder.HasOne(t => t.TaskTrainingBase)
            .WithMany(tb => tb.Types)
            .HasForeignKey(t => t.TaskTrainingBaseId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(t => t.ExerciseType)
            .WithMany()
            .HasForeignKey(t => t.ExerciseTypeId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

internal class ExerciseTypeConfiguration : IEntityTypeConfiguration<ExerciseType>
{
    public void Configure(EntityTypeBuilder<ExerciseType> builder)
    {
        builder.ToTable("ExerciseTypes");
        builder.HasKey(t => t.Id);
        builder.Property(t => t.Name).IsRequired().HasMaxLength(50);
        builder.HasIndex(t => t.Name).IsUnique();
    }
}
```

Ambas se descubren por reflexión (`IEntityTypeConfiguration<T>`), sin registro manual.

### 4. `AppDbContext.cs`

Añadir:
```csharp
public DbSet<ExerciseType> ExerciseTypes { get; set; }
public DbSet<TaskTrainingType> TaskTrainingTypes { get; set; }
```

### 5. Seeder — `Infrastructure/Persistence/Seed/ExerciseTypesSeeder.cs` (nuevo)

Mismo patrón que `FormationsSeeder.cs`:

```csharp
public static class ExerciseTypesSeeder
{
    private static readonly string[] Types = ["Physical", "Technical", "Tactical", "Game", "Cognitive", "Psychological"];

    public static async Task SeedAsync(AppDbContext context, CancellationToken cancellationToken = default)
    {
        if (await context.ExerciseTypes.AnyAsync(cancellationToken))
            return;

        context.ExerciseTypes.AddRange(Types.Select(ExerciseType.Create));
        await context.SaveChangesAsync(cancellationToken);
    }
}
```

Registrar en `RFFM.Host/DependencyInjection/WebApplicationExtensions.cs` junto a `FormationsSeeder.SeedAsync(db)` (línea ~230):
```csharp
await RFFM.Api.Infrastructure.Persistence.Seed.ExerciseTypesSeeder.SeedAsync(db);
```

### 6. Migración EF Core

Una única migración (`AddExerciseTypesManyToMany`) que:
1. Crea `ExerciseTypes` (Id, Name único) y `TaskTrainingTypes` (PK compuesta `TaskTrainingBaseId`+`ExerciseTypeId`, FKs cascade).
2. Añade a `TaskTrainingBases` las columnas fusionadas: `Series int NOT NULL DEFAULT 0`, `DurationSeries int NOT NULL DEFAULT 0`, `RestSeries int NOT NULL DEFAULT 0`, `Time interval NOT NULL DEFAULT '00:00:00'`, `TouchesNumber int NOT NULL DEFAULT 0`, `WildCards int NOT NULL DEFAULT 0`.
3. **Data migration** (SQL crudo dentro de `Up()`, vía `migrationBuilder.Sql(...)`):
   - Inserta los 6 tipos en `ExerciseTypes` (mismos valores que el seeder, para que el `WHERE Discriminator = ...` de abajo tenga FK válida — el seeder de arranque hará `AnyAsync` y no reinsertará).
   - Para cada fila de `TaskTrainingBases` con `Discriminator IN ('Physical','Technical','Tactical')`, inserta una fila en `TaskTrainingTypes` mapeando `Discriminator` → `ExerciseTypeId` correspondiente (join por `Name`). Cada ejercicio existente conserva exactamente su tipo original (confirmado con el usuario).
4. Elimina la columna `Discriminator`.
5. `Down()` simétrico: recrea el discriminador a partir de `TaskTrainingTypes` (toma el primer tipo si hubiera más de uno, ya que el modelo antiguo no soportaba multi-tipo) y elimina las tablas nuevas.

### 7. Features — contrato de API

`CreateExercise.cs`:
- `CreateExerciseCommand`: `string Type` → `List<string> Types` (mínimo 1).
- Handler: se elimina el `switch` de subclases; se instancia siempre `new TaskTrainingBase { ... }` con los campos fusionados asignados directamente (sin condicional, ya que "mostrar todos los bloques que apliquen" significa que el frontend ya envía los valores relevantes; los no aplicables quedan en su default 0), y:
  ```csharp
  foreach (var typeId in request.Types.Distinct())
      exercise.Types.Add(new TaskTrainingType { ExerciseTypeId = typeId });
  ```
  (Types llega como IDs de `ExerciseType`, no strings libres — ver Non-Goals: el contrato sigue siendo string pero ahora resuelto contra la tabla `ExerciseTypes` por `Name`, igual que `EssentialSkillIds` se resuelve contra `EssentialSkills`.)
- Validator: `RuleFor(x => x.Types).NotEmpty()` + regla async o lookup contra `ExerciseTypesSeeder.Types` (lista fija en código, evita round-trip a BD en el validator, igual que hoy con el `Must(t => t is "Physical" or ...)`).

`UpdateExercise.cs`: mismo patrón — reemplaza `exercise.Types` completo (`RemoveRange` + `AddRange`), igual que ya hace con `Skills`. Se eliminan los bloques `if (exercise is PhysicalTaskTraining ...)` — los campos fusionados se asignan siempre desde el request.

`GetExercises.cs` / `GetExerciseById.cs`:
- `.Include(tb => tb.Types).ThenInclude(t => t.ExerciseType)` añadido a la query.
- `tb.GetType().Name.Replace("TaskTraining", "")` → `tb.Types.Select(t => t.ExerciseType.Name)`.
- `ExerciseListItem.Type: string` → `ExerciseListItem.Types: IEnumerable<string>`.

### 8. Tests existentes a actualizar

`tests/RFFM.Api.Tests/IntegrationTests/ExerciseSubPrincipleAssignmentTests.cs` construye ejercicios directamente — revisar si instancia `PhysicalTaskTraining`/`TacticalTaskTraining` (a eliminar) y adaptarlo a `TaskTrainingBase` + `Types`.

---

## Frontend

### 1. `types/training.ts`

```ts
export type ExerciseType = "Physical" | "Technical" | "Tactical" | "Game" | "Cognitive" | "Psychological";
```
`Exercise.type` → `Exercise.types: ExerciseType[]`; `CreateExerciseRequest.type` → `types: ExerciseType[]`; `SessionExerciseItem.type` → `types: ExerciseType[]`.

### 2. `constants.ts`

```ts
export const typeOptions: { value: ExerciseType; label: string }[] = [
  { value: "Physical", label: "Fisico" },
  { value: "Technical", label: "Tecnico" },
  { value: "Tactical", label: "Tactico" },
  { value: "Game", label: "Juego" },
  { value: "Cognitive", label: "Cognitivo" },
  { value: "Psychological", label: "Psicologico" },
];
```
`emptyExercise.types: ["Tactical"]` (mantiene el valor por defecto actual, confirmado con el usuario).

### 3. `ExerciseFormPanel.tsx`

El `Select` de Tipo pasa a `multiple`, renderizando los seleccionados como chips dentro del propio control (patrón estándar MUI `Select multiple` + `renderValue`):

```tsx
<Select
  multiple
  value={formData.types}
  label="Tipo"
  onChange={(e: SelectChangeEvent<ExerciseType[]>) => {
    const value = e.target.value;
    setField("types", typeof value === "string" ? value.split(",") : value);
  }}
  renderValue={(selected) => (
    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
      {(selected as ExerciseType[]).map((v) => (
        <Chip key={v} label={typeOptions.find((o) => o.value === v)?.label ?? v} size="small" />
      ))}
    </Box>
  )}
>
  {typeOptions.map((o) => (
    <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
  ))}
</Select>
```

Bloques condicionales `isPhysical` / `isTechTac` (líneas 188-241) ya no son mutuamente excluyentes: ambos pueden mostrarse a la vez si el ejercicio tiene ambos tipos seleccionados (confirmado con el usuario — "mostrar todos los bloques que apliquen").

Guardado: si `formData.types.length === 0`, bloquear guardado con mensaje de error (mínimo 1 tipo), en el mismo punto donde hoy se valida `!form.name.trim()` en `useExerciseForm.ts` (`handleSave`).

### 4. `useExerciseForm.ts`

```ts
const isPhysical = useMemo(() => form.types.includes("Physical"), [form.types]);
const isTechTac = useMemo(
  () => form.types.includes("Technical") || form.types.includes("Tactical"),
  [form.types],
);
```

`applyExercise`: `type: exercise.type` → `types: exercise.types`.

`handleSave`: añadir chequeo `if (form.types.length === 0) { setError("Selecciona al menos un tipo."); return; }` junto al chequeo de nombre existente.

### 5. Tarjetas — chip por tipo

`PrincipleExercisesSection.tsx` (líneas 270-282): reemplazar chip único por mapeo:
```tsx
<Box className={styles.exTypeRow}>
  {ex.types.map((t) => (
    <Chip key={t} label={TYPE_LABELS[t] ?? t} size="small" className={styles.typeChip} />
  ))}
  <Chip label={SECTION_LABELS[ex.section] ?? ex.section} size="small" className={styles.sectionChip} />
</Box>
```
`TYPE_LABELS` se extiende con `Game: "Juego"`, `Cognitive: "Cognitivo"`, `Psychological: "Psicológico"`.

`ExerciseCromo.tsx`: mismo `TYPE_LABELS` extendido. El **tipo primario** (primer elemento de `ex.types`) sigue determinando el color de borde/badge de la tarjeta (`styles[\`type_${exercise.types[0]}\`]`), ya que la tarjeta tiene un único acento visual — se añade un chip adicional por cada tipo extra junto al badge existente. `ExerciseCromo.module.css` necesita 3 nuevas clases (`type_Game`, `type_Technical`... ya existen; añadir `type_Game`, `type_Cognitive`, `type_Psychological` y sus `typeBadge_*` equivalentes) con colores de acento nuevos (a definir por front-specialist, p. ej. violeta para Cognitivo, rosa para Psicológico, ámbar para Juego — no bloqueante).

`TypeIcon`: añadir casos para los 3 tipos nuevos (iconos MUI sugeridos: `SportsEsportsIcon` para Juego, `PsychologyAltIcon` para Cognitivo, `SelfImprovementIcon` para Psicológico — `PsychologyIcon` ya está tomado por Táctico).

**Nota de duplicación** (ya señalada en el proposal): `TYPE_LABELS`/`SECTION_LABELS` están duplicados en ambos archivos. Como este cambio ya toca ambos, se extraen a un módulo compartido `apps/coach/pages/trainings/exerciseTypeLabels.ts` para no triplicar el mantenimiento de los 6 valores.

### 6. `trainingService.ts` / `SessionExerciseItem`

Sin cambios de firma más allá de los tipos ya cubiertos en `training.ts` — los servicios pasan `types` tal cual, ya que el body ya es el objeto completo (`CreateExerciseRequest`/`UpdateExerciseRequest`).

---

## Test Plan (TDD)

**Backend** (xUnit + Moq, `tests/RFFM.Api.Tests`):
- `CreateExerciseHandlerTests`: crea ejercicio con 1 tipo, con múltiples tipos, rechaza 0 tipos (validator).
- `UpdateExerciseHandlerTests`: reemplaza tipos existentes (añade/quita), conserva campos fusionados.
- `GetExercisesHandlerTests` / `GetExerciseByIdHandlerTests`: proyecta `Types` como lista de nombres.
- Test de migración de datos (integration test con BD real, sembrando una fila `Discriminator='Physical'` y verificando que tras aplicar la migración aparece en `TaskTrainingTypes` con el tipo correcto) — opcional si el proyecto no tiene infraestructura de test de migraciones; si no la tiene, verificar manualmente con `dotnet ef database update` sobre una copia de datos de desarrollo.

**Frontend** (Vitest + Testing Library):
- `ExerciseFormPanel.test.tsx`: selecciona múltiples tipos, verifica que aparecen ambos bloques de campos (Series + Toques) cuando se seleccionan Físico y Técnico a la vez.
- `useExerciseForm.test.ts`: `isPhysical`/`isTechTac` con array de tipos; bloqueo de guardado con 0 tipos.
- `PrincipleExercisesSection.test.tsx` / `ExerciseCromo.test.tsx`: renderiza un chip por cada tipo en `ex.types`.

---

## Open Questions (a resolver por back-specialist/front-specialist durante implement, no bloqueantes)

- Colores de acento para Juego/Cognitivo/Psicológico en `ExerciseCromo.module.css`.
- Si el test de migración de datos requiere infraestructura de integration test con Testcontainers/Postgres real (revisar si ya existe en el proyecto antes de añadir una nueva).
