#nullable enable
using System;
using System.Threading;
using System.Threading.Tasks;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Aggregates.LiveMatches;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.LiveMatch;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class GetLiveMatchHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public GetLiveMatchHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private static readonly DateTime KickOffAt = new(2026, 11, 4, 10, 0, 0, DateTimeKind.Utc);

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

        private static async Task<string> SeedSportEventAsync(AppDbContext db, string teamId)
        {
            var sportEvent = SportEvent.CreateNew(
                "Amistoso",
                DateTime.UtcNow.AddDays(-1),
                DateTime.UtcNow.AddDays(-1),
                null, null, null, null,
                4, teamId, null,
                isHomeMatch: true);
            db.SportEvents.Add(sportEvent);
            await db.SaveChangesAsync();
            return sportEvent.Id;
        }

        private static async Task SeedLiveStateAsync(AppDbContext db, string eventId, string teamId)
        {
            db.LiveMatchStates.Add(LiveMatchState.Create(eventId, teamId, 60, KickOffAt, "seed"));
            await db.SaveChangesAsync();
        }

        [Fact]
        public async Task Handle_EventWithoutLiveState_ThrowsNotFound()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, _) = await SeedTeamAsync(db, "GetNotFound");
            var eventId = await SeedSportEventAsync(db, teamId);
            var coachId = Guid.NewGuid().ToString();
            db.UserTeams.Add(new UserTeam(coachId, teamId, Membership.Coach.Id));
            await db.SaveChangesAsync();

            var handler = new GetLiveMatch.Handler(db);

            await Assert.ThrowsAsync<NotFoundException>(() =>
                handler.Handle(new GetLiveMatch.GetLiveMatchQuery(eventId, coachId), CancellationToken.None).AsTask());
        }

        [Fact]
        public async Task Handle_AssignedCoach_ReturnsStateWithStoredVersionAndServerNow()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, _) = await SeedTeamAsync(db, "GetAssigned");
            var eventId = await SeedSportEventAsync(db, teamId);
            var coachId = Guid.NewGuid().ToString();
            db.UserTeams.Add(new UserTeam(coachId, teamId, Membership.Coach.Id));
            await db.SaveChangesAsync();
            await SeedLiveStateAsync(db, eventId, teamId);

            var handler = new GetLiveMatch.Handler(db);
            var before = DateTime.UtcNow;

            var response = await handler.Handle(new GetLiveMatch.GetLiveMatchQuery(eventId, coachId), CancellationToken.None);

            var after = DateTime.UtcNow;
            Assert.Equal(1, response.Version);
            Assert.InRange(response.ServerNowUtc, before, after);
        }

        [Fact]
        public async Task Handle_CoachOfAnotherTeam_ThrowsForbidden()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId) = await SeedTeamAsync(db, "GetOtherTeam");
            var eventId = await SeedSportEventAsync(db, teamId);
            var assignedCoachId = Guid.NewGuid().ToString();
            var otherCoachId = Guid.NewGuid().ToString();
            var otherTeam = new Team(new TeamModelBase
            {
                Name = "GetOther Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = clubId,
                SeasonId = (await db.Teams.FindAsync(teamId))!.SeasonId
            });
            db.Teams.Add(otherTeam);
            db.UserTeams.Add(new UserTeam(assignedCoachId, teamId, Membership.Coach.Id));
            db.UserTeams.Add(new UserTeam(otherCoachId, otherTeam.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();
            await SeedLiveStateAsync(db, eventId, teamId);

            var handler = new GetLiveMatch.Handler(db);
            var assigned = await handler.Handle(new GetLiveMatch.GetLiveMatchQuery(eventId, assignedCoachId), CancellationToken.None);
            Assert.NotNull(assigned);

            await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
                handler.Handle(new GetLiveMatch.GetLiveMatchQuery(eventId, otherCoachId), CancellationToken.None).AsTask());
        }

        [Fact]
        public async Task Handle_AdministratorWithoutTeam_ThrowsForbidden()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId) = await SeedTeamAsync(db, "GetAdminNoTeam");
            var eventId = await SeedSportEventAsync(db, teamId);
            var assignedCoachId = Guid.NewGuid().ToString();
            var adminId = Guid.NewGuid().ToString();
            db.UserTeams.Add(new UserTeam(assignedCoachId, teamId, Membership.Coach.Id));
            db.UserClubs.Add(new UserClub(adminId, clubId, Membership.Directive.Id));
            await db.SaveChangesAsync();
            await SeedLiveStateAsync(db, eventId, teamId);

            var handler = new GetLiveMatch.Handler(db);
            var assigned = await handler.Handle(new GetLiveMatch.GetLiveMatchQuery(eventId, assignedCoachId), CancellationToken.None);
            Assert.NotNull(assigned);

            await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
                handler.Handle(new GetLiveMatch.GetLiveMatchQuery(eventId, adminId), CancellationToken.None).AsTask());
        }
    }
}
