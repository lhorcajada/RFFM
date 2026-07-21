#nullable enable
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using RFFM.Api.Domain.Entities.Formations;
using RFFM.Api.Features.Coaches.Lineup;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Regression test for a production bug: the "Alineación ideal" tab in Coach/Squad saved
    /// correctly but reloading the page (or switching back to the tab) always showed 404, so the
    /// saved lineup never came back.
    ///
    /// Root cause: TeamIdealLineup.SeasonId is a non-nullable string. When no season is supplied,
    /// SaveTeamIdealLineup.Handler persists the sentinel SeasonId = string.Empty (req.SeasonId ??
    /// string.Empty), but GetTeamIdealLineup.Handler filtered with
    /// `l.SeasonId == request.SeasonId` without normalizing -- when the frontend omits seasonId,
    /// request.SeasonId is null, EF translates that to `SeasonId IS NULL`, which never matches the
    /// row stored with SeasonId = "". The handler returned null and the endpoint answered 404.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class SaveAndGetTeamIdealLineupTests
    {
        private readonly PostgresContainerFixture _fixture;

        public SaveAndGetTeamIdealLineupTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        [Fact]
        public async Task SaveWithoutSeasonId_ThenGetWithoutSeasonId_ReturnsSavedLineup()
        {
            // Arrange
            var teamId = $"team-{Guid.NewGuid():N}";

            await using var setupDb = _fixture.CreateDbContext();
            var formation = Formation.Create($"F-{Guid.NewGuid():N}".Substring(0, 12));
            setupDb.Formations.Add(formation);
            await setupDb.SaveChangesAsync();

            // Act - save an ideal lineup without a seasonId (mirrors the frontend omitting the
            // query param).
            await using var saveDb = _fixture.CreateDbContext();
            var saveHandler = new SaveTeamIdealLineup.Handler(saveDb);
            var saveRequest = new SaveTeamIdealLineup.SaveLineupRequest(
                formation.Id,
                null,
                new[] { new SaveTeamIdealLineup.SlotRequest(0, null) });

            await saveHandler.Handle(
                new SaveTeamIdealLineup.SaveLineupCommand(teamId, saveRequest),
                CancellationToken.None);

            // Act - read it back without a seasonId, exactly as the frontend does on reload.
            await using var getDb = _fixture.CreateDbContext();
            var getHandler = new GetTeamIdealLineup.Handler(getDb);
            var result = await getHandler.Handle(
                new GetTeamIdealLineup.GetTeamIdealLineupQuery(teamId, null),
                CancellationToken.None);

            // Assert
            Assert.NotNull(result);
            Assert.Equal(formation.Id, result!.FormationId);
        }

        [Fact]
        public async Task SaveWithoutSeasonId_TwiceRunning_UpdatesExistingRowInsteadOfDuplicating()
        {
            // Arrange
            var teamId = $"team-{Guid.NewGuid():N}";

            await using var setupDb = _fixture.CreateDbContext();
            var formationA = Formation.Create($"A-{Guid.NewGuid():N}".Substring(0, 12));
            var formationB = Formation.Create($"B-{Guid.NewGuid():N}".Substring(0, 12));
            setupDb.Formations.AddRange(formationA, formationB);
            await setupDb.SaveChangesAsync();

            // Act - save twice without seasonId; the second save must update the same row.
            await using var saveDb1 = _fixture.CreateDbContext();
            var saveHandler1 = new SaveTeamIdealLineup.Handler(saveDb1);
            var firstResponse = await saveHandler1.Handle(
                new SaveTeamIdealLineup.SaveLineupCommand(
                    teamId,
                    new SaveTeamIdealLineup.SaveLineupRequest(formationA.Id, null, Array.Empty<SaveTeamIdealLineup.SlotRequest>())),
                CancellationToken.None);

            await using var saveDb2 = _fixture.CreateDbContext();
            var saveHandler2 = new SaveTeamIdealLineup.Handler(saveDb2);
            var secondResponse = await saveHandler2.Handle(
                new SaveTeamIdealLineup.SaveLineupCommand(
                    teamId,
                    new SaveTeamIdealLineup.SaveLineupRequest(formationB.Id, null, Array.Empty<SaveTeamIdealLineup.SlotRequest>())),
                CancellationToken.None);

            // Assert - same row id, updated formation, no duplicate created.
            Assert.Equal(firstResponse.Id, secondResponse.Id);
            Assert.Equal(formationB.Id, secondResponse.FormationId);

            await using var verifyDb = _fixture.CreateDbContext();
            var count = verifyDb.TeamIdealLineups.Count(l => l.TeamId == teamId);
            Assert.Equal(1, count);
        }
    }
}
