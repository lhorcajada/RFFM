#nullable enable
using Microsoft.EntityFrameworkCore;
using Moq;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Players;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Models;
using RFFM.Api.Domain.Services;
using RFFM.Api.Features.Coaches.Convocations;
using RFFM.Api.Features.Coaches.Notifications.Services;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    /// <summary>
    /// A player can only have one convocation per event. Covers the unique index on
    /// (SportEventId, TeamPlayerId), the 409 on a duplicated AddConvocation and the idempotent
    /// server-side deconvocation of injured players that replaced the client-side auto-registration
    /// (which created duplicated convocations when the attendance page loaded twice).
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class ConvocationUniquenessTests
    {
        private readonly PostgresContainerFixture _fixture;
        private static readonly int TrainingEventTypeId = SportEventType.TrainingId;
        private static readonly int PendingStatusId = ConvocationStatus.FromName("Pending").Id;
        private static readonly int DeconvokeStatusId = ConvocationStatus.FromName("Deconvoke").Id;

        public ConvocationUniquenessTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private static async Task<(string TeamId, string ClubId, string SeasonId)> SeedTeamAsync(AppDbContext db)
        {
            var club = Club.Create($"ConvocationUniqueness Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create($"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9), isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "ConvocationUniqueness Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            return (team.Id, club.Id, season.Id);
        }

        private static async Task<string> SeedTeamPlayerAsync(AppDbContext db, string teamId, string clubId, string seasonId)
        {
            var player = Player.Create(new PlayerModelBase
            {
                Name = "Test",
                LastName = "Player",
                Alias = $"uniq-{Guid.NewGuid():N}",
                ClubId = clubId
            });
            db.Players.Add(player);
            await db.SaveChangesAsync();

            var teamPlayer = TeamPlayer.Create(new TeamPlayerModel
            {
                PlayerId = player.Id,
                TeamId = teamId,
                SeasonId = seasonId,
                JoinedDate = DateTime.UtcNow,
                Dorsal = null,
                FamilyMembers = new List<FamilyModel>()
            });
            db.TeamPlayers.Add(teamPlayer);
            await db.SaveChangesAsync();
            return teamPlayer.Id;
        }

        private static async Task<string> SeedEventAsync(AppDbContext db, string teamId, DateTime eveDateTime)
        {
            var sportEvent = SportEvent.CreateNew(
                "ConvocationUniqueness Event",
                eveDateTime, eveDateTime,
                null, null, null, null,
                TrainingEventTypeId, teamId, null);
            db.SportEvents.Add(sportEvent);
            await db.SaveChangesAsync();
            return sportEvent.Id;
        }

        private static async Task SeedInjuryAsync(AppDbContext db, string teamPlayerId, DateTime startDate)
        {
            db.TeamPlayerInjuries.Add(TeamPlayerInjury.Create(teamPlayerId, startDate, "Muscular", null, null));
            await db.SaveChangesAsync();
        }

        private static Convocation NewConvocation(string eventId, string teamPlayerId, int statusId) =>
            Convocation.Create(new ConvocationModel
            {
                EventId = eventId,
                TeamPlayerId = teamPlayerId,
                AssistanceTypeId = null,
                ConvocationStatusId = statusId
            });

        private DeconvokeInjuredPlayers.Handler CreateDeconvokeInjuredHandler(AppDbContext db) =>
            new(db, new SanctionConvocationEnforcementService(db));

        [Fact]
        public async Task Database_RejectsASecondConvocationOfTheSamePlayerForTheSameEvent()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId);
            var eventId = await SeedEventAsync(db, teamId, DateTime.UtcNow.AddDays(2));
            db.Convocations.Add(NewConvocation(eventId, teamPlayerId, PendingStatusId));
            await db.SaveChangesAsync();

            db.Convocations.Add(NewConvocation(eventId, teamPlayerId, DeconvokeStatusId));

            await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
        }

        [Fact]
        public async Task AddConvocation_PlayerAlreadyConvocated_ThrowsConflict()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId);
            var eventId = await SeedEventAsync(db, teamId, DateTime.UtcNow.AddDays(2));
            var handler = new AddConvocations.AddConvocationHandler(db, Mock.Of<IWebPushNotificationDispatcher>());
            var request = new AddConvocations.AddConvocationRequest { EventId = eventId, TeamPlayerId = teamPlayerId };
            await handler.Handle(request, CancellationToken.None);

            var ex = await Assert.ThrowsAsync<ConflictException>(() => handler.Handle(request, CancellationToken.None).AsTask());

            Assert.Equal(ErrorCodes.PlayerAlreadyConvocated, ex.Code);
        }

        [Fact]
        public async Task DeconvokeInjuredPlayers_InjuredPlayerWithoutConvocation_IsDeconvokedWithInjuryReason()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId);
            var eventDate = DateTime.UtcNow.AddDays(2);
            var eventId = await SeedEventAsync(db, teamId, eventDate);
            await SeedInjuryAsync(db, teamPlayerId, eventDate.AddDays(-5));

            await CreateDeconvokeInjuredHandler(db).Handle(new DeconvokeInjuredPlayers.Command(eventId), CancellationToken.None);

            var convocation = await db.Convocations.AsNoTracking().SingleAsync(c => c.SportEventId == eventId);
            Assert.Equal(teamPlayerId, convocation.TeamPlayerId);
            Assert.Equal(DeconvokeStatusId, convocation.ConvocationStatusId);
            Assert.Equal(ExcuseTypes.Injury.Id, convocation.ExcuseTypeId);
        }

        [Fact]
        public async Task DeconvokeInjuredPlayers_CalledTwice_KeepsASingleConvocationPerPlayer()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId);
            var eventDate = DateTime.UtcNow.AddDays(2);
            var eventId = await SeedEventAsync(db, teamId, eventDate);
            await SeedInjuryAsync(db, teamPlayerId, eventDate.AddDays(-5));
            var command = new DeconvokeInjuredPlayers.Command(eventId);

            await CreateDeconvokeInjuredHandler(db).Handle(command, CancellationToken.None);
            await CreateDeconvokeInjuredHandler(db).Handle(command, CancellationToken.None);

            var count = await db.Convocations.CountAsync(c => c.SportEventId == eventId && c.TeamPlayerId == teamPlayerId);
            Assert.Equal(1, count);
        }

        [Fact]
        public async Task DeconvokeInjuredPlayers_InjuryStartingOnTheEventDay_DoesNotDeconvoke()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId);
            var eventDate = DateTime.UtcNow.AddDays(2);
            var eventId = await SeedEventAsync(db, teamId, eventDate);
            await SeedInjuryAsync(db, teamPlayerId, eventDate);

            await CreateDeconvokeInjuredHandler(db).Handle(new DeconvokeInjuredPlayers.Command(eventId), CancellationToken.None);

            Assert.False(await db.Convocations.AnyAsync(c => c.SportEventId == eventId));
        }

        [Fact]
        public async Task DeconvokeInjuredPlayers_InjuredPlayerAlreadyConvocated_KeepsTheExistingConvocation()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId);
            var eventDate = DateTime.UtcNow.AddDays(2);
            var eventId = await SeedEventAsync(db, teamId, eventDate);
            await SeedInjuryAsync(db, teamPlayerId, eventDate.AddDays(-5));
            db.Convocations.Add(NewConvocation(eventId, teamPlayerId, PendingStatusId));
            await db.SaveChangesAsync();

            await CreateDeconvokeInjuredHandler(db).Handle(new DeconvokeInjuredPlayers.Command(eventId), CancellationToken.None);

            var convocation = await db.Convocations.AsNoTracking().SingleAsync(c => c.SportEventId == eventId);
            Assert.Equal(PendingStatusId, convocation.ConvocationStatusId);
        }
    }
}
