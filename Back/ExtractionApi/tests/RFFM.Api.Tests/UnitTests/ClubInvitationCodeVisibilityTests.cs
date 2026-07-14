#nullable enable
using System.Security.Claims;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.Clubs;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class ClubInvitationCodeVisibilityTests
    {
        private const int SeededCountryId = 1;
        private readonly PostgresContainerFixture _fixture;

        public ClubInvitationCodeVisibilityTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private static ClaimsPrincipal PrincipalFor(string userId, params string[] roles)
        {
            var claims = new List<Claim> { new(ClaimTypes.NameIdentifier, userId) };
            claims.AddRange(roles.Select(r => new Claim(ClaimTypes.Role, r)));
            var identity = new ClaimsIdentity(claims, "TestAuth", ClaimTypes.Name, ClaimTypes.Role);
            return new ClaimsPrincipal(identity);
        }

        private static async Task<Club> SeedClubAsync(RFFM.Api.Infrastructure.Persistence.AppDbContext db, string name)
        {
            var club = Club.Create(name, SeededCountryId);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();
            return club;
        }

        [Fact]
        public async Task CanViewAsync_Administrator_ReturnsTrueWithoutClubMembership()
        {
            await using var db = _fixture.CreateDbContext();
            var club = await SeedClubAsync(db, "Club Admin Test");
            var user = PrincipalFor(Guid.NewGuid().ToString(), AppRoles.Administrator.Name);

            var result = await ClubInvitationCodeVisibility.CanViewAsync(db, user, club.Id, CancellationToken.None);

            Assert.True(result);
        }

        [Fact]
        public async Task CanViewAsync_ClubDirectorOfThatClub_ReturnsTrue()
        {
            await using var db = _fixture.CreateDbContext();
            var club = await SeedClubAsync(db, "Club Director Test");
            var userId = Guid.NewGuid().ToString();
            db.UserClubs.Add(new UserClub(userId, club.Id, Membership.Directive.Id));
            await db.SaveChangesAsync();
            var user = PrincipalFor(userId);

            var result = await ClubInvitationCodeVisibility.CanViewAsync(db, user, club.Id, CancellationToken.None);

            Assert.True(result);
        }

        [Fact]
        public async Task CanViewAsync_CoachMembershipOfThatClub_ReturnsFalse()
        {
            await using var db = _fixture.CreateDbContext();
            var club = await SeedClubAsync(db, "Club Coach Test");
            var userId = Guid.NewGuid().ToString();
            db.UserClubs.Add(new UserClub(userId, club.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();
            var user = PrincipalFor(userId);

            var result = await ClubInvitationCodeVisibility.CanViewAsync(db, user, club.Id, CancellationToken.None);

            Assert.False(result);
        }

        [Fact]
        public async Task CanViewAsync_ClubDirectorOfAnotherClub_ReturnsFalseForRequestedClub()
        {
            await using var db = _fixture.CreateDbContext();
            var ownClub = await SeedClubAsync(db, "Club Own");
            var otherClub = await SeedClubAsync(db, "Club Other");
            var userId = Guid.NewGuid().ToString();
            db.UserClubs.Add(new UserClub(userId, ownClub.Id, Membership.Directive.Id));
            await db.SaveChangesAsync();
            var user = PrincipalFor(userId);

            var result = await ClubInvitationCodeVisibility.CanViewAsync(db, user, otherClub.Id, CancellationToken.None);

            Assert.False(result);
        }

        [Fact]
        public async Task CanViewAsync_NotAuthenticated_ReturnsFalse()
        {
            await using var db = _fixture.CreateDbContext();
            var club = await SeedClubAsync(db, "Club Anon Test");
            var anonymous = new ClaimsPrincipal(new ClaimsIdentity());

            var result = await ClubInvitationCodeVisibility.CanViewAsync(db, anonymous, club.Id, CancellationToken.None);

            Assert.False(result);
        }

        [Fact]
        public async Task DirectorClubIdsAsync_ReturnsOnlyClubsWhereUserIsDirective()
        {
            await using var db = _fixture.CreateDbContext();
            var directedClub = await SeedClubAsync(db, "Club Directed");
            var coachClub = await SeedClubAsync(db, "Club Coach Only");
            var userId = Guid.NewGuid().ToString();
            db.UserClubs.Add(new UserClub(userId, directedClub.Id, Membership.Directive.Id));
            db.UserClubs.Add(new UserClub(userId, coachClub.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();
            var user = PrincipalFor(userId);

            var result = await ClubInvitationCodeVisibility.DirectorClubIdsAsync(db, user, CancellationToken.None);

            Assert.Contains(directedClub.Id, result);
            Assert.DoesNotContain(coachClub.Id, result);
        }
    }
}
