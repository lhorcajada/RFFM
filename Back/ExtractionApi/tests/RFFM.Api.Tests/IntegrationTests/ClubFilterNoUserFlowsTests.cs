#nullable enable
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.Invitation;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Guard tests for flows that run without a membership or without any user. They pass today and
    /// must keep passing once the club filter is registered.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class ClubFilterNoUserFlowsTests
    {
        private const int SeededCountryId = 1;
        private readonly PostgresContainerFixture _fixture;

        public ClubFilterNoUserFlowsTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private static async Task<Team> SeedClubWithTeamAsync(AppDbContext db)
        {
            var club = Club.Create($"NoUser Club {Guid.NewGuid():N}", SeededCountryId);
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
                Name = "NoUser Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();
            return team;
        }

        [Fact]
        public async Task Context_without_user_is_not_filtered_and_reads_teams_of_two_clubs()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var teamA = await SeedClubWithTeamAsync(seedDb);
            var teamB = await SeedClubWithTeamAsync(seedDb);

            await using var backgroundDb = _fixture.CreateDbContext();
            var ids = new[] { teamA.Id, teamB.Id };
            var readTeams = await backgroundDb.Teams.AsNoTracking().Where(t => ids.Contains(t.Id)).ToListAsync();

            Assert.False(backgroundDb.ClubFilterActive);
            Assert.Equal(2, readTeams.Count);
        }

        [Fact]
        public async Task Authenticated_non_member_finds_club_by_invitation_code_and_inserts_membership()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var team = await SeedClubWithTeamAsync(seedDb);
            var club = await seedDb.Clubs.AsNoTracking().SingleAsync(c => c.Id == team.ClubId);
            var invitationCode = club.InvitationCode!;
            var userId = $"nonmember-{Guid.NewGuid():N}";

            await using var joinDb = _fixture.CreateDbContext(userId);
            var validation = await ClubInvitationValidation.Validate(
                joinDb, invitationCode, Membership.Coach, CancellationToken.None);
            Assert.True(validation.Success);
            Assert.Equal(club.Id, validation.Club!.Id);

            joinDb.UserClubs.Add(new UserClub(userId, validation.Club.Id, Membership.Coach.Id));
            await joinDb.SaveChangesAsync();

            await using var verifyDb = _fixture.CreateDbContext();
            var inserted = await verifyDb.UserClubs.AsNoTracking()
                .CountAsync(uc => uc.ApplicationUserId == userId && uc.ClubId == club.Id);
            Assert.Equal(1, inserted);
        }
    }
}
