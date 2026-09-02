#nullable enable
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Options;
using Moq;
using RFFM.Api.Features.Federation.Clubs.Queries;
using RFFM.Api.Features.Federation.Competitions.Models;
using RFFM.Api.Features.Federation.Competitions.Services;
using RFFM.Api.Features.Federation.Players.Models;
using RFFM.Api.Features.Federation.Players.Services;
using RFFM.Api.Features.Federation.Teams.Models;
using RFFM.Api.Features.Federation.Teams.Services;
using RFFM.Api.Infrastructure.Options;
using Xunit;
using static RFFM.Api.Features.Federation.Clubs.Queries.FederationResolveTeamGroup;

namespace RFFM.Api.Tests.UnitTests
{
    public class ResolveTeamGroupHandlerTests
    {
        [Fact]
        public async Task ResolveGroupAsync_WhenClassificationScanFindsNoMatch_FallsBackUsingTheActiveSeason()
        {
            // Arrange: Strategy A (classification scan) finds nothing, forcing the fallback
            // to Strategy B (fichajugador), which must query the currently active RFFM
            // season (from RffmOptions), not a stale hardcoded one.
            const int competitionId = 12345;
            const int activeSeasonId = 22; // 2026-2027

            var teamServiceMock = new Mock<ITeamService>();
            teamServiceMock
                .Setup(s => s.GetTeamDetailsAsync("TEAM1", It.IsAny<CancellationToken>()))
                .ReturnsAsync(new TeamRffm
                {
                    TeamName = "Test Team",
                    Players = [new TeamPlayerRffm { PlayerCode = "PLAYER1" }]
                });

            var competitionServiceMock = new Mock<ICompetitionService>();
            competitionServiceMock
                .Setup(s => s.GetGroupsAsync(competitionId.ToString(), It.IsAny<CancellationToken>()))
                .ReturnsAsync([new ResponseGroup(999, "Group A", 10)]);
            competitionServiceMock
                .Setup(s => s.GetClassification(999, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new ClassificationResponse { Teams = [] });

            var playerServiceMock = new Mock<IPlayerService>();
            playerServiceMock
                .Setup(s => s.GetPlayerAsync("PLAYER1", activeSeasonId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new Player
                {
                    Competitions =
                    [
                        new CompetitionParticipation
                        {
                            TeamCode = "TEAM1",
                            GroupCode = "999",
                            GroupName = "Group A",
                            CompetitionCode = competitionId.ToString(),
                            CompetitionName = "Test Competition"
                        }
                    ]
                });

            var rffmOptions = Options.Create(new RffmOptions { CurrentSeasonId = activeSeasonId });

            // Act
            var result = await ResolveGroupAsync(
                "TEAM1",
                competitionId,
                teamServiceMock.Object,
                playerServiceMock.Object,
                competitionServiceMock.Object,
                rffmOptions,
                CancellationToken.None);

            // Assert
            Assert.NotNull(result);
            Assert.Equal("999", result!.GroupCode);
            playerServiceMock.Verify(
                s => s.GetPlayerAsync("PLAYER1", activeSeasonId, It.IsAny<CancellationToken>()),
                Times.Once);
        }
    }
}
