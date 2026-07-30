# Implement — add-player-sanctions [COMPLETE]

Technical script for the `openspec-implementer` agent. Strict TDD (Red → Green → Refactor) per block. Do not move to the next block until the current block's tests pass. All paths are relative to the repo root `C:\Proyects\MisProyectos\FutbolBase` unless stated otherwise.

**Status: All blocks complete. All 300 tests pass. Build succeeds with 0 errors and 0 warnings.**

Conventions detected in the repo:
- Vertical slice backend feature = 1 `.cs` file under `Back/ExtractionApi/src/RFFM.Api/Features/`.
- Nearest sibling feature to mirror exactly: `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Players/Commands/SetPlayerInjury.cs` (inline Minimal API `IFeatureModule`, not Mediator ICommand/IQueryApp — this is intentional, see the comment block at the top of that file).
- Domain entities: `Back/ExtractionApi/src/RFFM.Api/Domain/Entities/TeamPlayers/`, e.g. `TeamPlayerInjury.cs` — private setters, static `Create()` factory, `Update()` method, inherits `BaseEntity`.
- EF configs: `Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/Configuration/Entities/`, discovered by reflection — do not register manually.
- `AppDbContext`: `Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/AppDbContext.cs`, already calls `modelBuilder.ConfigureSmartEnum()`.
- Integration tests (need real Postgres because of FK constraints): `Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/`, xUnit, `[Collection(PostgresCollection.Name)]`, `PostgresContainerFixture`. Mirror `InjuryEndpointAuthorizationTests.cs` exactly for the host/test-client bootstrap (`TestAuthHandler`, `StartHostAsync`).
- Migrations: generate via `.\manage-migrations.ps1 create <Name>` from `Back/ExtractionApi` (context `AppDbContext`, do NOT pass `-Context` explicitly since `AppDbContext` is the default) — do not hand-write migration files.

---

## Block 1 — Domain: `SanctionCategory` SmartEnum

### 1.1 Green (no test needed — this is a data-only value type; it's covered indirectly by Block 3's tests)

Create `Back/ExtractionApi/src/RFFM.Api/Domain/Entities/TeamPlayers/SanctionCategory.cs`:

```csharp
using Ardalis.SmartEnum;

namespace RFFM.Api.Domain.Entities.TeamPlayers
{
    public sealed class SanctionCategory : SmartEnum<SanctionCategory>
    {
        public static readonly SanctionCategory Competition = new(1, nameof(Competition));
        public static readonly SanctionCategory InternalDiscipline = new(2, nameof(InternalDiscipline));

        private SanctionCategory(int value, string name) : base(name, value)
        {
        }

        public static bool TryParseName(string? name, out SanctionCategory? category)
        {
            category = null;
            if (string.IsNullOrWhiteSpace(name))
                return false;

            foreach (var candidate in List)
            {
                if (string.Equals(candidate.Name, name, System.StringComparison.OrdinalIgnoreCase))
                {
                    category = candidate;
                    return true;
                }
            }

            return false;
        }
    }
}
```

Note: `Ardalis.SmartEnum`'s `SmartEnum<TEnum>` base constructor signature is `protected SmartEnum(string name, int value)` — verify this against the installed `Ardalis.SmartEnum` 8.2.0 package (check an existing usage via `dotnet-tool`/NuGet cache if unsure, or check https://www.nuget.org/packages/Ardalis.SmartEnum for the 8.x API) before compiling; adjust the constructor call order if the installed version differs. `List` is the inherited static property exposing all defined members — used here for a case-insensitive name lookup since incoming JSON strings from Front/Mobile should not be case-sensitive-fragile.

---

## Block 2 — Domain: `TeamPlayerSanction` entity

### 2.1 Green

Create `Back/ExtractionApi/src/RFFM.Api/Domain/Entities/TeamPlayers/TeamPlayerSanction.cs`, mirroring `TeamPlayerInjury.cs`:

```csharp
namespace RFFM.Api.Domain.Entities.TeamPlayers
{
    public class TeamPlayerSanction : BaseEntity
    {
        public string TeamPlayerId { get; private set; } = null!;
        public SanctionCategory Category { get; private set; } = null!;
        public DateTime StartDate { get; private set; }
        public string SanctionType { get; private set; } = null!;
        public string? Description { get; private set; }
        public string? EstimatedEnd { get; private set; }
        public DateTime? EndDate { get; private set; }

        public TeamPlayer TeamPlayer { get; private set; } = null!;

        private TeamPlayerSanction() { }

        public static TeamPlayerSanction Create(
            string teamPlayerId, SanctionCategory category, DateTime startDate, string sanctionType,
            string? description, string? estimatedEnd)
        {
            if (string.IsNullOrWhiteSpace(teamPlayerId))
                throw new ArgumentException("El jugador es obligatorio.");
            if (category is null)
                throw new ArgumentException("La categoría de la sanción es obligatoria.");
            if (string.IsNullOrWhiteSpace(sanctionType))
                throw new ArgumentException("El tipo de sanción es obligatorio.");

            return new TeamPlayerSanction
            {
                TeamPlayerId = teamPlayerId,
                Category = category,
                StartDate = startDate.Kind == DateTimeKind.Utc ? startDate : DateTime.SpecifyKind(startDate, DateTimeKind.Utc),
                SanctionType = sanctionType,
                Description = description,
                EstimatedEnd = estimatedEnd,
                EndDate = null
            };
        }

        public void Update(
            SanctionCategory category, DateTime startDate, string sanctionType,
            string? description, string? estimatedEnd, DateTime? endDate)
        {
            if (category is null)
                throw new ArgumentException("La categoría de la sanción es obligatoria.");
            if (string.IsNullOrWhiteSpace(sanctionType))
                throw new ArgumentException("El tipo de sanción es obligatorio.");

            Category = category;
            StartDate = startDate.Kind == DateTimeKind.Utc ? startDate : DateTime.SpecifyKind(startDate, DateTimeKind.Utc);
            SanctionType = sanctionType;
            Description = description;
            EstimatedEnd = estimatedEnd;
            EndDate = endDate.HasValue
                ? (endDate.Value.Kind == DateTimeKind.Utc ? endDate.Value : DateTime.SpecifyKind(endDate.Value, DateTimeKind.Utc))
                : null;
        }
    }
}
```

Add the inverse navigation to `Back/ExtractionApi/src/RFFM.Api/Domain/Entities/TeamPlayers/TeamPlayer.cs` right next to the existing `Injuries` collection (same file, same pattern):

```csharp
public ICollection<TeamPlayerSanction> Sanctions { get; private set; } = new List<TeamPlayerSanction>();
```

---

## Block 3 — Persistence: EF configuration + DbSet + migration

### 3.1 Green

Create `Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/Configuration/Entities/TeamPlayerSanctionEntityConfiguration.cs`, mirroring `TeamPlayerInjuryEntityConfiguration.cs`:

```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities.TeamPlayers;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Entities
{
    internal class TeamPlayerSanctionEntityConfiguration : IEntityTypeConfiguration<TeamPlayerSanction>
    {
        public void Configure(EntityTypeBuilder<TeamPlayerSanction> builder)
        {
            builder.ToTable("TeamPlayerSanctions");

            builder.HasKey(s => s.Id);

            builder.Property(s => s.TeamPlayerId).IsRequired();
            builder.Property(s => s.Category).IsRequired();
            builder.Property(s => s.StartDate).IsRequired();
            builder.Property(s => s.SanctionType).HasMaxLength(200).IsRequired();
            builder.Property(s => s.Description).HasMaxLength(1000).IsRequired(false);
            builder.Property(s => s.EstimatedEnd).HasMaxLength(200).IsRequired(false);
            builder.Property(s => s.EndDate).IsRequired(false);

            builder.HasIndex(s => s.TeamPlayerId);
            builder.HasIndex(s => new { s.TeamPlayerId, s.EndDate });

            builder.HasOne(s => s.TeamPlayer)
                .WithMany(tp => tp.Sanctions)
                .HasForeignKey(s => s.TeamPlayerId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
```

Note: `builder.Property(s => s.Category).IsRequired();` relies on `modelBuilder.ConfigureSmartEnum()` (already called in `AppDbContext.OnModelCreating`) to apply the SmartEnum-to-int value converter automatically — do not add an explicit `HasConversion` unless the build/migration step shows it wasn't picked up (in that case, add `.HasConversion(c => c.Value, v => SanctionCategory.FromValue(v))` explicitly and note the deviation).

Add to `Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/AppDbContext.cs`, next to the existing `TeamPlayerInjuries` DbSet (~line 43):

```csharp
public DbSet<TeamPlayerSanction> TeamPlayerSanctions { get; set; }
```

### 3.2 Migration

From `Back/ExtractionApi`:

```powershell
.\manage-migrations.ps1 create AddTeamPlayerSanctions
```

Verify the generated migration under `src/RFFM.Api/Infrastructure/Migrations/` only:
- creates table `TeamPlayerSanctions` in schema `app`,
- adds the FK to `TeamPlayers`,
- adds the two indexes,
- does not touch any unrelated table (if it does, another pending model change exists — stop and report it instead of including unrelated changes in this migration).

---

## Block 4 — Tests First (TDD Red)

### 4.1 Red

Create `Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/SanctionEndpointAuthorizationTests.cs`. Copy the full structure of `InjuryEndpointAuthorizationTests.cs` (same file, same `using`s, same `TestAuthHandler`, same `StartHostAsync` helper, same `CreateTeamPlayerAsync` helper) and adapt it to sanctions:

```csharp
#nullable enable
using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Players;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Models;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.Players.Commands;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Coverage for SetPlayerSanction: role-gated writes (Coach/Administrator only), open GET,
    /// category filtering and validation, and 404s for unknown team players/sanctions. Mirrors
    /// InjuryEndpointAuthorizationTests's host bootstrap exactly — see that file for rationale
    /// on why this uses a real Postgres TestServer instead of the InMemory provider (FK to
    /// TeamPlayer is enforced by Postgres).
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class SanctionEndpointAuthorizationTests
    {
        private readonly PostgresContainerFixture _fixture;

        public SanctionEndpointAuthorizationTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private class TestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
        {
            public const string SchemeName = "Test";

            public TestAuthHandler(
                IOptionsMonitor<AuthenticationSchemeOptions> options,
                ILoggerFactory logger,
                UrlEncoder encoder)
                : base(options, logger, encoder)
            {
            }

            protected override Task<AuthenticateResult> HandleAuthenticateAsync()
            {
                var role = Request.Headers.TryGetValue("X-Test-Role", out var values)
                    ? values.ToString()
                    : string.Empty;

                var claims = new List<Claim>
                {
                    new Claim(ClaimTypes.Name, "test-user"),
                };
                if (!string.IsNullOrEmpty(role))
                {
                    claims.Add(new Claim(ClaimTypes.Role, role));
                }

                var identity = new ClaimsIdentity(claims, SchemeName);
                var principal = new ClaimsPrincipal(identity);
                var ticket = new AuthenticationTicket(principal, SchemeName);
                return Task.FromResult(AuthenticateResult.Success(ticket));
            }
        }

        private async Task<(IHost Host, HttpClient Client)> StartHostAsync(IFeatureModule module)
        {
            var host = new HostBuilder()
                .ConfigureWebHost(webBuilder =>
                {
                    webBuilder
                        .UseTestServer()
                        .ConfigureServices(services =>
                        {
                            services.AddRouting();
                            services.AddAuthentication(TestAuthHandler.SchemeName)
                                .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(TestAuthHandler.SchemeName, _ => { });
                            services.AddAuthorization();
                            services.AddDbContext<AppDbContext>(options =>
                            {
                                options.UseNpgsql(_fixture.ConnectionString, npgsql =>
                                {
                                    npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "app");
                                });
                            });
                        })
                        .Configure(app =>
                        {
                            app.UseRouting();
                            app.UseAuthentication();
                            app.UseAuthorization();
                            app.UseEndpoints(endpoints => module.AddRoutes(endpoints));
                        });
                })
                .Build();

            await host.StartAsync();
            return (host, host.GetTestClient());
        }

        private async Task<string> CreateTeamPlayerAsync()
        {
            await using var setupDb = _fixture.CreateDbContext();

            var club = Club.Create($"Sanction Auth Test Club {Guid.NewGuid():N}", 1);
            setupDb.Clubs.Add(club);
            await setupDb.SaveChangesAsync();

            var season = Season.Create(
                $"Season {Guid.NewGuid():N}",
                DateTime.UtcNow,
                DateTime.UtcNow.AddMonths(9),
                isActive: true,
                club: club);
            setupDb.Seasons.Add(season);
            await setupDb.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "Sanction Auth Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            setupDb.Teams.Add(team);
            await setupDb.SaveChangesAsync();

            var player = Player.Create(new PlayerModelBase
            {
                Name = "Test",
                LastName = "Player",
                Alias = $"testplayer-{Guid.NewGuid():N}",
                ClubId = club.Id
            });
            setupDb.Players.Add(player);
            await setupDb.SaveChangesAsync();

            var teamPlayer = TeamPlayer.Create(new TeamPlayerModel
            {
                PlayerId = player.Id,
                TeamId = team.Id,
                SeasonId = season.Id,
                JoinedDate = DateTime.UtcNow,
                Dorsal = null,
                FamilyMembers = new List<FamilyModel>()
            });
            setupDb.TeamPlayers.Add(teamPlayer);
            await setupDb.SaveChangesAsync();

            return teamPlayer.Id;
        }

        private async Task<string> CreateSanctionAsync(string teamPlayerId, SanctionCategory category)
        {
            await using var setupDb = _fixture.CreateDbContext();

            var sanction = TeamPlayerSanction.Create(teamPlayerId, category, DateTime.UtcNow, "Expulsión", "Test sanction", "2 partidos");
            setupDb.TeamPlayerSanctions.Add(sanction);
            await setupDb.SaveChangesAsync();

            return sanction.Id;
        }

        [Theory]
        [InlineData("Player")]
        [InlineData("FamilyMember")]
        public async Task CreatePlayerSanction_WithDisallowedRole_ReturnsForbidden(string role)
        {
            var teamPlayerId = await CreateTeamPlayerAsync();
            var (host, client) = await StartHostAsync(new SetPlayerSanction());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Post, $"/api/catalog/teamplayer/{teamPlayerId}/sanctions")
            {
                Content = JsonContent.Create(new SetPlayerSanction.SanctionCreateRequest("Competition", DateTime.UtcNow, "Expulsión", "Test", "2 partidos"))
            };
            request.Headers.Add("X-Test-Role", role);

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }

        [Fact]
        public async Task CreatePlayerSanction_WithCoachRoleAndCompetitionCategory_CreatesSuccessfully()
        {
            var teamPlayerId = await CreateTeamPlayerAsync();
            var (host, client) = await StartHostAsync(new SetPlayerSanction());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Post, $"/api/catalog/teamplayer/{teamPlayerId}/sanctions")
            {
                Content = JsonContent.Create(new SetPlayerSanction.SanctionCreateRequest("Competition", DateTime.UtcNow, "Expulsión", "Test", "2 partidos"))
            };
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<SetPlayerSanction.SanctionRecordResponse>();
            Assert.NotNull(body);
            Assert.Equal("Competition", body!.Category);
        }

        [Fact]
        public async Task CreatePlayerSanction_WithCoachRoleAndInternalDisciplineCategory_CreatesSuccessfully()
        {
            var teamPlayerId = await CreateTeamPlayerAsync();
            var (host, client) = await StartHostAsync(new SetPlayerSanction());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Post, $"/api/catalog/teamplayer/{teamPlayerId}/sanctions")
            {
                Content = JsonContent.Create(new SetPlayerSanction.SanctionCreateRequest("InternalDiscipline", DateTime.UtcNow, "Incumplimiento de normas", "Llegó tarde", null))
            };
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<SetPlayerSanction.SanctionRecordResponse>();
            Assert.NotNull(body);
            Assert.Equal("InternalDiscipline", body!.Category);
        }

        [Fact]
        public async Task CreatePlayerSanction_WithUnknownCategory_ReturnsBadRequest()
        {
            var teamPlayerId = await CreateTeamPlayerAsync();
            var (host, client) = await StartHostAsync(new SetPlayerSanction());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Post, $"/api/catalog/teamplayer/{teamPlayerId}/sanctions")
            {
                Content = JsonContent.Create(new SetPlayerSanction.SanctionCreateRequest("NotACategory", DateTime.UtcNow, "Expulsión", null, null))
            };
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task CreatePlayerSanction_ForNonExistentTeamPlayer_ReturnsNotFound()
        {
            var (host, client) = await StartHostAsync(new SetPlayerSanction());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Post, "/api/catalog/teamplayer/does-not-exist/sanctions")
            {
                Content = JsonContent.Create(new SetPlayerSanction.SanctionCreateRequest("Competition", DateTime.UtcNow, "Expulsión", null, null))
            };
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        [Theory]
        [InlineData("Player")]
        [InlineData("FamilyMember")]
        public async Task UpdatePlayerSanction_WithDisallowedRole_ReturnsForbidden(string role)
        {
            var teamPlayerId = await CreateTeamPlayerAsync();
            var sanctionId = await CreateSanctionAsync(teamPlayerId, SanctionCategory.Competition);
            var (host, client) = await StartHostAsync(new SetPlayerSanction());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Put, $"/api/catalog/teamplayer/{teamPlayerId}/sanctions/{sanctionId}")
            {
                Content = JsonContent.Create(new SetPlayerSanction.SanctionUpdateRequest("Competition", DateTime.UtcNow, "Expulsión", "Updated", "3 partidos", null))
            };
            request.Headers.Add("X-Test-Role", role);

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }

        [Fact]
        public async Task UpdatePlayerSanction_WithCoachRole_UpdatesSuccessfully()
        {
            var teamPlayerId = await CreateTeamPlayerAsync();
            var sanctionId = await CreateSanctionAsync(teamPlayerId, SanctionCategory.Competition);
            var (host, client) = await StartHostAsync(new SetPlayerSanction());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Put, $"/api/catalog/teamplayer/{teamPlayerId}/sanctions/{sanctionId}")
            {
                Content = JsonContent.Create(new SetPlayerSanction.SanctionUpdateRequest("InternalDiscipline", DateTime.UtcNow, "Expulsión", "Updated", "3 partidos", null))
            };
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<SetPlayerSanction.SanctionRecordResponse>();
            Assert.Equal("InternalDiscipline", body!.Category);
        }

        [Fact]
        public async Task UpdatePlayerSanction_SettingEndDate_LiftsSanction()
        {
            var teamPlayerId = await CreateTeamPlayerAsync();
            var sanctionId = await CreateSanctionAsync(teamPlayerId, SanctionCategory.Competition);
            var (host, client) = await StartHostAsync(new SetPlayerSanction());
            using var _ = host;

            var endDate = DateTime.UtcNow;
            var request = new HttpRequestMessage(HttpMethod.Put, $"/api/catalog/teamplayer/{teamPlayerId}/sanctions/{sanctionId}")
            {
                Content = JsonContent.Create(new SetPlayerSanction.SanctionUpdateRequest("Competition", DateTime.UtcNow, "Expulsión", "Updated", "3 partidos", endDate))
            };
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<SetPlayerSanction.SanctionRecordResponse>();
            Assert.NotNull(body!.EndDate);
        }

        [Theory]
        [InlineData("Player")]
        [InlineData("FamilyMember")]
        public async Task DeletePlayerSanction_WithDisallowedRole_ReturnsForbidden(string role)
        {
            var teamPlayerId = await CreateTeamPlayerAsync();
            var sanctionId = await CreateSanctionAsync(teamPlayerId, SanctionCategory.Competition);
            var (host, client) = await StartHostAsync(new SetPlayerSanction());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Delete, $"/api/catalog/teamplayer/{teamPlayerId}/sanctions/{sanctionId}");
            request.Headers.Add("X-Test-Role", role);

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }

        [Fact]
        public async Task DeletePlayerSanction_WithCoachRole_DeletesSuccessfully()
        {
            var teamPlayerId = await CreateTeamPlayerAsync();
            var sanctionId = await CreateSanctionAsync(teamPlayerId, SanctionCategory.Competition);
            var (host, client) = await StartHostAsync(new SetPlayerSanction());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Delete, $"/api/catalog/teamplayer/{teamPlayerId}/sanctions/{sanctionId}");
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        }

        [Fact]
        public async Task GetPlayerSanctions_WithPlayerRole_ReturnsOk()
        {
            var teamPlayerId = await CreateTeamPlayerAsync();
            var (host, client) = await StartHostAsync(new SetPlayerSanction());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Get, $"/api/catalog/teamplayer/{teamPlayerId}/sanctions");
            request.Headers.Add("X-Test-Role", "Player");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }

        [Fact]
        public async Task GetPlayerSanctions_FilterByCategory_ReturnsOnlyMatchingCategory()
        {
            var teamPlayerId = await CreateTeamPlayerAsync();
            await CreateSanctionAsync(teamPlayerId, SanctionCategory.Competition);
            await CreateSanctionAsync(teamPlayerId, SanctionCategory.InternalDiscipline);
            var (host, client) = await StartHostAsync(new SetPlayerSanction());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Get, $"/api/catalog/teamplayer/{teamPlayerId}/sanctions?category=Competition");
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<SetPlayerSanction.SanctionRecordResponse[]>();
            Assert.NotNull(body);
            Assert.All(body!, r => Assert.Equal("Competition", r.Category));
            Assert.Single(body!);
        }

        [Fact]
        public async Task GetPlayerSanctions_WithUnknownCategoryFilter_ReturnsBadRequest()
        {
            var teamPlayerId = await CreateTeamPlayerAsync();
            var (host, client) = await StartHostAsync(new SetPlayerSanction());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Get, $"/api/catalog/teamplayer/{teamPlayerId}/sanctions?category=NotACategory");
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task GetPlayerSanctions_ForNonExistentTeamPlayer_ReturnsNotFound()
        {
            var (host, client) = await StartHostAsync(new SetPlayerSanction());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Get, "/api/catalog/teamplayer/does-not-exist/sanctions");
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }
    }
}
```

Run `dotnet test --filter SanctionEndpointAuthorizationTests` from `Back/ExtractionApi` → must fail to compile (`SetPlayerSanction` doesn't exist yet). Confirm the failure is a compile error referencing the missing type, not an unrelated error.

---

## Block 5 — Feature Implementation (TDD Green)

### 5.1 Green

Create `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Players/Commands/SetPlayerSanction.cs`, mirroring `SetPlayerInjury.cs` structurally (same file layout: routes → records → static `ToResponse` mapper):

```csharp
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Players.Commands
{
    // Mirrors SetPlayerInjury.cs's rationale exactly: inline Minimal API handlers (not Mediator
    // ICommand/IQueryApp) for a simple per-teamplayer CRUD sub-resource, so FluentValidation /
    // FeaturePermissionBehavior don't apply here either. GET stays open to every authenticated
    // role; writes are restricted via [Authorize(Roles = "Coach,Administrator")].
    public class SetPlayerSanction : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            // GET all sanctions for a team player, optional ?category= filter
            app.MapGet("/api/catalog/teamplayer/{id}/sanctions",
                async (string id, string? category, AppDbContext db, CancellationToken ct) =>
                {
                    var exists = await db.TeamPlayers.AnyAsync(tp => tp.Id == id, ct);
                    if (!exists) return Results.NotFound();

                    SanctionCategory? categoryFilter = null;
                    if (!string.IsNullOrWhiteSpace(category))
                    {
                        if (!SanctionCategory.TryParseName(category, out categoryFilter))
                            return Results.ValidationProblem(new Dictionary<string, string[]>
                            {
                                ["category"] = new[] { $"Categoría de sanción desconocida: '{category}'." }
                            });
                    }

                    var query = db.TeamPlayerSanctions
                        .AsNoTracking()
                        .Where(s => s.TeamPlayerId == id);

                    if (categoryFilter is not null)
                        query = query.Where(s => s.Category == categoryFilter);

                    var sanctions = await query
                        .OrderByDescending(s => s.StartDate)
                        .ToListAsync(ct);

                    return Results.Ok(sanctions.Select(ToResponse).ToArray());
                })
            .WithName("GetPlayerSanctions")
            .WithTags(PlayerConstants.PlayerFeature)
            .Produces<SanctionRecordResponse[]>()
            .RequireAuthorization();

            // POST create sanction
            app.MapPost("/api/catalog/teamplayer/{id}/sanctions",
                [Authorize(Roles = "Coach,Administrator")]
                async (string id, SanctionCreateRequest req, AppDbContext db, CancellationToken ct) =>
                {
                    var exists = await db.TeamPlayers.AnyAsync(tp => tp.Id == id, ct);
                    if (!exists) return Results.NotFound();

                    if (!SanctionCategory.TryParseName(req.Category, out var category))
                        return Results.ValidationProblem(new Dictionary<string, string[]>
                        {
                            ["category"] = new[] { $"Categoría de sanción desconocida: '{req.Category}'." }
                        });

                    var sanction = TeamPlayerSanction.Create(id, category!, req.StartDate, req.SanctionType, req.Description, req.EstimatedEnd);
                    db.TeamPlayerSanctions.Add(sanction);
                    await db.SaveChangesAsync(ct);

                    return Results.Created(
                        $"/api/catalog/teamplayer/{id}/sanctions/{sanction.Id}",
                        ToResponse(sanction));
                })
            .WithName("CreatePlayerSanction")
            .WithTags(PlayerConstants.PlayerFeature)
            .Accepts<SanctionCreateRequest>("application/json")
            .Produces<SanctionRecordResponse>(StatusCodes.Status201Created)
            .RequireAuthorization();

            // PUT update sanction
            app.MapPut("/api/catalog/teamplayer/{id}/sanctions/{sanctionId}",
                [Authorize(Roles = "Coach,Administrator")]
                async (string id, string sanctionId, SanctionUpdateRequest req, AppDbContext db, CancellationToken ct) =>
                {
                    var sanction = await db.TeamPlayerSanctions
                        .FirstOrDefaultAsync(s => s.Id == sanctionId && s.TeamPlayerId == id, ct);
                    if (sanction == null) return Results.NotFound();

                    if (!SanctionCategory.TryParseName(req.Category, out var category))
                        return Results.ValidationProblem(new Dictionary<string, string[]>
                        {
                            ["category"] = new[] { $"Categoría de sanción desconocida: '{req.Category}'." }
                        });

                    sanction.Update(category!, req.StartDate, req.SanctionType, req.Description, req.EstimatedEnd, req.EndDate);
                    await db.SaveChangesAsync(ct);

                    return Results.Ok(ToResponse(sanction));
                })
            .WithName("UpdatePlayerSanction")
            .WithTags(PlayerConstants.PlayerFeature)
            .Accepts<SanctionUpdateRequest>("application/json")
            .Produces<SanctionRecordResponse>()
            .RequireAuthorization();

            // DELETE sanction
            app.MapDelete("/api/catalog/teamplayer/{id}/sanctions/{sanctionId}",
                [Authorize(Roles = "Coach,Administrator")]
                async (string id, string sanctionId, AppDbContext db, CancellationToken ct) =>
                {
                    var sanction = await db.TeamPlayerSanctions
                        .FirstOrDefaultAsync(s => s.Id == sanctionId && s.TeamPlayerId == id, ct);
                    if (sanction == null) return Results.NotFound();

                    db.TeamPlayerSanctions.Remove(sanction);
                    await db.SaveChangesAsync(ct);

                    return Results.NoContent();
                })
            .WithName("DeletePlayerSanction")
            .WithTags(PlayerConstants.PlayerFeature)
            .RequireAuthorization();
        }

        static SanctionRecordResponse ToResponse(TeamPlayerSanction s)
            => new(s.Id, s.Category.Name, s.StartDate, s.SanctionType, s.Description, s.EstimatedEnd, s.EndDate);

        public record SanctionCreateRequest(string Category, DateTime StartDate, string SanctionType, string? Description, string? EstimatedEnd);
        public record SanctionUpdateRequest(string Category, DateTime StartDate, string SanctionType, string? Description, string? EstimatedEnd, DateTime? EndDate);
        public record SanctionRecordResponse(string Id, string Category, DateTime StartDate, string SanctionType, string? Description, string? EstimatedEnd, DateTime? EndDate);
    }
}
```

Notes for the implementer:
- `PlayerConstants.PlayerFeature` already exists (used by `SetPlayerInjury.cs`) — reuse it, do not create a new tag constant.
- `IFeatureModule` implementations are auto-discovered by `AddFeatureModules.MapFeatures()` via assembly scan — do not add manual registration anywhere.
- If `Results.ValidationProblem` isn't available or behaves unexpectedly in Minimal API context here (it should, it's a built-in `IResult` factory producing an RFC 7807 `ValidationProblemDetails` with 400), that's the correct choice — do not swap it for a raw `Results.BadRequest(string)`, since raw strings are forbidden by convention (all errors must be `ProblemDetails`).

### 5.2 Verify Green

Run `dotnet test --filter SanctionEndpointAuthorizationTests` from `Back/ExtractionApi` → all tests in this file must pass. If `SmartEnum` constructor signature issues surfaced in Block 1, fix them now and re-run.

### 5.3 Refactor

- Remove unused `using`s.
- Double check `TeamPlayerSanction.Category` round-trips correctly through EF (`Category.Name` in the response after a fresh `AsNoTracking()` read, not just right after `Create()` in-memory) — the `GetPlayerSanctions_FilterByCategory_ReturnsOnlyMatchingCategory` test already covers this end-to-end via a real DB read.

---

## Block 6 — Full verification

From `Back/ExtractionApi`:

```bash
dotnet build
dotnet test
```

Both must succeed, 100% pass rate, no skipped tests. If `dotnet build` reports unused-usings or nullable warnings introduced by this change, fix them (do not suppress).

Then run:

```bash
openspec validate add-player-sanctions --strict
```

Report back:
1. Whether `dotnet build` and `dotnet test` (full suite) are green.
2. The exact final route paths, request/response DTO shapes, and the two `SanctionCategory` values as they serialize in JSON (`"Competition"` / `"InternalDiscipline"`).
3. Whether `Ardalis.SmartEnum`'s constructor signature required any deviation from Block 1's draft code, and what the actual signature was.
4. Any task from `tasks.md` that could not be completed as written, and why.

Do not archive the change — leave it for review. Do not touch `Front/` or `Mobile/`.
