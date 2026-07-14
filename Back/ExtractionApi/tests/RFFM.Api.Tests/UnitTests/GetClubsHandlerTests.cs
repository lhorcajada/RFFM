#nullable enable
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Tests.Fixtures;
using Xunit;
using static RFFM.Api.Features.Coaches.Clubs.Queries.GetClubs;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class GetClubsHandlerTests
    {
        private const int SeededCountryId = 1;
        private readonly PostgresContainerFixture _fixture;

        public GetClubsHandlerTests(PostgresContainerFixture fixture)
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
        public async Task Handle_AdministratorSeesAllInvitationCodes()
        {
            await using var db = _fixture.CreateDbContext();
            await SeedClubAsync(db, "Club Admin View 1");
            await SeedClubAsync(db, "Club Admin View 2");
            var handler = new ClubsRequestHandler(db);

            var result = await handler.Handle(
                new ClubsQueryApp { CanViewAllInvitationCodes = true },
                CancellationToken.None);

            Assert.All(result, c => Assert.NotNull(c.invitationCode));
        }

        [Fact]
        public async Task Handle_NonAdministratorSeesOnlyOwnDirectedClubsCode()
        {
            await using var db = _fixture.CreateDbContext();
            var directedClub = await SeedClubAsync(db, "Club Directed By Me");
            var otherClub = await SeedClubAsync(db, "Club Not Mine");
            var userId = Guid.NewGuid().ToString();
            db.UserClubs.Add(new UserClub(userId, directedClub.Id, Membership.Directive.Id));
            await db.SaveChangesAsync();
            var handler = new ClubsRequestHandler(db);

            var result = await handler.Handle(
                new ClubsQueryApp { CanViewAllInvitationCodes = false, RequestingUserId = userId },
                CancellationToken.None);

            var directed = result.Single(c => c.Id == directedClub.Id);
            var other = result.Single(c => c.Id == otherClub.Id);
            Assert.NotNull(directed.invitationCode);
            Assert.Null(other.invitationCode);
        }
    }
}
