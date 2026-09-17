#nullable enable
using RFFM.Api.Features.Coaches.PlayerDocuments;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class PlayerDocumentTypesQueriesTests
    {
        private readonly PostgresContainerFixture _fixture;

        public PlayerDocumentTypesQueriesTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        [Fact]
        public async Task Handle_ReturnsOnlyActiveDocumentTypes()
        {
            await using var db = _fixture.CreateDbContext();
            var active = RFFM.Api.Domain.Entities.PlayerDocuments.DocumentType.Create("Activo", null);
            db.DocumentTypes.Add(active);
            await db.SaveChangesAsync();

            var handler = new PlayerDocumentTypesQueries.Handler(db);
            var result = await handler.Handle(new PlayerDocumentTypesQueries.DocumentTypesQuery(), CancellationToken.None);

            Assert.Contains(result, r => r.Id == active.Id && r.Name == "Activo" && r.IsActive);
        }
    }
}
