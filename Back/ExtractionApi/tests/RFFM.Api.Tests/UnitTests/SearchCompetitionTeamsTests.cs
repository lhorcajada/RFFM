#nullable enable
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Moq;
using RFFM.Api.Features.Federation.Competitions.Models;
using RFFM.Api.Features.Federation.Competitions.Queries;
using RFFM.Api.Features.Federation.Competitions.Services;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class SearchCompetitionTeamsTests
    {
        private const int CompetitionId = 100;

        private static ClassificationResponse Classification(params (string Id, string Name)[] teams) =>
            new() { Teams = teams.Select(t => new TeamResponse { TeamId = t.Id, TeamName = t.Name }).ToList() };

        private static Mock<ICompetitionService> ServiceWith(params (int GroupId, string GroupName, ClassificationResponse? Classification)[] groups)
        {
            var service = new Mock<ICompetitionService>();
            service
                .Setup(s => s.GetGroupsAsync(CompetitionId.ToString(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(groups.Select(g => new ResponseGroup(g.GroupId, g.GroupName, 20)).ToArray());
            service
                .Setup(s => s.GetCompetitionsAsync(It.IsAny<int?>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync([new ResponseCompetition(CompetitionId, "Liga Alevín", 60, "Alevín")]);
            foreach (var g in groups)
            {
                if (g.Classification is null)
                    service.Setup(s => s.GetClassification(g.GroupId, It.IsAny<CancellationToken>())).ThrowsAsync(new InvalidOperationException("boom"));
                else
                    service.Setup(s => s.GetClassification(g.GroupId, It.IsAny<CancellationToken>())).ReturnsAsync(g.Classification);
            }
            return service;
        }

        private static Task<SearchCompetitionTeams.ResponseTeamMatch[]> Search(Mock<ICompetitionService> service, string name, int? season = 22) =>
            new SearchCompetitionTeams.RequestHandler(service.Object)
                .Handle(new SearchCompetitionTeams.QueryApp(CompetitionId, name, season), CancellationToken.None)
                .AsTask();

        [Fact]
        public async Task Handle_TeamInSecondGroup_ReturnsItAndStopsSearching()
        {
            var service = ServiceWith(
                (1, "Grupo 1", Classification(("a", "CD Otro"))),
                (2, "Grupo 2", Classification(("b", "AD Alcorcón B"))),
                (3, "Grupo 3", Classification(("c", "AD Alcorcón C"))));

            var result = await Search(service, "alcorcon b");

            var match = Assert.Single(result);
            Assert.Equal("b", match.TeamCode);
            Assert.Equal("AD Alcorcón B", match.TeamName);
            Assert.Equal("2", match.GroupCode);
            Assert.Equal("Grupo 2", match.GroupName);
            Assert.Equal(CompetitionId.ToString(), match.CompetitionCode);
            Assert.Equal("Liga Alevín", match.CompetitionName);
            service.Verify(s => s.GetClassification(3, It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task Handle_MatchesIgnoringCaseAndAccents()
        {
            var service = ServiceWith((1, "Grupo 1", Classification(("a", "AD ALCORCÓN"))));

            var result = await Search(service, "alcorcon");

            Assert.Single(result);
        }

        [Fact]
        public async Task Handle_SeveralTeamsInTheSameGroup_ReturnsAllOfThem()
        {
            var service = ServiceWith((1, "Grupo 1", Classification(("a", "Getafe A"), ("b", "Getafe B"), ("c", "Leganés"))));

            var result = await Search(service, "getafe");

            Assert.Equal(new[] { "a", "b" }, result.Select(r => r.TeamCode).ToArray());
        }

        [Fact]
        public async Task Handle_TeamInNoGroup_ReturnsEmpty()
        {
            var service = ServiceWith(
                (1, "Grupo 1", Classification(("a", "CD Otro"))),
                (2, "Grupo 2", Classification(("b", "CD Más"))));

            var result = await Search(service, "inexistente");

            Assert.Empty(result);
            service.Verify(s => s.GetClassification(2, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task Handle_GroupWhoseClassificationFails_IsSkipped()
        {
            var service = ServiceWith(
                (1, "Grupo 1", null),
                (2, "Grupo 2", Classification(("b", "AD Alcorcón"))));

            var result = await Search(service, "alcorcon");

            Assert.Equal("2", Assert.Single(result).GroupCode);
        }

        [Fact]
        public async Task Handle_BlankName_ReturnsEmptyWithoutCallingTheFederation()
        {
            var service = ServiceWith((1, "Grupo 1", Classification(("a", "CD Otro"))));

            var result = await Search(service, "  ");

            Assert.Empty(result);
            service.Verify(s => s.GetGroupsAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task Handle_UsesTheRequestedSeasonToResolveTheCompetitionName()
        {
            var service = ServiceWith((1, "Grupo 1", Classification(("a", "CD Otro"))));

            await Search(service, "otro", season: 21);

            service.Verify(s => s.GetCompetitionsAsync(21, It.IsAny<CancellationToken>()), Times.Once);
        }
    }
}
