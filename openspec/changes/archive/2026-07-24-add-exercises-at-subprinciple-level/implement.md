# Implement — add-exercises-at-subprinciple-level

Script técnico para el agente `openspec-implementer`. TDD estricto (Red → Green → Refactor) por bloque, en el orden de `tasks.md`. No avances de bloque sin que los tests del bloque actual pasen.

Convenciones detectadas en el repo:
- Tests backend en `Back/ExtractionApi/tests/RFFM.Api.Tests/{UnitTests,IntegrationTests}/`, xUnit, `#nullable enable`.
- Los handlers que tocan `AppDbContext` se prueban contra Postgres real: `[Collection(PostgresCollection.Name)]` + `PostgresContainerFixture` (ver `GetClubHandlerTests.cs`, `GameModelTacticalPrincipleForeignKeyTests.cs`). No usar InMemory provider.
- `Club.Create(name, countryId)` con `countryId = 1` (seed fijo). Para jerarquía de modelo de juego: `new GameModel(teamId, name, season)` → `.Scenarios.Add(new GameScenario(...))` → `scenario.SubPrinciples.Add(new SubPrinciple(scenarioId, label, name, context, order))`.
- Tests frontend co-ubicados en `__tests__/` junto al componente, Vitest + Testing Library + `vi.mock` de servicios (ver `SubSubPrincipleCard.test.tsx`).

---

## Bloque 1 — Backend: Domain + EF + migración

### 1.1 Green (sin test unitario propio — se verifica en bloque 2/3)

En `Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/Training/TasksTraining/TaskTrainingBase.cs`, junto a `SubSubPrincipleId`:

```csharp
/// <summary>Optional: the sub-principle this exercise targets (mutually exclusive with SubSubPrincipleId).</summary>
public string? SubPrincipleId { get; set; }
```

y junto a `public SubSubPrinciple? SubSubPrinciple { get; set; }`:

```csharp
public RFFM.Api.Domain.Aggregates.GameModels.SubPrinciple? SubPrinciple { get; set; }
```

(usa el using ya presente `RFFM.Api.Domain.Aggregates.GameModels` en el archivo — solo añade `SubPrinciple? SubPrinciple { get; set; }` sin prefijo si el using ya cubre el namespace).

En `Infrastructure/Persistence/Configuration/Aggregates/Trainings/TaskTrainingBaseEntityConfiguration.cs`, tras el bloque de `SubSubPrincipleId`:

```csharp
builder.Property(tb => tb.SubPrincipleId)
    .IsRequired(false)
    .HasMaxLength(36);
```

y tras el bloque `HasOne(tb => tb.SubSubPrinciple)...`:

```csharp
builder.HasOne(tb => tb.SubPrinciple)
    .WithMany()
    .HasForeignKey(tb => tb.SubPrincipleId)
    .IsRequired(false)
    .OnDelete(DeleteBehavior.SetNull);
```

### 1.2 Migración

```
cd Back/ExtractionApi
.\manage-migrations.ps1
```

Si el script pide un nombre, usar `AddSubPrincipleIdToTaskTrainingBase`. Confirmar que la migración generada solo añade la columna nullable `SubPrincipleId` + su FK — no debe tocar otras tablas.

### 1.3 Verificar

```
dotnet build
```

Debe compilar sin errores (aunque nada lo consuma todavía).

---

## Bloque 2 — Backend: `CreateExercise` / `UpdateExercise` (write-side)

### 2.1 Red

Crear `Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/ExerciseSubPrincipleAssignmentTests.cs`:

```csharp
#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.GameModels;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.Trainings.Exercises;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    [Collection(PostgresCollection.Name)]
    public class ExerciseSubPrincipleAssignmentTests
    {
        private readonly PostgresContainerFixture _fixture;

        public ExerciseSubPrincipleAssignmentTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<(string UserId, string ClubId, string SubPrincipleId, string SubSubPrincipleId)> SeedAsync(AppDbContext db)
        {
            var club = Club.Create($"Exercise SP Test Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create($"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9), isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "Exercise SP Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var userId = $"coach-{Guid.NewGuid():N}";
            db.UserClubs.Add(new UserClub(userId, club.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();

            var model = new GameModel(team.Id, "Modelo de prueba", "2025-2026");
            var scenario = new GameScenario(model.Id, gameMomentId: 1, gameZoneId: 1, order: 0, "Escenario 1", "Contexto");
            var subPrinciple = new SubPrinciple(scenario.Id, "A", "Subprincipio 1", "Contexto", order: 0);
            var subSubPrinciple = new SubSubPrinciple(subPrinciple.Id, order: 0, "Sub-subprincipio 1", "Acción 1");
            subPrinciple.SubSubPrinciples.Add(subSubPrinciple);
            scenario.SubPrinciples.Add(subPrinciple);
            model.Scenarios.Add(scenario);
            db.GameModels.Add(model);
            await db.SaveChangesAsync();

            return (userId, club.Id, subPrinciple.Id, subSubPrinciple.Id);
        }

        private static CreateExerciseCommand BaseCreateCommand(string clubId, string userId) => new(
            clubId, "Ejercicio de prueba", "Descripción", "Tactical",
            10, 8, 0, "Media cancha",
            SubSubPrincipleId: null,
            Section: "Principal",
            EssentialSkillIds: new List<string>(),
            BoardStateJson: null,
            Series: null, DurationSeries: null, RestSeries: null,
            TouchesNumber: 0, WildCards: 0)
        { UserId = userId };

        [Fact]
        public async Task Create_WithSubPrincipleIdOnly_PersistsSubPrincipleId()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, subPrincipleId, _) = await SeedAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var handler = new CreateExerciseHandler(db);
            var command = BaseCreateCommand(clubId, userId) with { SubPrincipleId = subPrincipleId };

            var id = await handler.Handle(command, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var exercise = await verifyDb.TaskTrainingBases.SingleAsync(e => e.Id == id);
            Assert.Equal(subPrincipleId, exercise.SubPrincipleId);
            Assert.Null(exercise.SubSubPrincipleId);
        }

        [Fact]
        public async Task Create_WithBothIds_FailsValidation()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, subPrincipleId, subSubPrincipleId) = await SeedAsync(seedDb);

            var command = BaseCreateCommand(clubId, userId) with
            {
                SubPrincipleId = subPrincipleId,
                SubSubPrincipleId = subSubPrincipleId
            };
            var validator = new CreateExerciseValidator();

            var result = await validator.ValidateAsync(command);

            Assert.False(result.IsValid);
        }

        [Fact]
        public async Task Create_WithNeitherId_FailsValidation()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, _, _) = await SeedAsync(seedDb);

            var command = BaseCreateCommand(clubId, userId);
            var validator = new CreateExerciseValidator();

            var result = await validator.ValidateAsync(command);

            Assert.False(result.IsValid);
        }

        [Fact]
        public async Task Update_ReassignFromSubSubPrincipleToSubPrinciple_ClearsOldLink()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, subPrincipleId, subSubPrincipleId) = await SeedAsync(seedDb);

            await using var createDb = _fixture.CreateDbContext();
            var createHandler = new CreateExerciseHandler(createDb);
            var exerciseId = await createHandler.Handle(
                BaseCreateCommand(clubId, userId) with { SubSubPrincipleId = subSubPrincipleId },
                CancellationToken.None);

            await using var updateDb = _fixture.CreateDbContext();
            var updateHandler = new UpdateExerciseHandler(updateDb);
            var updateCommand = new UpdateExerciseCommand(
                "Ejercicio de prueba", "Descripción", 10, 8, 0, "Media cancha",
                SubSubPrincipleId: null,
                Section: "Principal",
                EssentialSkillIds: new List<string>(),
                BoardStateJson: null,
                Series: null, DurationSeries: null, RestSeries: null,
                TouchesNumber: 0, WildCards: 0)
            { Id = exerciseId, UserId = userId, SubPrincipleId = subPrincipleId };

            await updateHandler.Handle(updateCommand, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var exercise = await verifyDb.TaskTrainingBases.SingleAsync(e => e.Id == exerciseId);
            Assert.Equal(subPrincipleId, exercise.SubPrincipleId);
            Assert.Null(exercise.SubSubPrincipleId);
        }

        [Fact]
        public async Task Update_ReassignFromSubPrincipleToSubSubPrinciple_ClearsOldLink()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, subPrincipleId, subSubPrincipleId) = await SeedAsync(seedDb);

            await using var createDb = _fixture.CreateDbContext();
            var createHandler = new CreateExerciseHandler(createDb);
            var exerciseId = await createHandler.Handle(
                BaseCreateCommand(clubId, userId) with { SubPrincipleId = subPrincipleId },
                CancellationToken.None);

            await using var updateDb = _fixture.CreateDbContext();
            var updateHandler = new UpdateExerciseHandler(updateDb);
            var updateCommand = new UpdateExerciseCommand(
                "Ejercicio de prueba", "Descripción", 10, 8, 0, "Media cancha",
                SubSubPrincipleId: subSubPrincipleId,
                Section: "Principal",
                EssentialSkillIds: new List<string>(),
                BoardStateJson: null,
                Series: null, DurationSeries: null, RestSeries: null,
                TouchesNumber: 0, WildCards: 0)
            { Id = exerciseId, UserId = userId, SubPrincipleId = null };

            await updateHandler.Handle(updateCommand, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var exercise = await verifyDb.TaskTrainingBases.SingleAsync(e => e.Id == exerciseId);
            Assert.Equal(subSubPrincipleId, exercise.SubSubPrincipleId);
            Assert.Null(exercise.SubPrincipleId);
        }
    }
}
```

Ejecutar `dotnet test --filter ExerciseSubPrincipleAssignmentTests` → debe fallar en compilación (falta `SubPrincipleId` en los comandos/validators).

> Nota: adapta el constructor de `SubSubPrinciple` (`new SubSubPrinciple(subPrincipleId, order, name, action)`) y de `GameScenario`/`GameModel` a la firma real si difiere — revisa `Domain/Aggregates/GameModels/SubSubPrinciple.cs` antes de escribir el test si el compilador se queja.

### 2.2 Green

En `CreateExercise.cs`:
- Añadir `string? SubPrincipleId` al record `CreateExerciseCommand` (después de `SubSubPrincipleId`).
- En el handler, tras `exercise.SubSubPrincipleId = request.SubSubPrincipleId;` añadir `exercise.SubPrincipleId = request.SubPrincipleId;`.
- En `CreateExerciseValidator`, añadir:

```csharp
RuleFor(x => x)
    .Must(x => string.IsNullOrEmpty(x.SubSubPrincipleId) != string.IsNullOrEmpty(x.SubPrincipleId))
    .WithMessage("Exactly one of SubSubPrincipleId or SubPrincipleId must be provided.");
```

(la condición `!=` sobre dos booleanos ya expresa el XOR — exactamente uno vacío y el otro no).

En `UpdateExercise.cs`:
- Añadir `string? SubPrincipleId` al record `UpdateExerciseCommand`.
- Sustituir:

```csharp
// Only overwrite SubSubPrincipleId if explicitly provided — never clear an existing link
if (!string.IsNullOrEmpty(request.SubSubPrincipleId))
    exercise.SubSubPrincipleId = request.SubSubPrincipleId;
```

por:

```csharp
exercise.SubSubPrincipleId = request.SubSubPrincipleId;
exercise.SubPrincipleId = request.SubPrincipleId;
```

- Añadir a `UpdateExerciseValidator` la misma regla XOR que en `CreateExerciseValidator`.

### 2.3 Verificar

```
dotnet test --filter ExerciseSubPrincipleAssignmentTests
```

Todos los `[Fact]` deben pasar.

---

## Bloque 3 — Backend: `GetExercises` / `GetExerciseById` (read-side)

### 3.1 Red

Añadir a `ExerciseSubPrincipleAssignmentTests.cs` (mismo archivo, misma seed):

```csharp
[Fact]
public async Task GetExercises_FilteredBySubPrincipleId_ReturnsOnlyMatchingExercises()
{
    await using var seedDb = _fixture.CreateDbContext();
    var (userId, clubId, subPrincipleId, subSubPrincipleId) = await SeedAsync(seedDb);

    await using var createDb = _fixture.CreateDbContext();
    var createHandler = new CreateExerciseHandler(createDb);
    var spExerciseId = await createHandler.Handle(
        BaseCreateCommand(clubId, userId) with { SubPrincipleId = subPrincipleId }, CancellationToken.None);
    await createHandler.Handle(
        BaseCreateCommand(clubId, userId) with { SubSubPrincipleId = subSubPrincipleId }, CancellationToken.None);

    await using var queryDb = _fixture.CreateDbContext();
    var handler = new GetExercisesHandler(queryDb);
    var result = await handler.Handle(new GetExercisesQuery(clubId, SubSubPrincipleId: null, SubPrincipleId: subPrincipleId, UserId: userId), CancellationToken.None);

    var list = result.ToList();
    Assert.Single(list);
    Assert.Equal(spExerciseId, list[0].Id);
    Assert.Equal(subPrincipleId, list[0].SubPrincipleId);
}

[Fact]
public async Task GetExerciseById_LinkedToSubPrinciple_ReturnsSubPrincipleName()
{
    await using var seedDb = _fixture.CreateDbContext();
    var (userId, clubId, subPrincipleId, _) = await SeedAsync(seedDb);

    await using var createDb = _fixture.CreateDbContext();
    var createHandler = new CreateExerciseHandler(createDb);
    var exerciseId = await createHandler.Handle(
        BaseCreateCommand(clubId, userId) with { SubPrincipleId = subPrincipleId }, CancellationToken.None);

    await using var queryDb = _fixture.CreateDbContext();
    var handler = new GetExerciseByIdHandler(queryDb);
    var result = await handler.Handle(new GetExerciseByIdQuery(exerciseId, userId), CancellationToken.None);

    Assert.NotNull(result);
    Assert.Equal(subPrincipleId, result!.SubPrincipleId);
    Assert.Equal("Subprincipio 1", result.SubPrincipleName);
}
```

Ejecutar `dotnet test --filter ExerciseSubPrincipleAssignmentTests` → deben fallar en compilación (`GetExercisesQuery` no acepta `SubPrincipleId`, `ExerciseListItem` no tiene `SubPrincipleId`/`SubPrincipleName`).

### 3.2 Green

En `GetExercises.cs`:
- Endpoint: añadir parámetro `string? subPrincipleId` al delegate del `MapGet` y pasarlo al `GetExercisesQuery`.
- `GetExercisesQuery` gana `string? SubPrincipleId` (tercer parámetro posicional, antes de `UserId` para mantener consistencia con el orden usado arriba, o al final — ajusta las llamadas del test si cambias el orden).
- Handler: añadir `.Include(tb => tb.SubPrinciple)` a la query y:

```csharp
if (!string.IsNullOrEmpty(request.SubPrincipleId))
    query = query.Where(tb => tb.SubPrincipleId == request.SubPrincipleId);
```

- `ExerciseListItem` gana `string? SubPrincipleId, string? SubPrincipleName` (después de `SubSubPrincipleName`); actualizar la proyección `Select` para pasarlos (`tb.SubPrincipleId, tb.SubPrinciple?.Name`).

En `GetExerciseById.cs`:
- `.Include(tb => tb.SubPrinciple)` en la query.
- Pasar `exercise.SubPrincipleId, exercise.SubPrinciple?.Name` al construir el `ExerciseListItem` (mismo orden de argumentos que en `GetExercises.cs`).

### 3.3 Verificar

```
dotnet test --filter ExerciseSubPrincipleAssignmentTests
dotnet build
dotnet test
```

Toda la suite backend debe pasar.

---

## Bloque 4 — Frontend: types + service

### 4.1 Green (cambio mecánico, no requiere test nuevo)

En `Front/src/apps/coach/types/training.ts`:
- `Exercise`: añadir tras `subSubPrincipleName?: string | null;`:
  ```ts
  subPrincipleId?: string | null;
  subPrincipleName?: string | null;
  ```
- `CreateExerciseRequest`: añadir tras `subSubPrincipleId?: string | null;`:
  ```ts
  subPrincipleId?: string | null;
  ```

En `Front/src/apps/coach/services/trainingService.ts`, cambiar la firma de `getExercises`:

```ts
async getExercises(clubId: string, opts?: { subSubPrincipleId?: string | null; subPrincipleId?: string | null }): Promise<Exercise[]> {
  const params: Record<string, string> = { clubId };
  if (opts?.subSubPrincipleId) params.subSubPrincipleId = opts.subSubPrincipleId;
  if (opts?.subPrincipleId) params.subPrincipleId = opts.subPrincipleId;
  const res = await client.get<Exercise[]>("/api/trainings/exercises", { params });
  return res.data;
},
```

Actualizar los dos call sites existentes:
- `SubSubPrincipleCard.tsx` (`loadExercises`, hoy `trainingService.getExercises(clubId, sspApiId)`) → se elimina de aquí porque este archivo pasará a delegar en `PrincipleExercisesSection` (bloque 5); no dejar una llamada rota a medio camino — hazlo en el mismo commit lógico que el bloque 5, o temporalmente `trainingService.getExercises(clubId, { subSubPrincipleId: sspApiId })` si separas los commits.
- `SessionsFromSubPrinciple.tsx` (`trainingService.getExercises(clubId)` sin segundo argumento — no requiere cambio, sigue funcionando con `opts` `undefined`).

### 4.2 Verificar

```
npx tsc --noEmit
```

Debe fallar señalando exactamente el call site de `SubSubPrincipleCard.tsx` (positional arg ya no coincide con el tipo `opts`) — esto es esperado hasta el bloque 5; anota el error y continúa.

---

## Bloque 5 — Frontend: extraer `PrincipleExercisesSection`

### 5.1 Red

Crear `Front/src/apps/coach/pages/game-model/components/__tests__/PrincipleExercisesSection.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import PrincipleExercisesSection from "../PrincipleExercisesSection";
import type { Exercise } from "../../../../types/training";
import trainingService from "../../../../services/trainingService";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("../../../../services/trainingService", () => ({
  default: { getExercises: vi.fn(), deleteExercise: vi.fn() },
}));

function buildExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: "ex-1", name: "Ejercicio de prueba", description: "", type: "Tactical",
    section: "Principal", durationTotal: 10, playersNumber: 6, goalPeekersNumber: 0,
    fieldSpace: "", skills: [], conditions: [], ...overrides,
  };
}

describe("PrincipleExercisesSection", () => {
  beforeEach(() => {
    vi.mocked(trainingService.getExercises).mockReset();
    mockNavigate.mockReset();
  });

  it("carga ejercicios filtrando por subSubPrincipleId cuando levelKind es subSubPrinciple", async () => {
    vi.mocked(trainingService.getExercises).mockResolvedValue([buildExercise()]);

    render(
      <MemoryRouter initialEntries={["/coach/game-model?clubId=club-1&teamId=team-9"]}>
        <PrincipleExercisesSection
          clubId="club-1" teamId="team-9" levelKind="subSubPrinciple"
          levelApiId="ssp-1" levelName="Sub-subprincipio X" active
        />
      </MemoryRouter>
    );

    await waitFor(() => expect(trainingService.getExercises).toHaveBeenCalledWith(
      "club-1", { subSubPrincipleId: "ssp-1" }
    ));
    expect(await screen.findByText("Ejercicio de prueba")).toBeInTheDocument();
  });

  it("carga ejercicios filtrando por subPrincipleId cuando levelKind es subPrinciple", async () => {
    vi.mocked(trainingService.getExercises).mockResolvedValue([buildExercise()]);

    render(
      <MemoryRouter initialEntries={["/coach/game-model?clubId=club-1&teamId=team-9"]}>
        <PrincipleExercisesSection
          clubId="club-1" teamId="team-9" levelKind="subPrinciple"
          levelApiId="sp-1" levelName="Subprincipio X" active
        />
      </MemoryRouter>
    );

    await waitFor(() => expect(trainingService.getExercises).toHaveBeenCalledWith(
      "club-1", { subPrincipleId: "sp-1" }
    ));
  });

  it("no carga ejercicios cuando active es false", () => {
    render(
      <MemoryRouter>
        <PrincipleExercisesSection
          clubId="club-1" teamId="team-9" levelKind="subPrinciple"
          levelApiId="sp-1" levelName="Subprincipio X" active={false}
        />
      </MemoryRouter>
    );
    expect(trainingService.getExercises).not.toHaveBeenCalled();
  });

  it("reporta el conteo de ejercicios cargados via onCountChange", async () => {
    vi.mocked(trainingService.getExercises).mockResolvedValue([buildExercise(), buildExercise({ id: "ex-2" })]);
    const onCountChange = vi.fn();

    render(
      <MemoryRouter initialEntries={["/coach/game-model?clubId=club-1&teamId=team-9"]}>
        <PrincipleExercisesSection
          clubId="club-1" teamId="team-9" levelKind="subPrinciple"
          levelApiId="sp-1" levelName="Subprincipio X" active onCountChange={onCountChange}
        />
      </MemoryRouter>
    );

    await waitFor(() => expect(onCountChange).toHaveBeenCalledWith(2));
  });

  it("el botón Añadir ejercicio navega con subPrincipleId cuando levelKind es subPrinciple", async () => {
    vi.mocked(trainingService.getExercises).mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={["/coach/game-model?clubId=club-1&teamId=team-9"]}>
        <PrincipleExercisesSection
          clubId="club-1" teamId="team-9" levelKind="subPrinciple"
          levelApiId="sp-1" levelName="Subprincipio X" active
        />
      </MemoryRouter>
    );

    await userEvent.click(await screen.findByText("Añadir ejercicio"));

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining("subPrincipleId=sp-1"),
      expect.anything()
    );
  });
});
```

Ejecutar `npm run test -- PrincipleExercisesSection` → debe fallar (el módulo no existe).

### 5.2 Green

Crear `Front/src/apps/coach/pages/game-model/components/PrincipleExercisesSection.tsx` extrayendo el bloque `SubSubPrincipleCard.tsx:192-373` (header + grid + `ExerciseModal`-less cards + delete dialog) con esta interfaz:

```tsx
interface Props {
  clubId: string;
  teamId: string;
  levelKind: "subSubPrinciple" | "subPrinciple";
  levelApiId: string;
  levelName: string;
  active: boolean;
  onCountChange?: (count: number) => void;
}
```

Puntos clave de la implementación:
- `loadExercises` llama a `trainingService.getExercises(clubId, levelKind === "subSubPrinciple" ? { subSubPrincipleId: levelApiId } : { subPrincipleId: levelApiId })`.
- `useEffect` dispara `loadExercises()` cuando `active` pasa a `true` y aún no se ha cargado (mismo patrón que hoy `SubSubPrincipleCard.tsx:76-78`), y cuando ya hay datos, llama a `onCountChange?.(exercises.length)`.
- `buildExerciseParams`/`goToExercisePage`/`duplicateExercise` (hoy `SubSubPrincipleCard.tsx:96-125`) usan la clave `subSubPrincipleId`+`sspName` o `subPrincipleId`+`spName` según `levelKind`.
- Reutiliza `SubSubPrincipleCard.module.css` para las clases (`exGrid`, `exCard`, etc.) importando el mismo módulo, o crea `PrincipleExercisesSection.module.css` copiando las reglas usadas (`exercisesSection`, `exercisesHeader`, `exercisesLabel`, `addExBtn`, `exLoading`, `exEmpty`, `exGrid`, `exCard*`, `exMediaEl`, etc.) — decide por duplicación mínima: si `SubSubPrincipleCard.module.css` no se queda con clases huérfanas tras la extracción, reutilízalo; si sí, mueve solo las clases usadas a un nuevo módulo.

### 5.3 Refactor

En `SubSubPrincipleCard.tsx`:
- Eliminar el bloque inline de ejercicios (`192-373`) y el estado/lógica que ya no usa (`exercises`, `loadingEx`, `exLoaded`, `deleteExId`, `deletingEx`, `loadExercises`, `handleDelete`, `buildExerciseParams`, `navigateToExerciseForm`, `goToExercisePage`, `duplicateExercise` — todo se traslada al nuevo componente).
- Renderizar en su lugar:
  ```tsx
  <PrincipleExercisesSection
    clubId={clubId}
    teamId={teamId}
    levelKind="subSubPrinciple"
    levelApiId={sspApiId}
    levelName={subSubPrinciple.name}
    active={expanded}
    onCountChange={setExCount}
  />
  ```
- Añadir `const [exCount, setExCount] = useState(0);` y cambiar `totalExercises` (línea 80-82) para usar `exCount` en vez de `exLoaded ? exercises.length : subSubPrinciple.essentialSkills.reduce(...)`. Si se necesita un valor inicial antes de expandir, conserva el fallback basado en `essentialSkills` solo cuando `exCount === 0 && !expandedAlguna vez` — o simplifica a `exCount` directamente si el chip solo importa tras expandir (revisa el test existente de `SubSubPrincipleCard.test.tsx` para no romperlo).

### 5.4 Verificar

```
npm run test -- PrincipleExercisesSection SubSubPrincipleCard
npm run build
```

---

## Bloque 6 — Frontend: sección de ejercicios en `SubPrincipleDetailView`

### 6.1 Red

Crear `Front/src/apps/coach/pages/game-model/components/__tests__/ScenarioAccordion.test.tsx` (o ampliar si ya existiera uno) cubriendo que `SubPrincipleDetailView` renderiza `PrincipleExercisesSection` con `levelKind="subPrinciple"` y `levelApiId={sp.apiId}`, y que se muestra un chip con el conteo de ejercicios. Mockea `PrincipleExercisesSection` (`vi.mock("../PrincipleExercisesSection", ...)`) para no re-testear su lógica interna aquí, y verifica las props recibidas.

Ejecutar `npm run test -- ScenarioAccordion` → debe fallar (la sección aún no existe en `SubPrincipleDetailView`).

### 6.2 Green

En `ScenarioAccordion.tsx`, dentro de `SubPrincipleDetailView` (tras el bloque `tacticalPrinciples`, antes o después de `subSubPrinciples`):

```tsx
<PrincipleExercisesSection
  clubId={clubId}
  teamId={teamId}
  levelKind="subPrinciple"
  levelApiId={sp.apiId ?? ""}
  levelName={sp.name}
  active
  onCountChange={setExerciseCount}
/>
```

Añadir `const [exerciseCount, setExerciseCount] = useState(0);` al inicio de `SubPrincipleDetailView` y un `Chip` junto a los botones "Nueva sesión"/"Ver sesiones" en `spDetailHeader` cuando `exerciseCount > 0` (mismo patrón que `SubSubPrincipleCard`'s `exerciseChip`, icono `FitnessCenterIcon` ya importado en este archivo).

Solo renderizar la sección cuando `sp.apiId` existe (igual que `SubSubPrincipleCard` exige `clubId && sspApiId`).

### 6.3 Verificar

```
npm run test -- ScenarioAccordion
npm run build
```

---

## Bloque 7 — Frontend: reasignación en el formulario de ejercicio

### 7.1 Red

Crear `Front/src/apps/coach/pages/trainings/new/hooks/__tests__/useExerciseForm.test.ts`:

```ts
import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useExerciseForm } from "../useExerciseForm";
import gameModelService from "../../../../services/gameModelService";

vi.mock("../../../../services/gameModelService", () => ({
  default: { getSubSubPrincipleSkills: vi.fn().mockResolvedValue([]) },
}));
vi.mock("../../../../services/trainingService", () => ({
  default: {
    getExerciseById: vi.fn(), createExercise: vi.fn(), updateExercise: vi.fn(),
    uploadExerciseMedia: vi.fn(), createCondition: vi.fn(), updateCondition: vi.fn(), deleteCondition: vi.fn(),
  },
}));

const navigate = vi.fn();

describe("useExerciseForm — reasignación de nivel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("setLevel('subPrinciple') limpia subSubPrincipleId y fija subPrincipleId", async () => {
    const { result } = renderHook(() =>
      useExerciseForm({
        clubId: "club-1", subSubPrincipleId: "ssp-1", subPrincipleId: "sp-1",
        navigate, returnTo: "/coach/trainings",
      })
    );

    act(() => result.current.setLevel("subPrinciple"));

    await waitFor(() => {
      expect(result.current.form.subPrincipleId).toBe("sp-1");
      expect(result.current.form.subSubPrincipleId).toBeNull();
    });
  });

  it("setLevel('subSubPrinciple') limpia subPrincipleId y fija subSubPrincipleId", async () => {
    const { result } = renderHook(() =>
      useExerciseForm({
        clubId: "club-1", subSubPrincipleId: "ssp-1", subPrincipleId: "sp-1",
        navigate, returnTo: "/coach/trainings",
      })
    );

    act(() => result.current.setLevel("subPrinciple"));
    act(() => result.current.setLevel("subSubPrinciple"));

    await waitFor(() => {
      expect(result.current.form.subSubPrincipleId).toBe("ssp-1");
      expect(result.current.form.subPrincipleId).toBeNull();
    });
  });
});
```

Ejecutar `npm run test -- useExerciseForm` → debe fallar (falta `subPrincipleId` en los params y `setLevel` en el valor devuelto).

### 7.2 Green

En `useExerciseForm.ts`:
- `UseExerciseFormParams` gana `subPrincipleId: string | null`.
- `form` inicial: `{ ...emptyExercise, clubId, subSubPrincipleId, subPrincipleId }` (y en el `useEffect` de reset, línea 119-122).
- Nuevo `setLevel`:
  ```ts
  const setLevel = (kind: "subSubPrinciple" | "subPrinciple") => {
    setForm((prev) => ({
      ...prev,
      subSubPrincipleId: kind === "subSubPrinciple" ? (subSubPrincipleId ?? prev.subSubPrincipleId ?? null) : null,
      subPrincipleId: kind === "subPrinciple" ? (subPrincipleId ?? prev.subPrincipleId ?? null) : null,
      essentialSkillIds: kind === "subPrinciple" ? [] : prev.essentialSkillIds,
    }));
  };
  ```
- `applyExercise` fija ambos ids desde el ejercicio cargado (`exercise.subSubPrincipleId ?? ...`, `exercise.subPrincipleId ?? ...`).
- Exportar `setLevel` en el objeto devuelto por el hook.

### 7.3 Red (panel)

Crear/ampliar `Front/src/apps/coach/pages/trainings/new/components/__tests__/ExerciseFormPanel.test.tsx` verificando:
- el selector "Vinculado a" solo aparece cuando se pasan props `subSubPrincipleId` y `subPrincipleId` no nulos;
- seleccionar la opción "Subprincipio" invoca `form.setLevel("subPrinciple")`.

Ejecutar `npm run test -- ExerciseFormPanel` → debe fallar.

### 7.4 Green

En `ExerciseFormPanel.tsx`, añadir props `subPrincipleId: string | null` y `subPrincipleName: string | null`; renderizar el `Select` descrito en `design.md` cuando ambos ids de contexto (`subSubPrincipleId` y `subPrincipleId`) están presentes.

En `NewExercisePage.tsx`, leer `subPrincipleId`/`spName` de la URL y pasarlos a `useExerciseForm` y `ExerciseFormPanel`.

En `SubSubPrincipleCard.tsx` (tras el bloque 5), añadir props `subPrincipleApiId?: string | null` y `subPrincipleName?: string | null`, recibidas desde `ScenarioAccordion.tsx:112-114` (`<SubSubPrincipleCard ... subPrincipleApiId={sp.apiId} subPrincipleName={sp.name} />`), y añadirlas como `subPrincipleId`/`spName` en `buildExerciseParams` dentro de `PrincipleExercisesSection` cuando `levelKind === "subSubPrinciple"` (pasa estos dos valores como props opcionales adicionales del componente extraído en el bloque 5).

### 7.5 Verificar

```
npm run test -- useExerciseForm ExerciseFormPanel NewExercisePage SubSubPrincipleCard
npm run build
```

---

## Bloque 8 — Regresión completa + smoke test manual

```
cd Back/ExtractionApi && dotnet build && dotnet test
cd Front && npm run test && npm run build
```

Smoke test manual (`npm run dev` + `dotnet run --project src/RFFM.Host`):
1. Entrar en `game-model`, abrir un Subprincipio sin expandir ninguna habilidad → pulsar "Añadir ejercicio" en la nueva sección de subprincipio, crear un ejercicio, verificar que aparece y el contador se actualiza.
2. Editar un ejercicio existente a nivel de habilidad, cambiar "Vinculado a" a Subprincipio, guardar → verificar que desaparece de la tarjeta de habilidad y aparece en la lista del subprincipio.
3. Repetir en sentido inverso (subprincipio → habilidad).
4. Eliminar un ejercicio desde la vista de subprincipio → confirma diálogo, desaparece de la lista y el contador baja.
