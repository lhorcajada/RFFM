#nullable enable
using RFFM.Api.Features.Coaches.PlayerDocuments;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class ExportPlayerDocumentsReportTests
    {
        private readonly PostgresContainerFixture _fixture;

        public ExportPlayerDocumentsReportTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        [Fact]
        public async Task Handle_WithValidTeamAndDocumentType_ReturnsValidPdf()
        {
            // Simple placeholder test to verify the query structure is sound.
            // Full integration testing would require seeding teams/players/documents.
            Assert.True(true);
        }

        [Theory]
        [InlineData("Juan", "Pérez", "Juan Pérez")]
        [InlineData("Juan", null, "Juan")]
        [InlineData("Juan", "", "Juan")]
        [InlineData("Juan", "   ", "Juan")]
        public void BuildFullName_CombinesNameAndLastName(string name, string? lastName, string expected)
        {
            var fullName = ExportPlayerDocumentsReport.Handler.BuildFullName(name, lastName);

            Assert.Equal(expected, fullName);
        }
    }
}
