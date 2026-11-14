#nullable enable
using System;
using System.Threading;
using System.Threading.Tasks;
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
    public class LiveMatchTeamAccessTests
    {
        private static readonly DateTime KickOffAt = new(2026, 11, 4, 10, 0, 0, DateTimeKind.Utc);

        private readonly PostgresContainerFixture _fixture;

        public LiveMatchTeamAccessTests(PostgresContainerFixture fixture)
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

        [Fact]
        public async Task IsTeamCoachAsync_AssignedCoachOfEventTeam_ReturnsTrue()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, _) = await SeedTeamAsync(db, "AssignedCoach");
            var eventId = await SeedSportEventAsync(db, teamId);
            var coachId = Guid.NewGuid().ToString();
            db.UserTeams.Add(new UserTeam(coachId, teamId, Membership.Coach.Id));
            await db.SaveChangesAsync();

            var result = await LiveMatchTeamAccess.IsTeamCoachAsync(db, coachId, eventId, CancellationToken.None);

            Assert.True(result);
        }

        [Fact]
        public async Task IsTeamCoachAsync_CoachOfAnotherTeam_ReturnsFalse()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId) = await SeedTeamAsync(db, "CoachOther");
            var eventId = await SeedSportEventAsync(db, teamId);
            var assignedCoachId = Guid.NewGuid().ToString();
            var otherCoachId = Guid.NewGuid().ToString();
            var otherTeam = new Team(new TeamModelBase
            {
                Name = "Other Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = clubId,
                SeasonId = (await db.Teams.FindAsync(teamId))!.SeasonId
            });
            db.Teams.Add(otherTeam);
            db.UserTeams.Add(new UserTeam(assignedCoachId, teamId, Membership.Coach.Id));
            db.UserTeams.Add(new UserTeam(otherCoachId, otherTeam.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();

            var assigned = await LiveMatchTeamAccess.IsTeamCoachAsync(db, assignedCoachId, eventId, CancellationToken.None);
            var other = await LiveMatchTeamAccess.IsTeamCoachAsync(db, otherCoachId, eventId, CancellationToken.None);

            Assert.True(assigned);
            Assert.False(other);
        }

        [Fact]
        public async Task IsTeamCoachAsync_AdministratorWithoutTeamRow_ReturnsFalse()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId) = await SeedTeamAsync(db, "AdminNoTeam");
            var eventId = await SeedSportEventAsync(db, teamId);
            var assignedCoachId = Guid.NewGuid().ToString();
            var adminId = Guid.NewGuid().ToString();
            db.UserTeams.Add(new UserTeam(assignedCoachId, teamId, Membership.Coach.Id));
            db.UserClubs.Add(new UserClub(adminId, clubId, Membership.Directive.Id));
            await db.SaveChangesAsync();

            var assigned = await LiveMatchTeamAccess.IsTeamCoachAsync(db, assignedCoachId, eventId, CancellationToken.None);
            var admin = await LiveMatchTeamAccess.IsTeamCoachAsync(db, adminId, eventId, CancellationToken.None);

            Assert.True(assigned);
            Assert.False(admin);
        }

        [Fact]
        public async Task IsTeamCoachAsync_ClubLevelCoachWithoutTeamRow_ReturnsTrue()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId) = await SeedTeamAsync(db, "ClubCoach");
            var eventId = await SeedSportEventAsync(db, teamId);
            var clubCoachId = Guid.NewGuid().ToString();
            db.UserClubs.Add(new UserClub(clubCoachId, clubId, Membership.Coach.Id));
            await db.SaveChangesAsync();

            var result = await LiveMatchTeamAccess.IsTeamCoachAsync(db, clubCoachId, eventId, CancellationToken.None);

            Assert.True(result);
        }

        [Fact]
        public async Task IsTeamCoachAsync_ClubLevelCoachOfAnotherClub_ReturnsFalse()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, _) = await SeedTeamAsync(db, "ClubCoachOwner");
            var (_, otherClubId) = await SeedTeamAsync(db, "ClubCoachOther");
            var eventId = await SeedSportEventAsync(db, teamId);
            var otherClubCoachId = Guid.NewGuid().ToString();
            db.UserClubs.Add(new UserClub(otherClubCoachId, otherClubId, Membership.Coach.Id));
            await db.SaveChangesAsync();

            var result = await LiveMatchTeamAccess.IsTeamCoachAsync(db, otherClubCoachId, eventId, CancellationToken.None);

            Assert.False(result);
        }

        [Fact]
        public async Task IsTeamCoachAsync_NonCoachMembershipOnSameTeam_ReturnsFalse()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, _) = await SeedTeamAsync(db, "PlayerMember");
            var eventId = await SeedSportEventAsync(db, teamId);
            var assignedCoachId = Guid.NewGuid().ToString();
            var playerUserId = Guid.NewGuid().ToString();
            db.UserTeams.Add(new UserTeam(assignedCoachId, teamId, Membership.Coach.Id));
            db.UserTeams.Add(new UserTeam(playerUserId, teamId, Membership.Player.Id));
            await db.SaveChangesAsync();

            var assigned = await LiveMatchTeamAccess.IsTeamCoachAsync(db, assignedCoachId, eventId, CancellationToken.None);
            var player = await LiveMatchTeamAccess.IsTeamCoachAsync(db, playerUserId, eventId, CancellationToken.None);

            Assert.True(assigned);
            Assert.False(player);
        }

        [Fact]
        public async Task IsTeamCoachAsync_UnknownEventId_ReturnsFalse()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, _) = await SeedTeamAsync(db, "UnknownEvent");
            var eventId = await SeedSportEventAsync(db, teamId);
            var coachId = Guid.NewGuid().ToString();
            db.UserTeams.Add(new UserTeam(coachId, teamId, Membership.Coach.Id));
            await db.SaveChangesAsync();

            var known = await LiveMatchTeamAccess.IsTeamCoachAsync(db, coachId, eventId, CancellationToken.None);
            var unknown = await LiveMatchTeamAccess.IsTeamCoachAsync(db, coachId, Guid.NewGuid().ToString(), CancellationToken.None);

            Assert.True(known);
            Assert.False(unknown);
        }

        [Fact]
        public void From_StateWithVersion_CarriesVersionAndServerNow()
        {
            var state = LiveMatchState.Create("e1", "t1", 60, KickOffAt, "u1");
            var serverNow = KickOffAt.AddMinutes(12);

            var response = LiveMatchStateResponse.From(state, serverNow);

            Assert.Equal(1, response.Version);
            Assert.Equal(serverNow, response.ServerNowUtc);
        }

        [Fact]
        public void From_FrozenPreMatchClock_ReturnsNullReferenceUtc()
        {
            var state = LiveMatchState.Create("e1", "t1", 60, KickOffAt, "u1");

            var response = LiveMatchStateResponse.From(state, KickOffAt.AddMinutes(5));

            Assert.Equal(LiveMatchPhases.PreMatch, response.Phase);
            Assert.Null(response.Clock.ReferenceUtc);
        }

        [Fact]
        public void From_RunningClock_CarriesClockReferenceUtc()
        {
            var state = LiveMatchState.Create("e1", "t1", 60, KickOffAt, "u1");
            state.Apply(new LiveMatchActionInput(LiveMatchActionTypes.KickOff, null, null, null, null, null, null), KickOffAt, "u1");

            var response = LiveMatchStateResponse.From(state, KickOffAt.AddMinutes(5));

            Assert.Equal(LiveMatchPhases.FirstHalf, response.Phase);
            Assert.Equal(KickOffAt, response.Clock.ReferenceUtc);
        }
    }
}
