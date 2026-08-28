#nullable enable
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using RFFM.Api.Features.Coaches.SportEventTypes.Queries;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    /// <summary>
    /// Verifies that GET /api/sport-event-types (backed by the SportEventTypes table, seeded via
    /// SportEventTypeEntityConfiguration.HasData) stays in sync with the in-memory
    /// SportEventType.List() -- specifically that the Tournament type (Id = 6) added alongside
    /// this test is present after migrations are applied.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class GetSportEventTypesHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public GetSportEventTypesHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        [Fact]
        public async Task Handle_ReturnsAllSeededSportEventTypes_IncludingTournament()
        {
            await using var db = _fixture.CreateDbContext();
            var handler = new GetSportEventTypes.GetSportEventTypesRequestHandler(db);

            var result = await handler.Handle(new GetSportEventTypes.SportEventTypesQuery(), CancellationToken.None);

            Assert.Contains(result, r => r.Id == 6 && r.Name == "Torneo");
            Assert.Equal(6, result.Length);
        }
    }
}
