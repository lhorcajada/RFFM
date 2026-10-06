#nullable enable
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using Moq;
using RFFM.Api.Features.Federation.Players.Models;
using RFFM.Api.Features.Federation.Players.Services;
using RFFM.Api.Features.Federation.Teams.Models;
using RFFM.Api.Features.Federation.Teams.Queries;
using RFFM.Api.Features.Federation.Teams.Services;
using RFFM.Api.Infrastructure.Options;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class GetParticipationSummaryHandlerTests
    {
        private const string SelectedTeamCode = "T-OWN";
        private readonly Mock<ITeamService> _teamService = new();
        private readonly Mock<IPlayerService> _playerService = new();

        public GetParticipationSummaryHandlerTests()
        {
            _teamService
                .Setup(s => s.GetTeamDetailsAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new TeamRffm
                {
                    TeamCode = SelectedTeamCode,
                    Players = [new TeamPlayerRffm { PlayerCode = "1001", Name = "PEREZ, JOSE" }]
                });
        }

        private void PlayerSheet(int season, params (string Code, string Name)[] teams)
            => _playerService
                .Setup(s => s.GetPlayerAsync("1001", season, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new Player
                {
                    PlayerId = "1001",
                    Name = "PEREZ, JOSE",
                    Competitions = teams.Select(t => new CompetitionParticipation
                    {
                        CompetitionName = "Liga",
                        GroupName = "Grupo 1",
                        TeamCode = t.Code,
                        TeamName = t.Name
                    }).ToList()
                });

        private GetParticipationSummary.ParticipationRequestHandler CreateHandler()
            => new(_teamService.Object, _playerService.Object, Options.Create(new RffmOptions()),
                new MemoryCache(new MemoryCacheOptions()));

        private Task<GetParticipationSummary.ParticipationCount[]> HandleAsync(int season)
            => CreateHandler().Handle(new GetParticipationSummary.ParticipationQueryApp("team", season), CancellationToken.None).AsTask();

        [Fact]
        public async Task Handle_ShouldIncludeCurrentAndPreviousSeasonParticipations()
        {
            PlayerSheet(22, ("T-Y", "Equipo Y"));
            PlayerSheet(21, ("T-X", "Equipo X"));

            var result = await HandleAsync(22);

            Assert.Equal(new[] { (22, "2026-2027", "Equipo Y"), (21, "2025-2026", "Equipo X") },
                result.Select(r => (r.SeasonId, r.SeasonName, r.TeamName)).ToArray());
        }

        [Fact]
        public async Task Handle_ShouldExcludeSelectedTeamInBothSeasons()
        {
            PlayerSheet(22, (SelectedTeamCode, "Propio"), ("T-Y", "Equipo Y"));
            PlayerSheet(21, (SelectedTeamCode, "Propio"));

            var result = await HandleAsync(22);

            var item = Assert.Single(result);
            Assert.Equal("Equipo Y", item.TeamName);
        }

        [Fact]
        public async Task Handle_ShouldOnlyUseRequestedSeason_WhenThereIsNoPreviousSeason()
        {
            PlayerSheet(20, ("T-Z", "Equipo Z"));

            var result = await HandleAsync(20);

            var item = Assert.Single(result);
            Assert.Equal(20, item.SeasonId);
            _playerService.Verify(s => s.GetPlayerAsync(It.IsAny<string>(), It.Is<int>(x => x != 20), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task Handle_ShouldIgnorePlayerSheetErrors()
        {
            PlayerSheet(22, ("T-Y", "Equipo Y"));
            _playerService
                .Setup(s => s.GetPlayerAsync("1001", 21, It.IsAny<CancellationToken>()))
                .ThrowsAsync(new HttpRequestException("rffm down"));

            var result = await HandleAsync(22);

            Assert.Equal(22, Assert.Single(result).SeasonId);
        }
    }
}
