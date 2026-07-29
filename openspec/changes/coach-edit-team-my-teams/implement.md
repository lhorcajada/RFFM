# Implement — coach-edit-team-my-teams

Script técnico para el agente `openspec-implementer`. TDD estricto (Red → Green → Refactor) por
bloque. No avances al siguiente bloque sin que los tests del bloque actual pasen.

Convenciones detectadas en el repo:
- Tests backend en `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/`, xUnit, `#nullable enable`,
  namespace `RFFM.Api.Tests.UnitTests`, usan `PostgresContainerFixture` real
  (`[Collection(PostgresCollection.Name)]`), no InMemory — ver `UpdateTeamHandlerTests.cs` /
  `TeamMembershipBehaviorTests.cs` como plantilla de seeding (`Club.Create`, `Season.Create`,
  `new Team(new TeamModelBase {...})`). País id `1` y `Category.NationalCategory` ya están
  seedeados por la migración inicial.
- Tests frontend co-ubicados en `__tests__/` junto al archivo, Vitest + Testing Library, mocks con
  `vi.mock` antes del import del componente.

---

## Bloque 1 — Backend: `TeamEditAuthorization`

### 1.1 Red

Crear `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/TeamEditAuthorizationTests.cs`:

```csharp
#nullable enable
using System;
using System.Threading;
using System.Threading.Tasks;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.Teams;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class TeamEditAuthorizationTests
    {
        private readonly PostgresContainerFixture _fixture;

        public TeamEditAuthorizationTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private static async Task<(string TeamId, string ClubId)> SeedTeamAsync(AppDbContext db, string namePrefix)
        {
            var club = Club.Create($"{namePrefix} Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create($"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9), isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = $"{namePrefix} Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            return (team.Id, club.Id);
        }

        [Fact]
        public async Task CanEditAsync_CoachOfTeam_ReturnsTrue()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId) = await SeedTeamAsync(db, "Coach");
            var userId = Guid.NewGuid().ToString();
            db.UserTeams.Add(new UserTeam(userId, teamId, Membership.Coach.Id));
            await db.SaveChangesAsync();

            var result = await TeamEditAuthorization.CanEditAsync(db, userId, teamId, clubId, CancellationToken.None);

            Assert.True(result);
        }

        [Fact]
        public async Task CanEditAsync_ClubDirectiveOfTeamsClub_ReturnsTrue()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId) = await SeedTeamAsync(db, "Directive");
            var userId = Guid.NewGuid().ToString();
            db.UserClubs.Add(new UserClub(userId, clubId, Membership.Directive.Id));
            await db.SaveChangesAsync();

            var result = await TeamEditAuthorization.CanEditAsync(db, userId, teamId, clubId, CancellationToken.None);

            Assert.True(result);
        }

        [Fact]
        public async Task CanEditAsync_UnrelatedRole_ReturnsFalse()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId) = await SeedTeamAsync(db, "ClubMember");
            var userId = Guid.NewGuid().ToString();
            db.UserClubs.Add(new UserClub(userId, clubId, Membership.ClubMember.Id));
            await db.SaveChangesAsync();

            var result = await TeamEditAuthorization.CanEditAsync(db, userId, teamId, clubId, CancellationToken.None);

            Assert.False(result);
        }

        [Fact]
        public async Task CanEditAsync_CoachOfAnotherTeamSameClub_ReturnsFalse()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId) = await SeedTeamAsync(db, "OtherCoach");
            var otherTeam = new Team(new TeamModelBase
            {
                Name = "Other Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = clubId,
                SeasonId = (await db.Teams.FindAsync(teamId))!.SeasonId
            });
            db.Teams.Add(otherTeam);
            var userId = Guid.NewGuid().ToString();
            db.UserTeams.Add(new UserTeam(userId, otherTeam.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();

            var result = await TeamEditAuthorization.CanEditAsync(db, userId, teamId, clubId, CancellationToken.None);

            Assert.False(result);
        }

        [Fact]
        public async Task CanEditAsync_NoUserId_ReturnsFalse()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId) = await SeedTeamAsync(db, "Anon");

            var result = await TeamEditAuthorization.CanEditAsync(db, null, teamId, clubId, CancellationToken.None);

            Assert.False(result);
        }

        [Fact]
        public async Task CoachTeamIdsAsync_ReturnsOnlyTeamsWhereUserIsCoach()
        {
            await using var db = _fixture.CreateDbContext();
            var (coachTeamId, clubId) = await SeedTeamAsync(db, "CoachList");
            var otherTeam = new Team(new TeamModelBase
            {
                Name = "Not Coached Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = clubId,
                SeasonId = (await db.Teams.FindAsync(coachTeamId))!.SeasonId
            });
            db.Teams.Add(otherTeam);
            var userId = Guid.NewGuid().ToString();
            db.UserTeams.Add(new UserTeam(userId, coachTeamId, Membership.Coach.Id));
            await db.SaveChangesAsync();

            var result = await TeamEditAuthorization.CoachTeamIdsAsync(db, userId, CancellationToken.None);

            Assert.Contains(coachTeamId, result);
            Assert.DoesNotContain(otherTeam.Id, result);
        }
    }
}
```

Ejecutar `dotnet test --filter TeamEditAuthorizationTests` → debe fallar en compilación
(`TeamEditAuthorization` no existe). Si `Team`/`TeamModelBase`/`UserTeam`/`UserClub` no tienen
constructores públicos accesibles como se asume aquí, revisar `UpdateTeamHandlerTests.cs` (Bloque
ya existente) y `TeamMembershipBehaviorTests.cs`/`ClubInvitationCodeVisibilityTests.cs` (en el
change ya archivado `restrict-club-invitation-code-visibility`) para el constructor exacto y
ajustar sin cambiar el objetivo del test.

### 1.2 Green

Crear `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Teams/TeamEditAuthorization.cs` (ver
`design.md` §1 para el contenido exacto).

Ejecutar `dotnet test --filter TeamEditAuthorizationTests` → deben pasar los 6 tests.

### 1.3 Refactor

Revisar `using` sobrantes. Sin más cambios.

---

## Bloque 2 — Backend: `UpdateTeam.cs`

### 2.1 Red

Editar `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/UpdateTeamHandlerTests.cs` añadiendo:

```csharp
using RFFM.Api.Domain;

// ... dentro de la clase UpdateTeamHandlerTests

[Fact]
public async Task Handle_UserIsCoachOfTeam_UpdatesSuccessfully()
{
    await using var seedDb = _fixture.CreateDbContext();
    var (teamId, clubId) = await SeedTeamAsync(seedDb);
    var userId = Guid.NewGuid().ToString();
    seedDb.UserTeams.Add(new UserTeam(userId, teamId, Membership.Coach.Id));
    await seedDb.SaveChangesAsync();

    await using var updateDb = _fixture.CreateDbContext();
    var handler = new UpdateTeamHandler(updateDb);
    var command = UpdateCommand(teamId, clubId, leagueId: null, leagueGroup: null);
    command.UserId = userId;
    await handler.Handle(command, CancellationToken.None);

    await using var verifyDb = _fixture.CreateDbContext();
    var team = await verifyDb.Teams.SingleAsync(t => t.Id == teamId);
    Assert.Equal("UpdateTeam Test Team", team.Name);
}

[Fact]
public async Task Handle_UserIsDirectiveOfClub_UpdatesSuccessfully()
{
    await using var seedDb = _fixture.CreateDbContext();
    var (teamId, clubId) = await SeedTeamAsync(seedDb);
    var userId = Guid.NewGuid().ToString();
    seedDb.UserClubs.Add(new UserClub(userId, clubId, Membership.Directive.Id));
    await seedDb.SaveChangesAsync();

    await using var updateDb = _fixture.CreateDbContext();
    var handler = new UpdateTeamHandler(updateDb);
    var command = UpdateCommand(teamId, clubId, leagueId: null, leagueGroup: null);
    command.UserId = userId;
    await handler.Handle(command, CancellationToken.None);

    await using var verifyDb = _fixture.CreateDbContext();
    var team = await verifyDb.Teams.SingleAsync(t => t.Id == teamId);
    Assert.Equal("UpdateTeam Test Team", team.Name);
}

[Fact]
public async Task Handle_UserUnrelatedToTeamAndClub_ThrowsForbiddenAndDoesNotPersist()
{
    await using var seedDb = _fixture.CreateDbContext();
    var (teamId, clubId) = await SeedTeamAsync(seedDb);
    var userId = Guid.NewGuid().ToString();

    await using var updateDb = _fixture.CreateDbContext();
    var handler = new UpdateTeamHandler(updateDb);
    var command = new UpdateTeamCommand
    {
        TeamModel = new TeamModel
        {
            Id = teamId,
            Name = "Hacked Name",
            CategoryId = Category.NationalCategory.Id,
            ClubId = clubId,
            UrlPhoto = null
        },
        UserId = userId
    };

    await Assert.ThrowsAsync<ForbiddenAccessException>(
        () => handler.Handle(command, CancellationToken.None).AsTask());

    await using var verifyDb = _fixture.CreateDbContext();
    var team = await verifyDb.Teams.SingleAsync(t => t.Id == teamId);
    Assert.Equal("UpdateTeam Test Team", team.Name);
}
```

Nota: `SeedTeamAsync` en el archivo existente tiene la firma
`SeedTeamAsync(AppDbContext db, int? leagueId = null, int? leagueGroup = null)` — llamarla sin
argumentos opcionales (`SeedTeamAsync(seedDb)`) es válido tal cual.

Ejecutar `dotnet test --filter UpdateTeamHandlerTests` → los 3 tests nuevos deben fallar en
compilación (`UpdateTeamCommand.UserId` no existe todavía).

### 2.2 Green

Editar `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Teams/Commands/UpdateTeam.cs` (ver
`design.md` §2 para el contenido exacto): añadir `UserId` al command, resolverlo en el endpoint
desde `HttpContext`, y aplicar `TeamEditAuthorization.CanEditAsync` en el handler tras cargar
`team`, lanzando `ForbiddenAccessException` si no autoriza. Añadir
`using RFFM.Api.Features.Coaches.Teams;` si el compilador no resuelve `TeamEditAuthorization` por
namespace.

Ejecutar `dotnet test --filter UpdateTeamHandlerTests` → deben pasar todos los tests del archivo
(los 2 preexistentes + los 3 nuevos).

### 2.3 Refactor

Sin cambios estructurales adicionales.

---

## Bloque 3 — Backend: `GetTeams.cs`

### 3.1 Red

Crear `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/GetTeamsHandlerTests.cs`:

```csharp
#nullable enable
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;
using static RFFM.Api.Features.Coaches.Teams.Queries.GetTeams;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class GetTeamsHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public GetTeamsHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private static async Task<(Club Club, Season Season, string TeamId)> SeedClubWithTeamAsync(AppDbContext db, string namePrefix)
        {
            var club = Club.Create($"{namePrefix} Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create($"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9), isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = $"{namePrefix} Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            return (club, season, team.Id);
        }

        [Fact]
        public async Task Handle_UserIsCoachOfTeam_CanEditTrueForThatTeam()
        {
            await using var db = _fixture.CreateDbContext();
            var (club, _, teamId) = await SeedClubWithTeamAsync(db, "CoachTeams");
            var userId = Guid.NewGuid().ToString();
            db.UserClubs.Add(new UserClub(userId, club.Id, Membership.ClubMember.Id));
            db.UserTeams.Add(new UserTeam(userId, teamId, Membership.Coach.Id));
            await db.SaveChangesAsync();
            var handler = new TeamsRequestHandler(db);

            var result = await handler.Handle(new TeamsQuery(club.Id, userId), CancellationToken.None);

            Assert.True(result.Single(t => t.Id == teamId).CanEdit);
        }

        [Fact]
        public async Task Handle_UserIsDirectiveOfClub_CanEditTrueForAllClubTeams()
        {
            await using var db = _fixture.CreateDbContext();
            var (club, season, teamId) = await SeedClubWithTeamAsync(db, "DirectiveTeams");
            var secondTeam = new Team(new TeamModelBase
            {
                Name = "Second Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(secondTeam);
            var userId = Guid.NewGuid().ToString();
            db.UserClubs.Add(new UserClub(userId, club.Id, Membership.Directive.Id));
            await db.SaveChangesAsync();
            var handler = new TeamsRequestHandler(db);

            var result = await handler.Handle(new TeamsQuery(club.Id, userId), CancellationToken.None);

            Assert.All(result, t => Assert.True(t.CanEdit));
        }

        [Fact]
        public async Task Handle_UserUnrelatedRole_CanEditFalse()
        {
            await using var db = _fixture.CreateDbContext();
            var (club, _, teamId) = await SeedClubWithTeamAsync(db, "MemberTeams");
            var userId = Guid.NewGuid().ToString();
            db.UserClubs.Add(new UserClub(userId, club.Id, Membership.ClubMember.Id));
            await db.SaveChangesAsync();
            var handler = new TeamsRequestHandler(db);

            var result = await handler.Handle(new TeamsQuery(club.Id, userId), CancellationToken.None);

            Assert.False(result.Single(t => t.Id == teamId).CanEdit);
        }
    }
}
```

Ejecutar `dotnet test --filter GetTeamsHandlerTests` → debe fallar en compilación (`CanEdit` no
existe todavía en `TeamsResponse`).

### 3.2 Green

Editar `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Teams/Queries/GetTeams.cs`:

- Añadir `CanEdit` al final del record `TeamsResponse` (ver `design.md` §3).
- En `Handle`, tras el `if (userClub == null) throw ...` existente, calcular:
  ```csharp
  var isClubDirective = userClub.RoleId == Membership.Directive.Id;
  var coachTeamIds = await Coaches.Teams.TeamEditAuthorization.CoachTeamIdsAsync(_db, request.UserId, cancellationToken);
  ```
  (ajustar el `using`/namespace calificado según resuelva el compilador —
  `RFFM.Api.Features.Coaches.Teams.TeamEditAuthorization` es el nombre completo).
- Cambiar el pipeline de consulta: mantener el `.Where(...).Select(t => new TeamsResponse(...))`
  existente **sin** el nuevo campo, materializar con `.AsNoTracking().ToArrayAsync(cancellationToken)`
  como hoy, y luego mapear a un segundo array añadiendo `CanEdit` en memoria:
  ```csharp
  var teams = await _db.Teams
      .Include(t => t.Club).ThenInclude(c => c.Country)
      .Include(t => t.Category)
      .Include(cat => cat!.League)
      .Where(t => t.ClubId == request.ClubId && t.SeasonId == activeSeason!.Id)
      .AsNoTracking()
      .ToArrayAsync(cancellationToken);

  return teams.Select(t => new TeamsResponse(t.Id, t.Name,
          new CategoryResponse(t.CategoryId, t.Category!.Name),
          new LeagueResponse(t.LeagueId, t.League != null ? t.League.Name : null, t.LeagueGroup),
          new GetClubResponse(t.ClubId, t.Club.Name,
              new GetCountries.CountriesResponse(t.Club.CountryId, t.Club.Country.Name, t.Club.Country.Code),
              t.Club.ShieldUrl, null),
          t.UrlPhoto, t.JoinCode,
          isClubDirective || coachTeamIds.Contains(t.Id)))
      .ToArray();
  ```

Ejecutar `dotnet test --filter GetTeamsHandlerTests` → deben pasar los 3 tests. Ejecutar también
`dotnet build` completo para confirmar que ningún otro consumidor de `TeamsResponse`
(constructores posicionales en otros tests/mapeos) rompe por el nuevo parámetro.

### 3.3 Refactor

Sin cambios estructurales adicionales.

---

## Bloque 4 — Frontend: botón "Editar" en `TeamManager.tsx`

### 4.1 Red

Editar `Front/src/apps/coach/pages/settings/components/MyTeams/__tests__/TeamManager.test.tsx`
añadiendo dos tests nuevos (seguir el patrón de mocks ya presente en el archivo):

```tsx
it("muestra un botón Editar cuando el equipo es editable por el usuario y navega al formulario", async () => {
  mockGetTeams.mockResolvedValue([
    {
      id: "team-1",
      name: "Alevín A",
      category: { name: "Alevín" },
      league: { name: "Liga Local", group: "Grupo 2" },
      canEdit: true,
    },
  ]);
  mockUseMediaQuery.mockReturnValue(false);

  render(<TeamManager clubId="club-1" />);

  const editButton = await screen.findByRole("button", { name: /editar/i });
  await userEvent.click(editButton);

  expect(mockNavigate).toHaveBeenCalledWith("/coach/clubs/club-1/teams/team-1/edit");
});

it("no muestra el botón Editar cuando el equipo no es editable por el usuario", async () => {
  mockGetTeams.mockResolvedValue([
    {
      id: "team-1",
      name: "Alevín A",
      category: { name: "Alevín" },
      league: { name: "Liga Local", group: "Grupo 2" },
      canEdit: false,
    },
  ]);
  mockUseMediaQuery.mockReturnValue(false);

  render(<TeamManager clubId="club-1" />);

  await screen.findByText("Alevín A");
  expect(screen.queryByRole("button", { name: /editar/i })).not.toBeInTheDocument();
});
```

Ejecutar `npm run test -- TeamManager` → los 2 tests nuevos deben fallar (no existe el botón hoy).

### 4.2 Green

- Editar `Front/src/apps/coach/services/teamService.ts`: añadir `canEdit: boolean;` a `TeamResponse`
  (tras `joinCode`).
- Editar `Front/src/apps/coach/pages/settings/components/MyTeams/TeamManager.tsx`:
  - Importar `EditOutlinedIcon` de `@mui/icons-material/EditOutlined` (mismo icono que
    `ClubTeams.tsx`).
  - Nueva función:
    ```tsx
    const goToEditTeam = (team: TeamResponse) => {
      navigate(`/coach/clubs/${clubId}/teams/${team.id}/edit`);
    };
    ```
  - Tabla: nueva `<TableCell>Acciones</TableCell>` en el `<TableHead>` y, por fila, renderizar el
    botón solo si `team.canEdit`:
    ```tsx
    <TableCell>
      {team.canEdit && (
        <Tooltip title="Editar equipo">
          <IconButton size="small" aria-label="Editar" onClick={() => goToEditTeam(team)}>
            <EditOutlinedIcon fontSize="inherit" />
          </IconButton>
        </Tooltip>
      )}
    </TableCell>
    ```
  - Vista compacta (`SettingsRowCard`): pasar `actions` cuando `team.canEdit`:
    ```tsx
    <SettingsRowCard
      key={team.id}
      title={team.name}
      data-testid={`team-row-card-${team.id}`}
      fields={[...]}
      actions={
        team.canEdit ? (
          <Button size="small" variant="outlined" onClick={() => goToEditTeam(team)}>
            Editar
          </Button>
        ) : undefined
      }
    />
    ```

Ejecutar `npm run test -- TeamManager` → deben pasar todos los tests del archivo (preexistentes +
nuevos).

### 4.3 Refactor

`npm run build` para confirmar que no hay errores de TypeScript (el nuevo campo `canEdit` en
`TeamResponse` es obligatorio — verificar que ningún otro mock/fixture de `TeamResponse` en el
repo quede sin ese campo y rompa un test ya existente; si algún otro test de `TeamManager.test.tsx`
no seteaba `canEdit`, TypeScript en el test no falla porque los mocks son objetos literales sin
tipar estrictamente contra `TeamResponse[]`, pero revisar igualmente).

---

## Bloque 5 — Verificación final

```bash
# Backend
cd Back/ExtractionApi
dotnet build
dotnet test

# Frontend
cd Front
npm run build
npm run test -- TeamManager
npm run test
```

Manual (requiere backend + frontend corriendo, con un club con un usuario `Coach` de un equipo y
otro usuario `Directive` del club, y un tercer usuario sin relación):
1. Login como `Coach` del equipo → Ajustes → Mis equipos muestra "Editar" en ese equipo; al
   pulsar, navega a `EditTeam.tsx` con los datos precargados.
2. Login como `Directive` del club → ve "Editar" en todos los equipos del club.
3. Login como usuario sin relación con ningún equipo del club (si el flujo de acceso al listado lo
   permite) → no ve "Editar" en ninguno.
4. `PUT /api/catalog/team/{id}` con el token de un usuario sin relación con el equipo/club →
   `403`.
5. `PUT /api/catalog/team/{id}` con el token del `Coach`/`Directive` → `200`, cambios persistidos.

Si todo pasa: `openspec validate coach-edit-team-my-teams --strict` y mover la carpeta a
`openspec/changes/archive/2026-07-29-coach-edit-team-my-teams/`.
