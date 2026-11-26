#nullable enable
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    [Collection(PostgresCollection.Name)]
    public class ClubSpaceTypePersistenceTests
    {
        private const int SeededCountryId = 1;
        private readonly PostgresContainerFixture _fixture;

        public ClubSpaceTypePersistenceTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        [Fact]
        public async Task Club_inserted_without_space_type_column_reads_back_as_personal_space()
        {
            var clubId = Guid.NewGuid().ToString();
            var clubName = $"Legacy Club {Guid.NewGuid():N}";
            var userId = $"legacy-coach-{Guid.NewGuid():N}";

            await using (var seedDb = _fixture.CreateDbContext())
            {
                await seedDb.Database.ExecuteSqlInterpolatedAsync(
                    $"INSERT INTO app.\"Clubs\" (\"Id\", \"Name\", \"CountryId\") VALUES ({clubId}, {clubName}, {SeededCountryId})");

                seedDb.UserClubs.Add(new UserClub(userId, clubId, Membership.Directive.Id));
                await seedDb.SaveChangesAsync();
            }

            await using var verifyDb = _fixture.CreateDbContext();
            var club = await verifyDb.Clubs.AsNoTracking().SingleAsync(c => c.Id == clubId);
            var memberships = await verifyDb.UserClubs.AsNoTracking().Where(uc => uc.ClubId == clubId).ToListAsync();

            Assert.Equal(SpaceType.PersonalSpace, club.SpaceType);
            Assert.Single(memberships);
        }

        [Fact]
        public async Task Club_created_with_club_type_persists_as_value_two_and_reads_back_as_club()
        {
            var clubName = $"SpaceType Club {Guid.NewGuid():N}";

            await using (var seedDb = _fixture.CreateDbContext())
            {
                var club = Club.Create(clubName, SeededCountryId, spaceType: SpaceType.Club);
                seedDb.Clubs.Add(club);
                await seedDb.SaveChangesAsync();
            }

            await using var verifyDb = _fixture.CreateDbContext();
            var stored = await verifyDb.Clubs.AsNoTracking().SingleAsync(c => c.Name == clubName);

            Assert.Equal(SpaceType.Club, stored.SpaceType);
            Assert.Equal(2, stored.SpaceType?.Value);
        }
    }
}
