#nullable enable
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Players;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.Convocations;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    /// <summary>
    /// Covers convocation blocking for players with an active automatic sanction (design.md
    /// Decisión 4, tasks.md sección 5): AddConvocationHandler throws for the single-player flow,
    /// BulkAddConvocationHandler silently skips the sanctioned player.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class AddConvocationsSanctionBlockingTests
    {
        private readonly PostgresContainerFixture _fixture;
        private static readonly int MatchEventTypeId = SportEventType.FromName("Partido").Id;

        public AddConvocationsSanctionBlockingTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<(string TeamId, string TeamPlayerId)> SeedTeamAndPlayerAsync(AppDbContext db)
        {
            var club = Club.Create($"ConvocationBlocking Test Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create(
                $"Season {Guid.NewGuid():N}",
                DateTime.UtcNow,
                DateTime.UtcNow.AddMonths(9),
                isActive: true,
                club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "ConvocationBlocking Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var player = Player.Create(new PlayerModelBase
            {
                Name = "Test",
                LastName = "Player",
                Alias = $"testplayer-{Guid.NewGuid():N}",
                ClubId = club.Id
            });
            db.Players.Add(player);
            await db.SaveChangesAsync();

            var teamPlayer = TeamPlayer.Create(new TeamPlayerModel
            {
                PlayerId = player.Id,
                TeamId = team.Id,
                SeasonId = season.Id,
                JoinedDate = DateTime.UtcNow,
                Dorsal = null,
                FamilyMembers = new List<FamilyModel>()
            });
            db.TeamPlayers.Add(teamPlayer);
            await db.SaveChangesAsync();

            return (team.Id, teamPlayer.Id);
        }

        private async Task<string> SeedSportEventAsync(AppDbContext db, string teamId, DateTime eveDateTime)
        {
            var sportEvent = SportEvent.CreateNew(
                "ConvocationBlocking Test Event",
                eveDateTime, eveDateTime,
                null, null, null, null,
                MatchEventTypeId, teamId, null);
            db.SportEvents.Add(sportEvent);
            await db.SaveChangesAsync();
            return sportEvent.Id;
        }

        private async Task<TeamPlayerSanction> SeedAutomaticSanctionAsync(
            AppDbContext db, string teamPlayerId, DateTime startDate, DateTime? endDate = null)
        {
            var sanction = TeamPlayerSanction.CreateAutomatic(
                teamPlayerId, SanctionCategory.Competition, startDate, "Tarjeta roja",
                "Generada automáticamente: expulsión (tarjeta roja) en el partido del ... vs ...", "source-event");
            if (endDate.HasValue)
                sanction.Update(SanctionCategory.Competition, startDate, "Tarjeta roja", sanction.Description, null, endDate);

            db.TeamPlayerSanctions.Add(sanction);
            await db.SaveChangesAsync();
            return sanction;
        }

        [Fact]
        public async Task AddConvocation_PlayerWithActiveAutomaticSanctionForFutureMatch_ThrowsAndDoesNotCreateConvocation()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId) = await SeedTeamAndPlayerAsync(db);
            var sanctionStartDate = DateTime.UtcNow;
            await SeedAutomaticSanctionAsync(db, teamPlayerId, sanctionStartDate);
            var eventId = await SeedSportEventAsync(db, teamId, sanctionStartDate.AddDays(7));

            var handler = new AddConvocations.AddConvocationHandler(db);
            var request = new AddConvocations.AddConvocationRequest { EventId = eventId, TeamPlayerId = teamPlayerId, AssistanceTypeId = 1 };

            // Act + Assert
            await Assert.ThrowsAsync<ArgumentException>(() => handler.Handle(request, CancellationToken.None).AsTask());

            var convocationExists = await db.Convocations.AnyAsync(c => c.SportEventId == eventId && c.TeamPlayerId == teamPlayerId);
            Assert.False(convocationExists);
        }

        [Fact]
        public async Task AddConvocation_PlayerWithLiftedSanction_CreatesConvocationNormally()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId) = await SeedTeamAndPlayerAsync(db);
            var sanctionStartDate = DateTime.UtcNow;
            await SeedAutomaticSanctionAsync(db, teamPlayerId, sanctionStartDate, endDate: DateTime.UtcNow);
            var eventId = await SeedSportEventAsync(db, teamId, sanctionStartDate.AddDays(7));

            var handler = new AddConvocations.AddConvocationHandler(db);
            var request = new AddConvocations.AddConvocationRequest { EventId = eventId, TeamPlayerId = teamPlayerId, AssistanceTypeId = 1 };

            // Act
            await handler.Handle(request, CancellationToken.None);

            // Assert
            var convocationExists = await db.Convocations.AnyAsync(c => c.SportEventId == eventId && c.TeamPlayerId == teamPlayerId);
            Assert.True(convocationExists);
        }

        [Fact]
        public async Task AddConvocation_MatchAtOrBeforeSanctionStartDate_IsNotBlocked()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId) = await SeedTeamAndPlayerAsync(db);
            var eventDate = DateTime.UtcNow.AddDays(3);
            var eventId = await SeedSportEventAsync(db, teamId, eventDate);
            // Sanction's own originating match (or a later one) has StartDate == eventDate -> not "posterior", so not blocked.
            await SeedAutomaticSanctionAsync(db, teamPlayerId, eventDate);

            var handler = new AddConvocations.AddConvocationHandler(db);
            var request = new AddConvocations.AddConvocationRequest { EventId = eventId, TeamPlayerId = teamPlayerId, AssistanceTypeId = 1 };

            // Act
            await handler.Handle(request, CancellationToken.None);

            // Assert
            var convocationExists = await db.Convocations.AnyAsync(c => c.SportEventId == eventId && c.TeamPlayerId == teamPlayerId);
            Assert.True(convocationExists);
        }

        [Fact]
        public async Task BulkAddConvocations_TeamWithOneSanctionedPlayer_ConvokesAllExceptSanctioned()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var (teamId, sanctionedTeamPlayerId) = await SeedTeamAndPlayerAsync(db);

            var player2 = Player.Create(new PlayerModelBase { Name = "Test2", LastName = "Player2", Alias = $"tp2-{Guid.NewGuid():N}", ClubId = (await db.Teams.AsNoTracking().FirstAsync(t => t.Id == teamId)).ClubId });
            db.Players.Add(player2);
            await db.SaveChangesAsync();
            var teamPlayer2 = TeamPlayer.Create(new TeamPlayerModel
            {
                PlayerId = player2.Id,
                TeamId = teamId,
                SeasonId = (await db.Teams.AsNoTracking().FirstAsync(t => t.Id == teamId)).SeasonId,
                JoinedDate = DateTime.UtcNow,
                Dorsal = null,
                FamilyMembers = new List<FamilyModel>()
            });
            db.TeamPlayers.Add(teamPlayer2);
            await db.SaveChangesAsync();

            var sanctionStartDate = DateTime.UtcNow;
            await SeedAutomaticSanctionAsync(db, sanctionedTeamPlayerId, sanctionStartDate);
            var eventId = await SeedSportEventAsync(db, teamId, sanctionStartDate.AddDays(7));

            var handler = new AddConvocations.BulkAddConvocationHandler(db);
            var request = new AddConvocations.BulkAddConvocationsRequest { EventId = eventId };

            // Act
            await handler.Handle(request, CancellationToken.None);

            // Assert
            var convocations = await db.Convocations.AsNoTracking().Where(c => c.SportEventId == eventId).ToListAsync();
            Assert.Single(convocations);
            Assert.Equal(teamPlayer2.Id, convocations[0].TeamPlayerId);
        }
    }
}
