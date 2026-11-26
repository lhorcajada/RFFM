#nullable enable
using Microsoft.EntityFrameworkCore;
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

        private static async Task<Club> SeedClubAsync(RFFM.Api.Infrastructure.Persistence.AppDbContext db, string name, SpaceType? spaceType = null)
        {
            var club = Club.Create(name, SeededCountryId, spaceType: spaceType);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();
            return club;
        }

        private static string NewUserId() => Guid.NewGuid().ToString();

        [Fact]
        public async Task Handle_AdministratorSeesAllInvitationCodes()
        {
            await using var db = _fixture.CreateDbContext();
            await SeedClubAsync(db, "Club Admin View 1", SpaceType.Club);
            await SeedClubAsync(db, "Club Admin View 2", SpaceType.Club);
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
            var userId = NewUserId();
            var directedClub = await SeedClubAsync(db, "Club Directed By Me", SpaceType.PersonalSpace);
            var otherClub = await SeedClubAsync(db, "Club Not Mine", SpaceType.Club);
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

        [Fact]
        public async Task Handle_NonMemberDoesNotSeePersonalSpace()
        {
            await using var db = _fixture.CreateDbContext();
            var ownerId = NewUserId();
            var outsiderId = NewUserId();
            var personal = await SeedClubAsync(db, $"Personal Hidden {Guid.NewGuid():N}", SpaceType.PersonalSpace);
            db.UserClubs.Add(new UserClub(ownerId, personal.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();
            var handler = new ClubsRequestHandler(db);

            var result = await handler.Handle(
                new ClubsQueryApp { RequestingUserId = outsiderId },
                CancellationToken.None);

            Assert.DoesNotContain(result, c => c.Id == personal.Id);
        }

        [Fact]
        public async Task Handle_MemberSeesPersonalSpaceWithPersonalLabel()
        {
            await using var db = _fixture.CreateDbContext();
            var ownerId = NewUserId();
            var personal = await SeedClubAsync(db, $"Personal Visible {Guid.NewGuid():N}", SpaceType.PersonalSpace);
            db.UserClubs.Add(new UserClub(ownerId, personal.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();
            var handler = new ClubsRequestHandler(db);

            var result = await handler.Handle(
                new ClubsQueryApp { RequestingUserId = ownerId },
                CancellationToken.None);

            var item = Assert.Single(result, c => c.Id == personal.Id);
            Assert.Equal("Espacio personal", item.SpaceTypeLabel);
        }

        [Fact]
        public async Task Handle_ClubTypeSpaceIsListedForAnyUserWithClubLabel()
        {
            await using var db = _fixture.CreateDbContext();
            var club = await SeedClubAsync(db, $"Club Shared {Guid.NewGuid():N}", SpaceType.Club);
            var anyUserId = NewUserId();
            var handler = new ClubsRequestHandler(db);

            var result = await handler.Handle(
                new ClubsQueryApp { RequestingUserId = anyUserId },
                CancellationToken.None);

            var item = Assert.Single(result, c => c.Id == club.Id);
            Assert.Equal("Club", item.SpaceTypeLabel);
        }

        [Fact]
        public async Task Handle_PersonalSpaceWithSameNameAsClubCreatesWithoutChangingExistingClub()
        {
            await using var db = _fixture.CreateDbContext();
            var sharedName = $"Same Name {Guid.NewGuid():N}";
            var existingClub = await SeedClubAsync(db, sharedName, SpaceType.Club);
            var coachId = NewUserId();
            var personal = await SeedClubAsync(db, sharedName, SpaceType.PersonalSpace);
            db.UserClubs.Add(new UserClub(coachId, personal.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();
            var handler = new ClubsRequestHandler(db);

            var result = await handler.Handle(
                new ClubsQueryApp { RequestingUserId = coachId },
                CancellationToken.None);

            Assert.NotEqual(existingClub.Id, personal.Id);
            var personalItem = Assert.Single(result, c => c.Id == personal.Id);
            Assert.Equal("Espacio personal", personalItem.SpaceTypeLabel);

            await using var verifyDb = _fixture.CreateDbContext();
            var reread = await verifyDb.Clubs.AsNoTracking().SingleAsync(c => c.Id == existingClub.Id);
            Assert.Equal(sharedName, reread.Name);
        }

        [Fact]
        public async Task Handle_ListedAsTwoUsersInSequenceNeverLeaksFirstUsersPersonalSpace()
        {
            await using var db = _fixture.CreateDbContext();
            var userA = NewUserId();
            var userB = NewUserId();
            var personalOfA = await SeedClubAsync(db, $"Personal Of A {Guid.NewGuid():N}", SpaceType.PersonalSpace);
            db.UserClubs.Add(new UserClub(userA, personalOfA.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();
            var handler = new ClubsRequestHandler(db);

            var resultForA = await handler.Handle(
                new ClubsQueryApp { RequestingUserId = userA },
                CancellationToken.None);
            var resultForB = await handler.Handle(
                new ClubsQueryApp { RequestingUserId = userB },
                CancellationToken.None);

            Assert.Contains(resultForA, c => c.Id == personalOfA.Id);
            Assert.DoesNotContain(resultForB, c => c.Id == personalOfA.Id);
        }
    }
}
