#nullable enable
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Moq;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Services;
using RFFM.Api.Features.Coaches.PlayerTracking;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    [Collection(PostgresCollection.Name)]
    public class PlayerObservationHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public PlayerObservationHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private static ICurrentUserService CurrentUser()
        {
            var mock = new Mock<ICurrentUserService>();
            mock.SetupGet(u => u.UserId).Returns("coach-1");
            return mock.Object;
        }

        private static Task<GetPlayerObservations.PlayerObservationDto> CreateAsync(
            AppDbContext db, string teamId, string teamPlayerId, string subprincipioId,
            DateOnly? date = null, string assessment = "NotAchieved", string? comment = "Busca el pase vertical") =>
            new CreatePlayerObservation.Handler(db, CurrentUser())
                .Handle(new CreatePlayerObservation.Command
                {
                    TeamId = teamId,
                    TeamPlayerId = teamPlayerId,
                    Date = date ?? new DateOnly(2026, 9, 14),
                    SubprincipioId = subprincipioId,
                    Assessment = assessment,
                    Comment = comment
                }, CancellationToken.None)
                .AsTask();

        private static Task<GetPlayerObservations.PlayerObservationDto[]> ListAsync(AppDbContext db, string teamId, string teamPlayerId) =>
            new GetPlayerObservations.Handler(db)
                .Handle(new GetPlayerObservations.Query { TeamId = teamId, TeamPlayerId = teamPlayerId }, CancellationToken.None)
                .AsTask();

        [Fact]
        public async Task Create_StoresTheObservationWithTheSubprincipioLabels()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId, subprincipioId) = await PlayerModelObservationPersistenceTests.SeedAsync(db);
            var momentName = await db.GameMoments.Where(m => m.Id == 1).Select(m => m.Name).SingleAsync();

            var result = await CreateAsync(db, teamId, teamPlayerId, subprincipioId);

            Assert.Equal("GameModel", result.Kind);
            Assert.Equal(subprincipioId, result.SubprincipioId);
            Assert.Equal(momentName, result.MomentName);
            Assert.Equal("2. Ataque posicional", result.PrincipleLabel);
            Assert.Equal("2.3 Circular para desordenar", result.SubprincipioLabel);
            Assert.Equal("NotAchieved", result.Assessment);
            Assert.Equal("Busca el pase vertical", result.Comment);

            await using var readDb = _fixture.CreateDbContext();
            var stored = await readDb.PlayerModelObservations.AsNoTracking().SingleAsync(o => o.Id == result.Id);
            Assert.Equal("coach-1", stored.CreatedByUserId);
            Assert.Equal(teamPlayerId, stored.TeamPlayerId);
        }

        [Fact]
        public async Task Create_SubprincipioOfAnotherTeam_ThrowsNotFound()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId, _) = await PlayerModelObservationPersistenceTests.SeedAsync(db);
            var (_, _, otherSubprincipioId) = await PlayerModelObservationPersistenceTests.SeedAsync(db);

            await Assert.ThrowsAsync<NotFoundException>(() => CreateAsync(db, teamId, teamPlayerId, otherSubprincipioId));
            Assert.False(await db.PlayerModelObservations.AnyAsync(o => o.TeamPlayerId == teamPlayerId));
        }

        [Fact]
        public async Task Create_UnknownSubprincipio_ThrowsNotFound()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId, _) = await PlayerModelObservationPersistenceTests.SeedAsync(db);

            await Assert.ThrowsAsync<NotFoundException>(() => CreateAsync(db, teamId, teamPlayerId, Guid.NewGuid().ToString()));
        }

        [Fact]
        public async Task Create_PlayerOfAnotherTeam_ThrowsNotFound()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, _, subprincipioId) = await PlayerModelObservationPersistenceTests.SeedAsync(db);
            var (_, otherTeamPlayerId, _) = await PlayerModelObservationPersistenceTests.SeedAsync(db);

            await Assert.ThrowsAsync<NotFoundException>(() => CreateAsync(db, teamId, otherTeamPlayerId, subprincipioId));
        }

        [Fact]
        public async Task List_ReturnsOnlyThePlayersObservations_MostRecentFirst()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId, subprincipioId) = await PlayerModelObservationPersistenceTests.SeedAsync(db);
            var teammate = await PlayerModelObservationPersistenceTests.SeedTeammateAsync(db, teamPlayerId);

            await CreateAsync(db, teamId, teamPlayerId, subprincipioId, new DateOnly(2026, 9, 1));
            await CreateAsync(db, teamId, teamPlayerId, subprincipioId, new DateOnly(2026, 9, 14));
            await CreateAsync(db, teamId, teamPlayerId, subprincipioId, new DateOnly(2026, 9, 7));
            await CreateAsync(db, teamId, teammate, subprincipioId, new DateOnly(2026, 9, 10));

            var result = await ListAsync(db, teamId, teamPlayerId);

            Assert.Equal(
                new[] { new DateOnly(2026, 9, 14), new DateOnly(2026, 9, 7), new DateOnly(2026, 9, 1) },
                result.Select(o => o.Date).ToArray());
        }

        [Fact]
        public async Task List_PlayerOfAnotherTeam_ThrowsNotFound()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, _, _) = await PlayerModelObservationPersistenceTests.SeedAsync(db);
            var (_, otherTeamPlayerId, _) = await PlayerModelObservationPersistenceTests.SeedAsync(db);

            await Assert.ThrowsAsync<NotFoundException>(() => ListAsync(db, teamId, otherTeamPlayerId));
        }
    }
}
