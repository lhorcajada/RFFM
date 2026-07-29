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
        public async Task CanEditAsync_ClubCoachOfTeamsClub_ReturnsTrue()
        {
            // Real-world coach role: assigned to CreateClub's creator as UserClub.RoleId == Coach
            // (see CreateClub.cs), not as a per-team UserTeam row.
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId) = await SeedTeamAsync(db, "ClubCoach");
            var userId = Guid.NewGuid().ToString();
            db.UserClubs.Add(new UserClub(userId, clubId, Membership.Coach.Id));
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
