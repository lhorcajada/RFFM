#nullable enable
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using RFFM.Api.Features.Federation.Seasons.Services;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class RffmSeasonPreferenceServiceTests
    {
        private readonly PostgresContainerFixture _fixture;

        public RffmSeasonPreferenceServiceTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        [Fact]
        public async Task GetForUserAsync_NoPreference_ReturnsNull()
        {
            await using var db = _fixture.CreateFederationDbContext();
            var service = new RffmSeasonPreferenceService(db);

            var result = await service.GetForUserAsync($"user-{Guid.NewGuid():N}", CancellationToken.None);

            Assert.Null(result);
        }

        [Fact]
        public async Task UpsertAsync_WhenNoneExists_CreatesNewPreference()
        {
            await using var db = _fixture.CreateFederationDbContext();
            var service = new RffmSeasonPreferenceService(db);
            var userId = $"user-{Guid.NewGuid():N}";

            var created = await service.UpsertAsync(userId, 22, CancellationToken.None);

            Assert.Equal(userId, created.UserId);
            Assert.Equal(22, created.SeasonId);

            await using var verifyDb = _fixture.CreateFederationDbContext();
            var stored = await service.GetForUserAsync(userId, CancellationToken.None);
            Assert.NotNull(stored);
            Assert.Equal(22, stored!.SeasonId);
        }

        [Fact]
        public async Task UpsertAsync_WhenAlreadyExists_UpdatesInPlaceWithoutDuplicating()
        {
            await using var db = _fixture.CreateFederationDbContext();
            var service = new RffmSeasonPreferenceService(db);
            var userId = $"user-{Guid.NewGuid():N}";

            await service.UpsertAsync(userId, 22, CancellationToken.None);
            var updated = await service.UpsertAsync(userId, 21, CancellationToken.None);

            Assert.Equal(21, updated.SeasonId);

            await using var verifyDb = _fixture.CreateFederationDbContext();
            var all = verifyDb.RffmSeasonPreferences.Where(p => p.UserId == userId).ToList();
            Assert.Single(all);
            Assert.Equal(21, all[0].SeasonId);
        }
    }
}
