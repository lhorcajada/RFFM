# Implement — multi-type-exercise-selector

Script técnico para el agente `openspec-implementer`. TDD estricto (Red → Green → Refactor) por bloque, en el orden de `tasks.md`. No avances de bloque sin tests en verde.

**⚠️ Antes de cualquier `dotnet build`/`dotnet test`/`dotnet run`/`dotnet ef`: el usuario tiene la API corriendo en local. Avisa explícitamente y espera confirmación de que la ha parado antes de ejecutar esos comandos.**

Convenciones detectadas en el repo:
- Tests backend en `Back/ExtractionApi/tests/RFFM.Api.Tests/`, xUnit + Moq. Los handlers que usan `AppDbContext` real lo hacen contra Postgres vía `[Collection(PostgresCollection.Name)]` / `PostgresContainerFixture` (ver `UnitTests/GetClubHandlerTests.cs` en otro change como referencia de patrón) — usar el mismo patrón para los tests de este change en vez de mocks de EF Core (EF In-Memory no soporta bien relaciones many-to-many con la misma fidelidad).
- Tests frontend co-ubicados en `__tests__/` junto al componente, Vitest + Testing Library.
- Ver `design.md` de este change para el detalle completo de cada snippet — este script referencia esos snippets por sección en vez de repetirlos íntegros.

---

## Bloque 1 — Backend: Dominio y persistencia (sin tests unitarios propios; se cubre con los tests de Bloque 3)

### 1.1 Crear entidades nuevas

Crear `Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/Training/TasksTraining/ExerciseType.cs` y `TaskTrainingType.cs` exactamente como en `design.md` §1.

### 1.2 Modificar `TaskTrainingBase.cs`

Añadir los campos fusionados y `List<TaskTrainingType> Types` (`design.md` §2). No tocar el resto de la clase.

### 1.3 Eliminar subclases TPH

Borrar `PhysicalTaskTraining.cs`, `TechnicalTaskTraining.cs`, `TacticalTaskTraining.cs`. Buscar (`grep -rn "PhysicalTaskTraining\|TechnicalTaskTraining\|TacticalTaskTraining"` en `Back/ExtractionApi/src`) todas las referencias restantes antes de continuar — deben quedar solo en `CreateExercise.cs`/`UpdateExercise.cs` (se tocan en Bloque 3) y en el test de integración (Bloque 3.4).

### 1.4 Configuración EF

- Editar `TaskTrainingBaseEntityConfiguration.cs`: quitar `HasDiscriminator`, añadir mapeo de campos fusionados y `HasMany(tb => tb.Types)` (`design.md` §3).
- Crear `TaskTrainingTypeConfiguration.cs` y `ExerciseTypeConfiguration.cs` en la misma carpeta (`design.md` §3).

### 1.5 `AppDbContext.cs`

Añadir los dos `DbSet` (`design.md` §4).

### 1.6 Seeder

Crear `ExerciseTypesSeeder.cs` (`design.md` §5) y registrar la llamada en `WebApplicationExtensions.cs` junto a `FormationsSeeder.SeedAsync(db)`.

Verificar (avisar antes): `dotnet build` — debe compilar (aunque `CreateExercise.cs`/`UpdateExercise.cs`/`GetExercises.cs`/`GetExerciseById.cs` fallarán porque referencian las subclases eliminadas; eso se corrige en Bloque 3 — si el build de este bloque falla solo por esos 4 archivos, es esperado, continuar).

---

## Bloque 2 — Backend: Migración EF Core

### 2.1 Generar migración

```bash
cd Back/ExtractionApi
.\manage-migrations.ps1
# o: dotnet ef migrations add AddExerciseTypesManyToMany --project src/RFFM.Api --startup-project src/RFFM.Host
```

### 2.2 Editar el `Up()`/`Down()` generado

Añadir el SQL de migración de datos descrito en `design.md` §6 punto 3, usando `migrationBuilder.Sql(...)` **después** de crear las tablas nuevas y **antes** de borrar la columna `Discriminator`. Ejemplo de forma (adaptar a los nombres reales que EF genere):

```csharp
migrationBuilder.Sql(@"
    INSERT INTO ""ExerciseTypes"" (""Id"", ""Name"") VALUES
        (gen_random_uuid()::text, 'Physical'),
        (gen_random_uuid()::text, 'Technical'),
        (gen_random_uuid()::text, 'Tactical'),
        (gen_random_uuid()::text, 'Game'),
        (gen_random_uuid()::text, 'Cognitive'),
        (gen_random_uuid()::text, 'Psychological');

    INSERT INTO ""TaskTrainingTypes"" (""TaskTrainingBaseId"", ""ExerciseTypeId"")
    SELECT tb.""Id"", et.""Id""
    FROM ""TaskTrainingBases"" tb
    JOIN ""ExerciseTypes"" et ON et.""Name"" = tb.""Discriminator""
    WHERE tb.""Discriminator"" IN ('Physical', 'Technical', 'Tactical');
");
```

Comprobar el nombre real de la función UUID disponible en la instancia Postgres del proyecto (`gen_random_uuid()` requiere `pgcrypto`/Postgres 13+; si el proyecto ya usa otra convención para IDs en otras migraciones de seed, seguir esa — revisar `ClubKitsSeeder`/migraciones previas de seed de datos para el patrón exacto de generación de Id usado en SQL crudo).

Escribir el `Down()` simétrico (recrea `Discriminator` a partir de `TaskTrainingTypes`, tomando el primer tipo si hay varios, y elimina las tablas nuevas).

Verificar (avisar antes, y confirmar que se aplica sobre una BD de desarrollo, no producción): `dotnet ef database update`.

---

## Bloque 3 — Backend: Features (contrato de API)

### 3.1 Red

Actualizar/crear (siguiendo el patrón real de tests de handlers ya existente en el repo — buscar un test de handler existente para copiar el fixture exacto, p. ej. algo bajo `UnitTests/` que use `PostgresContainerFixture` o el mock de `AppDbContext` que ya use el proyecto):

- `CreateExerciseHandlerTests`: crear con 1 tipo → éxito; crear con 3 tipos → los 3 se persisten en `TaskTrainingTypes`; validator rechaza `Types` vacío.
- `UpdateExerciseHandlerTests`: reemplaza el conjunto de tipos (quita uno, añade otro); conserva campos fusionados no enviados (`Series` no tocado si `request.Series` es null y el ejercicio ya tenía valor — mismo comportamiento `?? valorActual` que hoy).
- `GetExercisesHandlerTests` / `GetExerciseByIdHandlerTests`: `Types` en la respuesta refleja los nombres de `ExerciseType` asociados.

Ejecutar (avisar antes): `dotnet test --filter "CreateExerciseHandlerTests|UpdateExerciseHandlerTests|GetExercisesHandlerTests|GetExerciseByIdHandlerTests"` → deben fallar (compilación, porque el contrato aún es `Type: string`).

### 3.2 Green — `CreateExercise.cs`

- `CreateExerciseCommand`: `string Type` → `List<string> Types`.
- Handler: eliminar el `switch`; instanciar siempre `new TaskTrainingBase()`, asignar todos los campos (incluidos los fusionados: `Series = request.Series ?? 0`, etc., sin condicional de tipo), y:
  ```csharp
  var typeEntities = await _db.ExerciseTypes
      .Where(t => request.Types.Contains(t.Name))
      .ToListAsync(ct);
  foreach (var typeEntity in typeEntities)
      exercise.Types.Add(new TaskTrainingType { ExerciseTypeId = typeEntity.Id });
  ```
- Validator: `RuleFor(x => x.Types).NotEmpty()`, `RuleForEach(x => x.Types).Must(t => ValidTypes.Contains(t))` con `ValidTypes` = `["Physical", "Technical", "Tactical", "Game", "Cognitive", "Psychological"]` (constante estática en el validator o en `ExerciseTypesSeeder.Types`, reutilizar esa misma lista para no duplicar los 6 valores en dos sitios).

### 3.3 Green — `UpdateExercise.cs`

Mismo patrón que `Skills` (líneas 101-105 actuales): `_db.TaskTrainingTypes.RemoveRange(exercise.Types); exercise.Types.Clear();` luego resolver `request.Types` contra `_db.ExerciseTypes` igual que en Create. Eliminar los tres bloques `if (exercise is Physical/Tactical/TechnicalTaskTraining)` — los campos fusionados se asignan siempre: `exercise.Series = request.Series ?? exercise.Series;` etc., sin el `is` check.

### 3.4 Green — `GetExercises.cs` / `GetExerciseById.cs`

- Añadir `.Include(tb => tb.Types).ThenInclude(t => t.ExerciseType)` a la query.
- Sustituir `tb.GetType().Name.Replace("TaskTraining", "")` por `tb.Types.Select(t => t.ExerciseType.Name)`.
- `ExerciseListItem`: `string Type` → `IEnumerable<string> Types`.

### 3.5 Adaptar test de integración existente

Revisar `tests/RFFM.Api.Tests/IntegrationTests/ExerciseSubPrincipleAssignmentTests.cs`: si instancia `new PhysicalTaskTraining { ... }` o similar, cambiar a `new TaskTrainingBase { ... , Types = [new TaskTrainingType { ExerciseTypeId = ... }] }` (resolver el id del tipo sembrado en el `SeedAsync` local del propio archivo de test, añadiendo la siembra de `ExerciseType` si el test crea su propia BD desde cero).

Ejecutar (avisar antes): `dotnet build && dotnet test`.

---

## Bloque 4 — Frontend: Tipos y constantes

### 4.1 `types/training.ts`

Aplicar los cambios de `design.md` (Frontend §1): `ExerciseType` con 6 valores; `type` → `types: ExerciseType[]` en `Exercise`, `CreateExerciseRequest`, `SessionExerciseItem`.

### 4.2 `constants.ts`

Aplicar `design.md` (Frontend §2): `typeOptions` con los 6 valores; `emptyExercise.types = ["Tactical"]`.

### 4.3 Módulo compartido de labels

Crear `Front/src/apps/coach/pages/trainings/exerciseTypeLabels.ts`:

```ts
import type { ExerciseType, ExerciseSection } from "../../types/training";

export const TYPE_LABELS: Record<ExerciseType, string> = {
  Physical: "Físico",
  Technical: "Técnico",
  Tactical: "Táctico",
  Game: "Juego",
  Cognitive: "Cognitivo",
  Psychological: "Psicológico",
};

export const SECTION_LABELS: Record<ExerciseSection, string> = {
  Calentamiento: "Calentamiento",
  Principal: "Principal",
  VueltaALaCalma: "Vuelta calma",
};
```

Sustituir las definiciones locales duplicadas en `PrincipleExercisesSection.tsx` y `ExerciseCromo.tsx` por un import de este módulo.

Verificar: `npm run build` (esperar errores de tipos en los componentes que aún usan `.type` — se resuelven en Bloques 5-6).

---

## Bloque 5 — Frontend: Formulario de ejercicio

### 5.1 Red

Crear/actualizar `ExerciseFormPanel.test.tsx` y `useExerciseForm.test.ts` (co-ubicados en `__tests__/` junto a cada archivo, siguiendo el patrón Vitest + Testing Library ya usado en el resto de `apps/coach`):

- Seleccionar Físico + Técnico en el `Select multiple` → ambos bloques de campos (Series/Descanso y Toques/Comodines) visibles simultáneamente.
- `isPhysical`/`isTechTac` como booleanos derivados de `form.types.includes(...)`.
- `handleSave` con `form.types = []` → `setError` con mensaje y no llama a `trainingService.createExercise`.

Ejecutar: `npm run test -- ExerciseFormPanel useExerciseForm` → deben fallar (aún usan `form.type` singular).

### 5.2 Green

Aplicar `design.md` (Frontend §3 y §4) a `ExerciseFormPanel.tsx` y `useExerciseForm.ts`.

Verificar: `npm run test -- ExerciseFormPanel useExerciseForm && npm run build`.

---

## Bloque 6 — Frontend: Tarjetas

### 6.1 Red

Actualizar los tests existentes que cubran `PrincipleExercisesSection`/`SubSubPrincipleCard` y crear/actualizar uno para `ExerciseCromo` (revisar si ya existe un test para este componente antes de crear uno nuevo): con `exercise.types = ["Physical", "Cognitive"]`, deben renderizarse 2 chips/badges de tipo, no 1.

Ejecutar: `npm run test -- PrincipleExercisesSection ExerciseCromo SubSubPrincipleCard` → deben fallar.

### 6.2 Green

Aplicar `design.md` (Frontend §5):
- `PrincipleExercisesSection.tsx`: mapear `ex.types` a chips.
- `ExerciseCromo.tsx`: `TypeIcon` con 3 casos nuevos (`SportsEsportsIcon` Juego, `PsychologyAltIcon` Cognitivo, `SelfImprovementIcon` Psicológico); badge/borde usa `exercise.types[0]`; chips adicionales para el resto de `exercise.types`.
- `ExerciseCromo.module.css`: añadir `type_Game`, `type_Cognitive`, `type_Psychological` (border-color) y `typeBadge_Game`, `typeBadge_Cognitive`, `typeBadge_Psychological` (mismo patrón que las 3 existentes en las líneas 27-32 y 102-114 — elegir colores de acento distintos y sin colisión visual con los 3 ya usados: naranja/Físico, azul/Técnico, verde/Táctico; sugerido ámbar para Juego, violeta para Cognitivo, rosa para Psicológico).

Verificar: `npm run test -- PrincipleExercisesSection ExerciseCromo SubSubPrincipleCard && npm run build`.

---

## Bloque 7 — Verificación final

```bash
# Backend (avisar antes de ejecutar: requiere que el usuario pare su API local)
cd Back/ExtractionApi
dotnet build
dotnet test

# Frontend
cd Front
npm run build
npm run test
```

Manual (requiere backend + frontend corriendo):
1. Crear un ejercicio nuevo seleccionando 3 tipos (p. ej. Físico + Táctico + Juego) → guardar → verificar que la tarjeta en la biblioteca (`ExerciseCromo`) y en `game-model` (`PrincipleExercisesSection`) muestran los 3 chips.
2. Editar ese ejercicio, quitar un tipo y añadir otro → guardar → recargar → verificar que persiste el nuevo conjunto.
3. Intentar guardar con 0 tipos seleccionados → debe bloquear con mensaje de error, sin llamar a la API.

Si todo pasa: `openspec validate multi-type-exercise-selector` y mover la carpeta a `openspec/changes/archive/2026-07-25-multi-type-exercise-selector/`.
