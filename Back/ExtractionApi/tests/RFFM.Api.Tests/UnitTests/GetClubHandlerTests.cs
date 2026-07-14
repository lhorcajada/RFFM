#nullable enable
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Tests.Fixtures;
using Xunit;
using static RFFM.Api.Features.Coaches.Clubs.Queries.GetClub;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class GetClubHandlerTests
    {
        private const int SeededCountryId = 1;
        private readonly PostgresContainerFixture _fixture;

        public GetClubHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private static async Task<Club> SeedClubAsync(RFFM.Api.Infrastructure.Persistence.AppDbContext db, string name)
        {
            var club = Club.Create(name, SeededCountryId);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();
            return club;
        }

        [Fact]
        public async Task Handle_CanViewInvitationCodeTrue_ReturnsRealCode()
        {
            await using var db = _fixture.CreateDbContext();
            var club = await SeedClubAsync(db, "Club Visible Code");
            var handler = new ClubsRequestHandler(db);

            var result = await handler.Handle(
                new GetClubQueryApp { ClubId = club.Id, CanViewInvitationCode = true },
                CancellationToken.None);

            Assert.Equal(club.InvitationCode, result.invitationCode);
            Assert.NotNull(result.invitationCode);
        }

        [Fact]
        public async Task Handle_CanViewInvitationCodeFalse_ReturnsNull()
        {
            await using var db = _fixture.CreateDbContext();
            var club = await SeedClubAsync(db, "Club Hidden Code");
            var handler = new ClubsRequestHandler(db);

            var result = await handler.Handle(
                new GetClubQueryApp { ClubId = club.Id, CanViewInvitationCode = false },
                CancellationToken.None);

            Assert.Null(result.invitationCode);
        }

        [Fact]
        public void CacheKey_DiffersBetweenCanViewInvitationCodeTrueAndFalse()
        {
            var privileged = new GetClubQueryApp { ClubId = "club-1", CanViewInvitationCode = true };
            var unprivileged = new GetClubQueryApp { ClubId = "club-1", CanViewInvitationCode = false };

            Assert.NotEqual(privileged.CacheKey, unprivileged.CacheKey);
            Assert.StartsWith(RFFM.Api.Features.Coaches.Clubs.ClubConstants.CachePrefix, privileged.CacheKey);
            Assert.StartsWith(RFFM.Api.Features.Coaches.Clubs.ClubConstants.CachePrefix, unprivileged.CacheKey);
        }
    }
}
