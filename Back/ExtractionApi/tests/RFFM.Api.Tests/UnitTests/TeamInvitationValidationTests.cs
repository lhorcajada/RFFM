#nullable enable
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.Invitation;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    // Countries/Categories are seeded by the InitialCreate migration; country id 1 and
    // Category.NationalCategory always exist.
    [Collection(PostgresCollection.Name)]
    public class TeamInvitationValidationTests
    {
        private const int SeededCountryId = 1;

        private readonly PostgresContainerFixture _fixture;

        public TeamInvitationValidationTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private static async Task<Team> SeedTeamAsync(RFFM.Api.Infrastructure.Persistence.AppDbContext db, string clubName)
        {
            var club = Club.Create(clubName, SeededCountryId);
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
                Name = "Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            return team;
        }

        [Fact]
        public async Task Validate_WithValidCodeAndPlayerMembership_ReturnsSuccessResult()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var team = await SeedTeamAsync(db, "FC Test 1");

            // Act
            var result = await TeamInvitationValidation.Validate(db, team.JoinCode, Membership.Player, CancellationToken.None);

            // Assert
            Assert.True(result.Success);
            Assert.NotNull(result.Team);
            Assert.Equal(team.Id, result.Team!.Id);
            Assert.Equal(Membership.Player, result.Membership);
            Assert.Null(result.ErrorCode);
        }

        [Fact]
        public async Task Validate_WithValidCodeAndFamilyPlayerMembership_ReturnsSuccessResult()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var team = await SeedTeamAsync(db, "FC Test 2");

            // Act
            var result = await TeamInvitationValidation.Validate(db, team.JoinCode, Membership.FamilyPlayer, CancellationToken.None);

            // Assert
            Assert.True(result.Success);
            Assert.NotNull(result.Team);
        }

        [Fact]
        public async Task Validate_WithValidCodeAndCoachMembership_ReturnsErrorResult()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var team = await SeedTeamAsync(db, "FC Test 3");

            // Act
            var result = await TeamInvitationValidation.Validate(db, team.JoinCode, Membership.Coach, CancellationToken.None);

            // Assert
            Assert.False(result.Success);
            Assert.Equal(400, result.StatusCode);
            Assert.Equal(ErrorCodes.TeamInvitationCodeNotAllowedForRole, result.ErrorCode);
        }

        [Fact]
        public async Task Validate_WithInvalidCode_ReturnsNotFoundError()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();

            // Act
            var result = await TeamInvitationValidation.Validate(db, "INVALID", Membership.Player, CancellationToken.None);

            // Assert
            Assert.False(result.Success);
            Assert.Equal(404, result.StatusCode);
            Assert.Equal(ErrorCodes.TeamInvitationCodeInvalid, result.ErrorCode);
        }
    }
}
