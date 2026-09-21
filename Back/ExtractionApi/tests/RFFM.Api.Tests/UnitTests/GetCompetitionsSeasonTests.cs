#nullable enable
using System.Threading;
using System.Threading.Tasks;
using Moq;
using RFFM.Api.Features.Federation.Competitions.Queries;
using RFFM.Api.Features.Federation.Competitions.Services;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class GetCompetitionsSeasonTests
    {
        [Fact]
        public async Task Handle_WithSeason_RequestsCompetitionsForThatSeason()
        {
            var service = new Mock<ICompetitionService>();
            service
                .Setup(s => s.GetCompetitionsAsync(It.IsAny<int?>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync([new ResponseCompetition(1, "Liga", 60, "Alevín")]);
            var handler = new GetCompetitions.RequestHandler(service.Object);

            await handler.Handle(new GetCompetitions.QueryApp(20), CancellationToken.None);

            service.Verify(s => s.GetCompetitionsAsync(20, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task Handle_WithoutSeason_FallsBackToServiceDefault()
        {
            var service = new Mock<ICompetitionService>();
            service
                .Setup(s => s.GetCompetitionsAsync(It.IsAny<int?>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync([]);
            var handler = new GetCompetitions.RequestHandler(service.Object);

            await handler.Handle(new GetCompetitions.QueryApp(null), CancellationToken.None);

            service.Verify(s => s.GetCompetitionsAsync(null, It.IsAny<CancellationToken>()), Times.Once);
        }
    }
}
