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
    /// Covers minutes-limit sportive sanction auto-fulfillment on SaveMatchParticipation
    /// (design.md Decisión 4, tasks.md 4.10): a finished match with minutesPlayed &lt;= the
    /// sanction's minutesLimit for that same event marks it Fulfilled.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class SaveMatchParticipationMinutesLimitSanctionTests
    {
        private readonly PostgresContainerFixture _fixture;
        private static readonly int MatchEventTypeId = SportEventType.FromName("Partido").Id;

        public SaveMatchParticipationMinutesLimitSanctionTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<(string TeamId, string TeamPlayerId)> SeedTeamAndPlayerAsync(AppDbContext db)
        {
            var club = Club.Create($"MinutesLimit Test Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create(
                $"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9), isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "MinutesLimit Test Team", CategoryId = Category.NationalCategory.Id, ClubId = club.Id, SeasonId = season.Id
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
                "MinutesLimit Test Event", eveDateTime, eveDateTime, null, null, null, null, MatchEventTypeId, teamId, null);
            db.SportEvents.Add(sportEvent);
            await db.SaveChangesAsync();
            return sportEvent.Id;
        }

        private async Task<TeamPlayerSanction> SeedMinutesLimitSanctionAsync(AppDbContext db, string teamPlayerId, string targetEventId, int minutesLimit)
        {
            var sanction = TeamPlayerSanction.Create(
                teamPlayerId, SanctionCategory.InternalDiscipline, DateTime.UtcNow, "Sanción de minutos", null, null,
                sportivePunishmentType: SanctionSportivePunishmentType.MinutesLimit, targetEventId: targetEventId, minutesLimit: minutesLimit);
            db.TeamPlayerSanctions.Add(sanction);
            await db.SaveChangesAsync();
            return sanction;
        }

        [Fact]
        public async Task PlayingWithinCap_FulfillsSanction()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId) = await SeedTeamAndPlayerAsync(db);
            var eventId = await SeedSportEventAsync(db, teamId, DateTime.UtcNow.AddDays(-1));
            var sanction = await SeedMinutesLimitSanctionAsync(db, teamPlayerId, eventId, minutesLimit: 20);

            var handler = new SaveMatchParticipation.Handler(db);
            var request = new SaveMatchParticipation.SaveMatchParticipationRequest
            {
                EventId = eventId,
                TeamId = teamId,
                ScoreLocal = 1,
                ScoreVisitor = 0,
                MatchPhase = "finished",
                Players = new List<SaveMatchParticipation.PlayerParticipationDto> { new(teamPlayerId, 15, true, 0, null) }
            };

            await handler.Handle(request, CancellationToken.None);

            var reloaded = await db.TeamPlayerSanctions.AsNoTracking().FirstAsync(s => s.Id == sanction.Id);
            Assert.NotNull(reloaded.EndDate);
        }

        [Fact]
        public async Task ExceedingCap_DoesNotFulfillSanction()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId) = await SeedTeamAndPlayerAsync(db);
            var eventId = await SeedSportEventAsync(db, teamId, DateTime.UtcNow.AddDays(-1));
            var sanction = await SeedMinutesLimitSanctionAsync(db, teamPlayerId, eventId, minutesLimit: 20);

            var handler = new SaveMatchParticipation.Handler(db);
            var request = new SaveMatchParticipation.SaveMatchParticipationRequest
            {
                EventId = eventId,
                TeamId = teamId,
                ScoreLocal = 1,
                ScoreVisitor = 0,
                MatchPhase = "finished",
                Players = new List<SaveMatchParticipation.PlayerParticipationDto> { new(teamPlayerId, 45, true, 0, null) }
            };

            await handler.Handle(request, CancellationToken.None);

            var reloaded = await db.TeamPlayerSanctions.AsNoTracking().FirstAsync(s => s.Id == sanction.Id);
            Assert.Null(reloaded.EndDate);
        }

        [Fact]
        public async Task UnrelatedEvent_DoesNotAffectSanction()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId) = await SeedTeamAndPlayerAsync(db);
            var targetEventId = await SeedSportEventAsync(db, teamId, DateTime.UtcNow.AddDays(-1));
            var otherEventId = await SeedSportEventAsync(db, teamId, DateTime.UtcNow.AddDays(-2));
            var sanction = await SeedMinutesLimitSanctionAsync(db, teamPlayerId, targetEventId, minutesLimit: 20);

            var handler = new SaveMatchParticipation.Handler(db);
            var request = new SaveMatchParticipation.SaveMatchParticipationRequest
            {
                EventId = otherEventId,
                TeamId = teamId,
                ScoreLocal = 1,
                ScoreVisitor = 0,
                MatchPhase = "finished",
                Players = new List<SaveMatchParticipation.PlayerParticipationDto> { new(teamPlayerId, 10, true, 0, null) }
            };

            await handler.Handle(request, CancellationToken.None);

            var reloaded = await db.TeamPlayerSanctions.AsNoTracking().FirstAsync(s => s.Id == sanction.Id);
            Assert.Null(reloaded.EndDate);
        }
    }
}
