#nullable enable
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Players;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Models;
using RFFM.Api.Domain.Services;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    /// <summary>
    /// Covers ISanctionConvocationEnforcementService (design.md Decisión 4, tasks.md 4.1):
    /// forcing an existing/non-existing convocation to Deconvoke, and reverting only when the
    /// convocation still matches the forced signature.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class SanctionConvocationEnforcementServiceTests
    {
        private readonly PostgresContainerFixture _fixture;
        private static readonly int MatchEventTypeId = SportEventType.FromName("Partido").Id;

        public SanctionConvocationEnforcementServiceTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<(string TeamId, string TeamPlayerId)> SeedTeamAndPlayerAsync(AppDbContext db)
        {
            var club = Club.Create($"Enforcement Test Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create(
                $"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9), isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "Enforcement Test Team", CategoryId = Category.NationalCategory.Id, ClubId = club.Id, SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var player = Player.Create(new PlayerModelBase
            {
                Name = "Test", LastName = "Player", Alias = $"testplayer-{Guid.NewGuid():N}", ClubId = club.Id
            });
            db.Players.Add(player);
            await db.SaveChangesAsync();

            var teamPlayer = TeamPlayer.Create(new TeamPlayerModel
            {
                PlayerId = player.Id, TeamId = team.Id, SeasonId = season.Id, JoinedDate = DateTime.UtcNow,
                Dorsal = null, FamilyMembers = new List<FamilyModel>()
            });
            db.TeamPlayers.Add(teamPlayer);
            await db.SaveChangesAsync();

            return (team.Id, teamPlayer.Id);
        }

        private async Task<string> SeedSportEventAsync(AppDbContext db, string teamId, DateTime eveDateTime)
        {
            var sportEvent = SportEvent.CreateNew(
                "Enforcement Test Event", eveDateTime, eveDateTime, null, null, null, null, MatchEventTypeId, teamId, null);
            db.SportEvents.Add(sportEvent);
            await db.SaveChangesAsync();
            return sportEvent.Id;
        }

        [Fact]
        public async Task ForceDeconvocationAsync_ExistingConvocation_TransitionsToDeconvoke()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId) = await SeedTeamAndPlayerAsync(db);
            var eventId = await SeedSportEventAsync(db, teamId, DateTime.UtcNow.AddDays(5));

            var conv = Convocation.Create(new ConvocationModel
            {
                EventId = eventId, TeamPlayerId = teamPlayerId, AssistanceTypeId = null, ConvocationStatusId = 1
            });
            db.Convocations.Add(conv);
            await db.SaveChangesAsync();

            var service = new SanctionConvocationEnforcementService(db);
            await service.ForceDeconvocationAsync(teamPlayerId, eventId, ExcuseTypes.SportiveSanction.Id, CancellationToken.None);
            await db.SaveChangesAsync();

            var updated = await db.Convocations.AsNoTracking().FirstAsync(c => c.Id == conv.Id);
            Assert.Equal(5, updated.ConvocationStatusId);
            Assert.Equal(ExcuseTypes.SportiveSanction.Id, updated.ExcuseTypeId);
        }

        [Fact]
        public async Task ForceDeconvocationAsync_NoExistingConvocation_CreatesNewDeconvokeConvocation()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId) = await SeedTeamAndPlayerAsync(db);
            var eventId = await SeedSportEventAsync(db, teamId, DateTime.UtcNow.AddDays(5));

            var service = new SanctionConvocationEnforcementService(db);
            await service.ForceDeconvocationAsync(teamPlayerId, eventId, ExcuseTypes.SportiveSanction.Id, CancellationToken.None);
            await db.SaveChangesAsync();

            var created = await db.Convocations.AsNoTracking().SingleAsync(c => c.TeamPlayerId == teamPlayerId && c.SportEventId == eventId);
            Assert.Equal(5, created.ConvocationStatusId);
            Assert.Equal(ExcuseTypes.SportiveSanction.Id, created.ExcuseTypeId);
        }

        [Fact]
        public async Task TryRevertForcedDeconvocationAsync_MatchingSignature_RevertsAndReturnsTrue()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId) = await SeedTeamAndPlayerAsync(db);
            var eventId = await SeedSportEventAsync(db, teamId, DateTime.UtcNow.AddDays(5));

            var conv = Convocation.Create(new ConvocationModel
            {
                EventId = eventId, TeamPlayerId = teamPlayerId, AssistanceTypeId = null,
                ConvocationStatusId = 5, ExcuseTypeId = ExcuseTypes.SportiveSanction.Id
            });
            db.Convocations.Add(conv);
            await db.SaveChangesAsync();

            var service = new SanctionConvocationEnforcementService(db);
            var reverted = await service.TryRevertForcedDeconvocationAsync(teamPlayerId, eventId, CancellationToken.None);
            await db.SaveChangesAsync();

            Assert.True(reverted);
            var updated = await db.Convocations.AsNoTracking().FirstAsync(c => c.Id == conv.Id);
            Assert.Equal(1, updated.ConvocationStatusId);
            Assert.Null(updated.ExcuseTypeId);
        }

        [Fact]
        public async Task TryRevertForcedDeconvocationAsync_NonMatchingSignature_NoOpsAndReturnsFalse()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId) = await SeedTeamAndPlayerAsync(db);
            var eventId = await SeedSportEventAsync(db, teamId, DateTime.UtcNow.AddDays(5));

            var conv = Convocation.Create(new ConvocationModel
            {
                EventId = eventId, TeamPlayerId = teamPlayerId, AssistanceTypeId = null,
                ConvocationStatusId = 2, ExcuseTypeId = null
            });
            db.Convocations.Add(conv);
            await db.SaveChangesAsync();

            var service = new SanctionConvocationEnforcementService(db);
            var reverted = await service.TryRevertForcedDeconvocationAsync(teamPlayerId, eventId, CancellationToken.None);
            await db.SaveChangesAsync();

            Assert.False(reverted);
            var untouched = await db.Convocations.AsNoTracking().FirstAsync(c => c.Id == conv.Id);
            Assert.Equal(2, untouched.ConvocationStatusId);
        }
    }
}
