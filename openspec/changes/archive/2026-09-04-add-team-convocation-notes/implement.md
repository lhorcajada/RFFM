# Implement: add-team-convocation-notes (backend only)

Self-contained technical script. Follow it exactly; read every file listed in section 0
before editing anything.

Repo root: `C:\Proyects\MisProyectos\FutbolBase`
Backend root: `Back/ExtractionApi` (all commands below assume this as cwd unless stated
otherwise)

## 0. Read first (do not skip)

1. `Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/UserClubs/ClubKit.cs` (entity shape to
   mirror: `BaseEntity`, private ctor, static `Create`, one mutation method)
2. `Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/UserClubs/TeamRule.cs` (explicit `Order`
   int column pattern)
3. `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Kits/GetTeamKits.cs` and `SaveClubKits.cs`
   (Mediator `IFeatureModule` slice style to copy exactly — one file per endpoint)
4. `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Convocations/GetEventConvocations.cs`
   (read-authorization pattern to copy verbatim: `IRequireFeaturePermission` with
   `FeatureRoute => CoachFeatureRoutes.Convocations`, `RequiredPermission => "Read"`, plus
   `IRequireTeamMembership`)
5. `Back/ExtractionApi/src/RFFM.Api/Common/IRequireFeaturePermission.cs`,
   `Back/ExtractionApi/src/RFFM.Api/Common/IRequireTeamMembership.cs`,
   `Back/ExtractionApi/src/RFFM.Api/Domain/Entities/CoachFeatureRoutes.cs`
6. `Back/ExtractionApi/src/RFFM.Api/Domain/NotFoundException.cs`
7. `Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/Configuration/Aggregates/UserClubs/ClubKitEntityConfiguration.cs`
8. `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/SaveClubKitsHandlerTests.cs` and
   `DeleteTeamRulesHandlerTests.cs` (Postgres-backed handler test style: `[Collection(PostgresCollection.Name)]`,
   `PostgresContainerFixture`, `SeedTeamAsync` helper building Club → Season → Team)
9. `Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/SanctionEndpointAuthorizationTests.cs`
   (role-authorization integration test style: `TestAuthHandler`, `X-Test-Role` header, real
   Postgres `TestServer`)
10. `openspec/changes/add-team-convocation-notes/design.md` (full contract — source of truth;
    if anything below conflicts with it, design.md wins)

## 1. Domain

Create `Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/UserClubs/TeamNote.cs`:

```csharp
namespace RFFM.Api.Domain.Aggregates.UserClubs
{
    public class TeamNote : BaseEntity
    {
        public string TeamId { get; private set; } = null!;
        public string Text { get; private set; } = null!;
        public int Order { get; private set; }

        public Team Team { get; private set; } = null!;

        private TeamNote() { }

        public static TeamNote Create(string teamId, string text, int order)
        {
            if (string.IsNullOrWhiteSpace(teamId))
                throw new ArgumentException("TeamId cannot be empty.", nameof(teamId));
            if (string.IsNullOrWhiteSpace(text))
                throw new ArgumentException("Text cannot be empty.", nameof(text));

            return new TeamNote { TeamId = teamId, Text = text.Trim(), Order = order };
        }

        public void UpdateText(string text)
        {
            if (string.IsNullOrWhiteSpace(text))
                throw new ArgumentException("Text cannot be empty.", nameof(text));
            Text = text.Trim();
        }
    }
}
```

Write `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/TeamNoteTests.cs` first (Red), covering:
`Create` with empty/whitespace `teamId` throws `ArgumentException`; `Create` with empty/
whitespace `text` throws; `Create` trims surrounding whitespace from `text`; `UpdateText` with
empty text throws and leaves `Text` unchanged; `UpdateText` trims. Then confirm green.

## 2. Infrastructure

1. Create `Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/Configuration/Aggregates/UserClubs/TeamNoteEntityConfiguration.cs`,
   mirroring `ClubKitEntityConfiguration.cs`:

```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.UserClubs;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.UserClubs
{
    internal class TeamNoteEntityConfiguration : IEntityTypeConfiguration<TeamNote>
    {
        public void Configure(EntityTypeBuilder<TeamNote> builder)
        {
            builder.ToTable("TeamNotes");
            builder.HasKey(n => n.Id);

            builder.Property(n => n.TeamId).IsRequired();
            builder.Property(n => n.Text).IsRequired().HasMaxLength(500);
            builder.Property(n => n.Order).IsRequired();

            builder.HasIndex(n => new { n.TeamId, n.Order });

            builder.HasOne(n => n.Team)
                .WithMany()
                .HasForeignKey(n => n.TeamId);
        }
    }
}
```

2. In `Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/AppDbContext.cs`, add near
   the other `Team*` DbSets: `public DbSet<TeamNote> TeamNotes { get; set; }`.
3. From `Back/ExtractionApi`, generate the migration:
   ```
   .\manage-migrations.ps1 -Action create -MigrationName AddTeamNotes -Context AppDbContext
   ```
   Inspect the generated migration under `Infrastructure/Migrations/` — it must create a
   `TeamNotes` table in the `app` schema with columns `Id`, `TeamId`, `Text`, `Order`, and a
   FK to `Teams`. If `dotnet ef` is not available in this environment, note that explicitly in
   the final report rather than silently skipping.

## 3. GET (list + lazy seed) — TDD

Write `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/GetTeamNotesHandlerTests.cs` first
(Red — mirror `SaveClubKitsHandlerTests`'s `SeedTeamAsync` helper exactly):
- `Handle_TeamWithNoNotes_SeedsTwoDefaultNotesAndReturnsThem`: assert 2 results, `Order` 1 and
  2, text matches the two default strings (see step below), and a fresh `AppDbContext` query
  confirms 2 `TeamNote` rows persisted for that team.
- `Handle_TeamWithExistingNotes_ReturnsThemWithoutReseeding`: seed one custom note directly via
  `TeamNote.Create` + `db.SaveChangesAsync()`, call the handler, assert exactly 1 result (not
  3) — this is the regression guard against double-seeding.
- `Handle_TeamDoesNotExist_ThrowsNotFoundException`.

Then implement `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Notes/GetTeamNotes.cs`:

```csharp
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Notes
{
    public class GetTeamNotes : IFeatureModule
    {
        public const string DefaultNoteText1 =
            "Traed las dos equipaciones (por si acaso) y las espinilleras — son obligatorias.";
        public const string DefaultNoteText2 =
            "Sin la equipación necesaria o sin espinilleras, el jugador no podrá jugar el partido.";

        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/teams/{teamId}/notes",
                    async (string teamId, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(new GetTeamNotesQuery { TeamId = teamId }, cancellationToken);
                        return Results.Ok(result);
                    })
                .WithName(nameof(GetTeamNotes))
                .WithTags("TeamNotes")
                .Produces<TeamNoteResponse[]>();
        }

        public record GetTeamNotesQuery : IQueryApp<TeamNoteResponse[]>, IRequireFeaturePermission, IRequireTeamMembership
        {
            public string TeamId { get; set; } = null!;

            public string FeatureRoute => CoachFeatureRoutes.Convocations;
            public string RequiredPermission => "Read";
        }

        public record TeamNoteResponse(string Id, string TeamId, string Text, int Order);

        public class Handler(AppDbContext db) : IRequestHandler<GetTeamNotesQuery, TeamNoteResponse[]>
        {
            public async ValueTask<TeamNoteResponse[]> Handle(GetTeamNotesQuery request, CancellationToken cancellationToken)
            {
                var team = await db.Teams.AsNoTracking().FirstOrDefaultAsync(t => t.Id == request.TeamId, cancellationToken);
                if (team == null)
                    throw new NotFoundException("Equipo no encontrado", "TeamNotFound");

                var notes = await db.TeamNotes
                    .Where(n => n.TeamId == request.TeamId)
                    .OrderBy(n => n.Order)
                    .ToListAsync(cancellationToken);

                if (notes.Count == 0)
                {
                    notes = new List<TeamNote>
                    {
                        TeamNote.Create(request.TeamId, DefaultNoteText1, 1),
                        TeamNote.Create(request.TeamId, DefaultNoteText2, 2),
                    };
                    db.TeamNotes.AddRange(notes);
                    await db.SaveChangesAsync(cancellationToken);
                }

                return notes
                    .OrderBy(n => n.Order)
                    .Select(n => new TeamNoteResponse(n.Id, n.TeamId, n.Text, n.Order))
                    .ToArray();
            }
        }
    }
}
```

Note: `IQueryApp<T>` queries go through `CachingBehavior` only if they also implement
`ICacheRequest` — this one deliberately does not (fresh-seed correctness matters more than a
1h cache here; do not add `ICacheRequest`).

## 4. POST (create) — TDD

Tests first: `CreateTeamNoteValidatorTests.cs` (empty text invalid, text over 500 chars
invalid, valid text valid) and `CreateTeamNoteHandlerTests.cs` (creates with next `Order` —
seed a team with an existing note at `Order = 1`, create a second, assert `Order == 2`;
unknown team throws `NotFoundException`).

Implement `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Notes/CreateTeamNote.cs`, same
shape as `SaveClubKits.cs` but `MapPost`, `[Authorize(Roles = "Coach")]` via
`.RequireAuthorization(new AuthorizeAttribute { Roles = "Coach" })`, `Results.Created($"/api/teams/{teamId}/notes/{note.Id}", response)`.
Handler: load team (404 if missing), compute `nextOrder = (existing notes for team).Select(n => n.Order).DefaultIfEmpty(0).Max() + 1`,
`TeamNote.Create(teamId, request.Text, nextOrder)`, add, save, return
`GetTeamNotes.TeamNoteResponse`. Validator: `RuleFor(x => x.Text).NotEmpty().MaximumLength(500)`.

## 5. PUT (update) — TDD

Tests first: `UpdateTeamNoteValidatorTests.cs` (same text rules) and
`UpdateTeamNoteHandlerTests.cs` (updates text in place, `Order` unchanged; unknown team throws
`NotFoundException`; unknown `noteId` under an existing team throws `NotFoundException` with a
distinct code, e.g. `TeamNoteNotFound`).

Implement `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Notes/UpdateTeamNote.cs`,
`MapPut("/api/teams/{teamId}/notes/{noteId}", ...)`, same `Roles = "Coach"` authorization.
Handler: find note by `Id == noteId && TeamId == teamId` (throw `NotFoundException` with code
`TeamNoteNotFound` if missing — check team exists first with `TeamNotFound` if the team itself
is unknown, matching `SaveClubKits`'s team-then-child lookup order), `note.UpdateText(request.Text)`,
save, return response.

## 6. DELETE — TDD

Tests first: `DeleteTeamNoteHandlerTests.cs` (deletes existing note; unknown team/note throws
`NotFoundException`; deleting one note of several leaves the others' `Order` untouched — seed
3 notes, delete the middle one, assert the remaining two keep their original `Order` values).

Implement `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Notes/DeleteTeamNote.cs`,
`MapDelete("/api/teams/{teamId}/notes/{noteId}", ...)`, `Roles = "Coach"`, `Results.NoContent()`.
Handler mirrors `DeleteTeamRules.cs`'s team-then-child lookup and `NotFoundException` usage.

## 7. Authorization integration tests

Add `Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/TeamNotesEndpointAuthorizationTests.cs`,
copying `SanctionEndpointAuthorizationTests.cs`'s `TestAuthHandler`/`StartHostAsync` bootstrap
verbatim (same Postgres `TestServer`, same `X-Test-Role` header mechanism). Cover:
- `POST`/`PUT`/`DELETE` with a non-`Coach` role (e.g. `Player`, `ClubDirector`) → `403`.
- `POST`/`PUT`/`DELETE` with `Coach` role → success status.
- `GET` is harder to test with the raw `TestServer` bootstrap because
  `IRequireFeaturePermission`/`IRequireTeamMembership` go through Mediator pipeline behaviors,
  not `[Authorize]` — if wiring the full Mediator pipeline into this lightweight test host is
  not straightforward, it is acceptable to cover `GET` authorization only via the existing
  `FeaturePermissionBehaviorTests.cs`/`TeamMembershipBehaviorTests.cs` unit-level coverage
  (already exercises the same behaviors `GetEventConvocations` uses) plus the handler tests
  from step 3 — note this explicitly in the final report rather than forcing a fragile
  integration test.

## 8. Build and test

From `Back/ExtractionApi`:
```
dotnet build
dotnet test --filter "FullyQualifiedName~TeamNote"
dotnet test
```
Report the full-suite pass count and compare against the known pre-existing baseline (same
caveat as `add-club-kit-configuration/implement.md` regarding
`AdnLegibleImporterFullDocumentSpotCheckTests`/`GameModelSeederRealDocumentTests` and Docker
availability for `PostgresContainerFixture`-based tests).

## 9. Do not commit, push, or archive

Leave the change in `openspec/changes/add-team-convocation-notes/` (not archived). Do not run
`git commit`/`git push`. Report: files created/modified (full paths), build/test status, and
the final exact request/response JSON contract for all 4 endpoints (should match `design.md`
— flag any unavoidable deviation).
