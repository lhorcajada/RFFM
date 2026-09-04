# Implement: add-club-kit-configuration (backend only)

Self-contained technical script for the `openspec-implementer` subagent. Follow it exactly;
all context needed is inline below — you do not need to re-derive conventions from scratch,
but you MUST read every file this script tells you to read before editing it.

Repo root: `C:\Proyects\MisProyectos\FutbolBase`
Backend root: `Back/ExtractionApi` (all commands below assume this as cwd unless stated
otherwise)

## 0. Read first (do not skip)

Read these files in full before writing any code:
1. `Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/UserClubs/ClubKit.cs`
2. `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Kits/GetTeamKits.cs`
3. `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/SportEvents/Commands/DeleteSportEvent.cs`
   (authorization pattern to copy)
4. `Back/ExtractionApi/src/RFFM.Api/Features/Mobile/Teams/Commands/SaveTeamRules.cs`
   (upsert command style to copy)
5. `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/SaveTeamRulesHandlerTests.cs`
   (test style to copy — `PostgresContainerFixture`, seeding a Club/Season/Team)
6. `Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/Configuration/Aggregates/UserClubs/ClubKitEntityConfiguration.cs`
7. `Back/ExtractionApi/src/RFFM.Api/Domain/NotFoundException.cs`
8. `openspec/changes/add-club-kit-configuration/design.md` (full contract — the source of
   truth for exact field names/behavior; if anything below conflicts with design.md,
   design.md wins)

## 1. Domain change

Edit `Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/UserClubs/ClubKit.cs`. Add a public
instance method after the `Create` factory (keep `Create` unchanged):

```csharp
public void UpdateColors(string shirtColor, string shortsColor, string socksColor)
{
    ShirtColor = shirtColor;
    ShortsColor = shortsColor;
    SocksColor = socksColor;
}
```

No new validation inside this method — format validation lives in the command's
FluentValidation validator (step 3); the only real domain invariant on `ClubKit`
(`kitNumber` must be 1 or 2) is unchanged and stays in `Create`.

## 2. Write the failing tests first (TDD — Red)

Create `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/SaveClubKitsHandlerTests.cs`.
Mirror `SaveTeamRulesHandlerTests.cs` exactly in structure: `[Collection(PostgresCollection.Name)]`,
constructor injecting `PostgresContainerFixture`, a private `SeedTeamAsync(AppDbContext db)`
helper that creates a `Club`, a `Season` (via `Season.Create(...)`, `isActive: true`), and a
`Team` (via `new Team(new TeamModelBase { ... })`) exactly like `SaveTeamRulesHandlerTests`
does, returning the team id.

Write these `[Fact]` tests against
`RFFM.Api.Features.Coaches.Kits.SaveClubKits.Handler` (which does not exist yet — that's
expected, this is Red):

1. `Handle_NoExistingKits_CreatesBoth` — call the handler with a command for `teamId`
   containing kit 1 (`shirtColor: "#0000FF"`, `shortsColor: "#0000FF"`) and kit 2
   (`shirtColor: "#FF0000"`, `shortsColor: "#FFFFFF"`). Assert the result has 2 entries,
   `KitNumber` 1 and 2, and `SocksColor` equals `ShortsColor` for each. Re-query the DB with
   a fresh `AppDbContext` (via `_fixture.CreateDbContext()`) and assert 2 `ClubKit` rows
   exist for that club/season.
2. `Handle_ExistingKits_UpdatesInPlaceWithoutDuplicating` — seed via the handler once, then
   call it again with different colors for the same team. Assert the result reflects the new
   colors, and a fresh DB query still finds exactly 2 `ClubKit` rows for that
   club/season (no duplicates — the unique index `(ClubId, SeasonId, KitNumber)` would throw
   otherwise, which is itself a good regression guard).
3. `Handle_SocksColorAlwaysMatchesShortsColor` — assert `SocksColor == ShortsColor` for both
   kits after a save, including on the update path with a different `shortsColor` than the
   original.
4. `Handle_TeamDoesNotExist_ThrowsNotFoundException` — call with a random non-existent
   `teamId`, assert `Assert.ThrowsAsync<NotFoundException>(...)` (same pattern as
   `SaveTeamRulesHandlerTests.Handle_TeamDoesNotExist_ThrowsNotFoundException`).

Also add a validator test class,
`Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/SaveClubKitsValidatorTests.cs` (pure, no
DB, no `PostgresCollection` — instantiate `new SaveClubKits.Validator()` directly and call
`.TestValidate(command)` if the repo already references
`FluentValidation.TestHelper` elsewhere, otherwise call `.Validate(command)` and assert
`.IsValid` / inspect `.Errors` — check how `CreateSportEventValidatorTests.cs` or
`UpdateSportEventValidatorTests.cs` asserts validator results and copy that exact pattern).
Cover:
- Exactly 2 kits with `kitNumber` 1 and 2 → valid.
- 1 kit only → invalid.
- 3 kits → invalid.
- Two kits both `kitNumber: 1` (duplicate, missing 2) → invalid.
- `kitNumber: 3` → invalid.
- `shirtColor: "azul"` (not hex) → invalid.
- `shirtColor: "#12"` (wrong length) → invalid.
- `shirtColor: "#0000FF"`, `shortsColor: "#0000FF"`, valid `kitNumber`s → valid.

Run `dotnet build` from `Back/ExtractionApi` now — it will fail because `SaveClubKits` does
not exist yet. That compile failure IS the Red step for this vertical slice (there is no
runnable-but-failing state possible here since the type doesn't exist). Proceed to step 3
immediately; do not attempt to get a green build before creating the production type.

## 3. Implement the command (Green)

Create `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Kits/SaveClubKits.cs`:

```csharp
using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Kits
{
    public class SaveClubKits : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut("/api/teams/{teamId}/kits",
                    async (string teamId, SaveClubKitsCommand command, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(command with { TeamId = teamId }, cancellationToken);
                        return Results.Ok(result);
                    })
                .WithName(nameof(SaveClubKits))
                .WithTags("Kits")
                .Produces<GetTeamKits.ClubKitResponse[]>(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound)
                .Produces<ProblemDetails>(StatusCodes.Status403Forbidden)
                .RequireAuthorization(new AuthorizeAttribute { Roles = "Administrator,Coach,ClubDirector,ClubMember" });
        }

        // ─── Command ──────────────────────────────────────────────────────────

        public record SaveClubKitsCommand : IRequest<GetTeamKits.ClubKitResponse[]>
        {
            public string TeamId { get; set; } = null!;
            public List<SaveClubKitRequest> Kits { get; set; } = new();
        }

        public record SaveClubKitRequest
        {
            public int KitNumber { get; set; }
            public string ShirtColor { get; set; } = null!;
            public string ShortsColor { get; set; } = null!;
        }

        // ─── Validator ────────────────────────────────────────────────────────

        public class Validator : AbstractValidator<SaveClubKitsCommand>
        {
            private static readonly System.Text.RegularExpressions.Regex HexColor =
                new(@"^#[0-9A-Fa-f]{6}$", System.Text.RegularExpressions.RegexOptions.Compiled);

            public Validator()
            {
                RuleFor(x => x.Kits)
                    .NotEmpty()
                    .Must(kits => kits.Count == 2).WithMessage("Se deben enviar exactamente 2 equipaciones.")
                    .Must(kits => kits.Select(k => k.KitNumber).OrderBy(n => n).SequenceEqual(new[] { 1, 2 }))
                        .WithMessage("Las equipaciones deben tener KitNumber 1 y 2, sin duplicados.");

                RuleForEach(x => x.Kits).ChildRules(kit =>
                {
                    kit.RuleFor(k => k.ShirtColor).NotEmpty().Matches(HexColor).WithMessage("ShirtColor debe tener formato #RRGGBB.");
                    kit.RuleFor(k => k.ShortsColor).NotEmpty().Matches(HexColor).WithMessage("ShortsColor debe tener formato #RRGGBB.");
                });
            }
        }

        // ─── Handler ──────────────────────────────────────────────────────────

        public class Handler(AppDbContext db) : IRequestHandler<SaveClubKitsCommand, GetTeamKits.ClubKitResponse[]>
        {
            public async ValueTask<GetTeamKits.ClubKitResponse[]> Handle(SaveClubKitsCommand request, CancellationToken cancellationToken)
            {
                var team = await db.Teams
                    .FirstOrDefaultAsync(t => t.Id == request.TeamId, cancellationToken);

                if (team == null)
                    throw new NotFoundException("Equipo no encontrado", "TeamNotFound");

                var existingKits = await db.ClubKits
                    .Where(k => k.ClubId == team.ClubId && k.SeasonId == team.SeasonId)
                    .ToListAsync(cancellationToken);

                foreach (var kitRequest in request.Kits)
                {
                    var socksColor = kitRequest.ShortsColor;
                    var existing = existingKits.FirstOrDefault(k => k.KitNumber == kitRequest.KitNumber);

                    if (existing != null)
                    {
                        existing.UpdateColors(kitRequest.ShirtColor, kitRequest.ShortsColor, socksColor);
                    }
                    else
                    {
                        var created = ClubKit.Create(
                            team.ClubId,
                            team.SeasonId,
                            kitRequest.KitNumber,
                            kitRequest.ShirtColor,
                            kitRequest.ShortsColor,
                            socksColor);
                        db.ClubKits.Add(created);
                        existingKits.Add(created);
                    }
                }

                await db.SaveChangesAsync(cancellationToken);

                return existingKits
                    .OrderBy(k => k.KitNumber)
                    .Select(k => new GetTeamKits.ClubKitResponse(k.KitNumber, k.ShirtColor, k.ShortsColor, k.SocksColor))
                    .ToArray();
            }
        }
    }
}
```

Notes for the implementer:
- Add `using System.Linq;` if not implicitly available (check `ImplicitUsings` — project has
  it enabled, `System.Linq` should already be global; verify by building, add explicitly only
  if the build complains).
- `GetTeamKits.ClubKitResponse` is `public record` already — confirm it's accessible from
  this new file (same namespace `RFFM.Api.Features.Coaches.Kits`, should just work).
- Do NOT add `ICacheRequest`/`IInvalidateCacheRequest` to this command — `design.md` section
  "Caché" explains why: `GetTeamKits` is not cached today, so there is nothing to invalidate.
- Confirm `NotFoundException` constructor signature matches usage (`(string message, string
  code)` — verify against `Domain/NotFoundException.cs` and `SaveTeamRules.cs`'s exact call
  before compiling; adjust the two-arg call above if the real signature differs).

## 4. Build and run tests (confirm Green)

From `Back/ExtractionApi`:
```
dotnet build
```
Fix any compile errors (namespace/using issues, `NotFoundException` signature mismatch,
etc.) — do not change the design, only fix mechanical issues.

Then:
```
dotnet test --filter "FullyQualifiedName~SaveClubKits"
```
This requires a Docker/Podman daemon reachable for `Testcontainers.PostgreSql` (used by
`PostgresContainerFixture`). If the daemon is unavailable in this environment (check with
`docker ps`; if it errors with a connection failure, the daemon is not reachable), do NOT
silently skip — report explicitly in your final summary: "integration tests
(`SaveClubKitsHandlerTests`) could not run: no Docker/Podman daemon reachable in this
environment" and note whether the pure `SaveClubKitsValidatorTests` (no container needed)
still ran and passed.

Then run the full suite for a regression check:
```
dotnet test
```
Compare failures against the known pre-existing baseline failures unrelated to this change
(`AdnLegibleImporterFullDocumentSpotCheckTests`, `GameModelSeederRealDocumentTests`) — the
count of failing tests should not increase beyond that baseline (plus, if Docker is
unavailable, every container-based test in the suite will fail identically for unrelated
reasons — note that explicitly rather than treating it as a regression you caused).

## 5. Do not commit, push, or archive

Leave the change in `openspec/changes/add-club-kit-configuration/` (not archived). Do not
run any `git commit`/`git push`. Report back:
- Files created/modified (full paths).
- Whether `dotnet build` is green.
- Whether `dotnet test` (filtered and full) is green, and the exact reason if any test
  could not run (e.g. missing Docker daemon).
- The exact final request/response JSON contract actually implemented (should match
  `design.md` section "Forma del contrato" — flag any deviation explicitly if one was
  unavoidable).
