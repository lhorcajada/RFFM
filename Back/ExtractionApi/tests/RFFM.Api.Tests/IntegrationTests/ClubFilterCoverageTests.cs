#nullable enable
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Coverage guard for the club data filter (openspec change personal-and-club-spaces, Step 7). Reflects
    /// over the production <c>AppDbContext</c> model: every entity type with a <c>ClubId</c> property must
    /// carry a query filter unless it is on the explicit allow-list below. A new club-scoped entity that
    /// forgets its filter fails this test instead of leaking silently.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class ClubFilterCoverageTests
    {
        /// <summary>Entity types that carry or relate to ClubId but are deliberately not filtered.</summary>
        public static readonly IReadOnlyDictionary<string, string> AllowList = new Dictionary<string, string>
        {
            ["Club"] = "The club itself; it is the scope, not data scoped by ClubId.",
            ["UserClub"] = "The membership row the filter reads; filtering it would hide the caller's own membership.",
            ["ClubJoinRequest"] = "Join request created before the requester belongs to the club.",
            ["UserTeamClub"] = "Keyless read model over UserTeam joined to Team; the filter itself reads it.",
            ["ClubKit"] = "Outside the approved scope of this change (club kits are not in the filtered list).",
            ["ClubSeatCharge"] = "Billing record outside the approved scope of this change.",
        };

        /// <summary>EF Core stores a global query filter under this annotation name.</summary>
        private const string QueryFilterAnnotation = "QueryFilter";

        private readonly PostgresContainerFixture _fixture;

        public ClubFilterCoverageTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        [Fact]
        public async Task Every_entity_with_ClubId_outside_the_allow_list_has_a_query_filter()
        {
            await using var db = _fixture.CreateDbContext();

            var unfiltered = db.Model.GetEntityTypes()
                .Where(e => !e.IsOwned() && e.FindProperty("ClubId") is not null)
                .Where(e => e.FindAnnotation(QueryFilterAnnotation)?.Value is null)
                .Select(e => e.ClrType.Name)
                .Where(name => !AllowList.ContainsKey(name))
                .OrderBy(name => name)
                .ToList();

            Assert.Empty(unfiltered);
        }

        [Theory]
        [InlineData("Team")]
        [InlineData("Player")]
        [InlineData("TaskTrainingBase")]
        [InlineData("Season")]
        [InlineData("UserActivityLog")]
        public async Task Required_entity_has_a_query_filter(string entityName)
        {
            await using var db = _fixture.CreateDbContext();

            var entityType = db.Model.GetEntityTypes().Single(e => e.ClrType.Name == entityName);

            Assert.NotNull(entityType.FindAnnotation(QueryFilterAnnotation)?.Value);
        }

        [Fact]
        public async Task Allow_list_entries_exist_in_the_model_and_are_not_filtered_by_accident()
        {
            await using var db = _fixture.CreateDbContext();

            var models = db.Model.GetEntityTypes().ToList();
            var missing = AllowList.Keys
                .Where(name => models.All(e => e.ClrType.Name != name))
                .ToList();

            Assert.Empty(missing);
        }
    }
}
