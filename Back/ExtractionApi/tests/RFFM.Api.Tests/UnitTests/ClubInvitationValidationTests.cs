#nullable enable
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Features.Coaches.Invitation;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    // Countries are seeded by the InitialCreate migration (see Countries.json); id 1 always exists.
    [Collection(PostgresCollection.Name)]
    public class ClubInvitationValidationTests
    {
        private const int SeededCountryId = 1;

        private readonly PostgresContainerFixture _fixture;

        public ClubInvitationValidationTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        [Fact]
        public async Task Validate_WithValidCodeAndCoachMembership_ReturnsSuccessResult()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();

            var club = Club.Create("FC Test", SeededCountryId, invitationCode: "CLB00001");
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            // Act
            var result = await ClubInvitationValidation.Validate(db, "CLB00001", Membership.Coach, CancellationToken.None);

            // Assert
            Assert.True(result.Success);
            Assert.NotNull(result.Club);
            Assert.Equal(club.Id, result.Club!.Id);
            Assert.Equal(Membership.Coach, result.Membership);
            Assert.Null(result.ErrorCode);
        }

        [Fact]
        public async Task Validate_WithValidCodeAndDirectiveMembership_ReturnsErrorResult()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();

            var club = Club.Create("FC Test", SeededCountryId, invitationCode: "CLB00002");
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            // Act
            var result = await ClubInvitationValidation.Validate(db, "CLB00002", Membership.Directive, CancellationToken.None);

            // Assert
            Assert.False(result.Success);
            Assert.Equal(400, result.StatusCode);
            Assert.Equal(ErrorCodes.ClubInvitationCodeNotAllowedForRole, result.ErrorCode);
        }

        [Fact]
        public async Task Validate_WithInvalidCode_ReturnsNotFoundError()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();

            // Act
            var result = await ClubInvitationValidation.Validate(db, "NOPE0000", Membership.Coach, CancellationToken.None);

            // Assert
            Assert.False(result.Success);
            Assert.Equal(404, result.StatusCode);
            Assert.Equal(ErrorCodes.ClubInvitationCodeInvalid, result.ErrorCode);
        }

        [Fact]
        public async Task Validate_WithValidCodeAndClubMemberMembership_ReturnsSuccessResult()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();

            var club = Club.Create("FC Test", SeededCountryId, invitationCode: "CLB00003");
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            // Act
            var result = await ClubInvitationValidation.Validate(db, "CLB00003", Membership.ClubMember, CancellationToken.None);

            // Assert
            Assert.True(result.Success);
            Assert.NotNull(result.Club);
            Assert.Equal(Membership.ClubMember, result.Membership);
        }
    }
}
