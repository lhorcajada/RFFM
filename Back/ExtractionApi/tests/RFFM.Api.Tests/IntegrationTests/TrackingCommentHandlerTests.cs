#nullable enable
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Moq;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Services;
using RFFM.Api.Features.Coaches.PlayerTracking;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    [Collection(PostgresCollection.Name)]
    public class TrackingCommentHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public TrackingCommentHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        internal static ICurrentUserService CurrentUser()
        {
            var mock = new Mock<ICurrentUserService>();
            mock.SetupGet(u => u.UserId).Returns("coach-1");
            return mock.Object;
        }

        internal static Task<GetTrackingComments.TrackingCommentDto> CreateAsync(AppDbContext db, string teamId, string title, string? description = null) =>
            new CreateTrackingComment.Handler(db, CurrentUser())
                .Handle(new CreateTrackingComment.Command { TeamId = teamId, Title = title, Description = description }, CancellationToken.None)
                .AsTask();

        private static Task<GetTrackingComments.TrackingCommentDto[]> ListAsync(AppDbContext db, string teamId) =>
            new GetTrackingComments.Handler(db)
                .Handle(new GetTrackingComments.Query { TeamId = teamId }, CancellationToken.None)
                .AsTask();

        [Fact]
        public async Task Create_And_List_ReturnsTheTeamCommentsOrderedByTitle()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, _, _) = await PlayerModelObservationPersistenceTests.SeedAsync(db);
            var (otherTeamId, _, _) = await PlayerModelObservationPersistenceTests.SeedAsync(db);

            var created = await CreateAsync(db, teamId, "  Paciencia con balón ", "No fuerza el pase vertical");
            await CreateAsync(db, teamId, "Implicación defensiva");
            await CreateAsync(db, otherTeamId, "Valentía");

            Assert.Equal("Paciencia con balón", created.Title);
            Assert.Equal("No fuerza el pase vertical", created.Description);
            var list = await ListAsync(db, teamId);
            Assert.Equal(new[] { "Implicación defensiva", "Paciencia con balón" }, list.Select(c => c.Title).ToArray());
        }

        [Fact]
        public async Task Create_DuplicatedTitleIgnoringCase_ThrowsConflict()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, _, _) = await PlayerModelObservationPersistenceTests.SeedAsync(db);
            await CreateAsync(db, teamId, "Implicación defensiva");

            var ex = await Assert.ThrowsAsync<ConflictException>(() => CreateAsync(db, teamId, " implicación DEFENSIVA "));

            Assert.Equal(ErrorCodes.TrackingCommentDuplicated, ex.Code);
        }
    }
}
