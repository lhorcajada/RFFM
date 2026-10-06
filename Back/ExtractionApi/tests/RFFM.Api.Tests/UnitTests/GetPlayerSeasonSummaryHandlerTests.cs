#nullable enable
using System.Linq;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using Moq;
using RFFM.Api.Features.Federation.Players.Models;
using RFFM.Api.Features.Federation.Players.Queries;
using RFFM.Api.Features.Federation.Players.Services;
using RFFM.Api.Infrastructure.Options;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class GetPlayerSeasonSummaryHandlerTests
    {
        private readonly Mock<IPlayerService> _playerService = new();

        private void Sheet(int season, int called, params CompetitionParticipation[] teams)
            => _playerService
                .Setup(s => s.GetPlayerAsync("1001", season, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new Player
                {
                    PlayerId = "1001",
                    Matches = new MatchStatistics { Called = called, Starter = 5, Played = called, TotalGoals = 2 },
                    Cards = new CardStatistics { Yellow = 1 },
                    Competitions = teams.ToList()
                });

        private static CompetitionParticipation Team(string competition, string team, int points)
            => new() { CompetitionName = competition, GroupName = "Grupo 1", TeamName = team, TeamPoints = points, TeamPosition = 3 };

        private Task<GetPlayerSeasonSummary.PlayerSeasonSummary[]> HandleAsync(int season)
            => new GetPlayerSeasonSummary.Handler(_playerService.Object, Options.Create(new RffmOptions()),
                    new MemoryCache(new MemoryCacheOptions()))
                .Handle(new GetPlayerSeasonSummary.QueryApp("1001", season), CancellationToken.None)
                .AsTask();

        [Fact]
        public async Task Handle_ShouldReturnRequestedAndPreviousSeasonInDescendingOrder()
        {
            Sheet(22, 4, Team("SEGUNDA CADETE", "FEPE D", 7));
            Sheet(21, 20, Team("PRIMERA INFANTIL", "FEPE B", 41), Team("SEGUNDA INFANTIL", "FEPE E", 30));

            var result = await HandleAsync(22);

            Assert.Equal(new[] { (22, "2026-2027"), (21, "2025-2026") }, result.Select(r => (r.SeasonId, r.SeasonName)).ToArray());
            Assert.Equal(4, result[0].Stats.Called);
            Assert.Equal(2, result[1].Teams.Count);
        }

        [Fact]
        public async Task Handle_ShouldMapTeamsWithCategoryAndPoints()
        {
            Sheet(22, 4, Team("SEGUNDA CADETE", "FEPE D", 7));

            var result = await HandleAsync(22);

            var team = Assert.Single(result[0].Teams);
            Assert.Equal("SEGUNDA CADETE", team.CompetitionName);
            Assert.Equal("FEPE D", team.TeamName);
            Assert.Equal(7, team.TeamPoints);
            Assert.Equal(3, team.TeamPosition);
        }

        [Fact]
        public async Task Handle_ShouldOmitSeason_WhenSheetFails()
        {
            Sheet(22, 4, Team("SEGUNDA CADETE", "FEPE D", 7));
            _playerService
                .Setup(s => s.GetPlayerAsync("1001", 21, It.IsAny<CancellationToken>()))
                .ThrowsAsync(new HttpRequestException("rffm down"));

            var result = await HandleAsync(22);

            Assert.Equal(22, Assert.Single(result).SeasonId);
        }

        [Fact]
        public async Task Handle_ShouldOmitSeason_WhenSheetHasNoTeamsAndNoCallUps()
        {
            Sheet(22, 0);
            Sheet(21, 20, Team("PRIMERA INFANTIL", "FEPE B", 41));

            var result = await HandleAsync(22);

            Assert.Equal(21, Assert.Single(result).SeasonId);
        }

        [Fact]
        public async Task Handle_ShouldOnlyUseRequestedSeason_WhenThereIsNoPreviousSeason()
        {
            Sheet(20, 10, Team("ALEVIN", "FEPE A", 12));

            var result = await HandleAsync(20);

            Assert.Equal(20, Assert.Single(result).SeasonId);
        }
    }
}
