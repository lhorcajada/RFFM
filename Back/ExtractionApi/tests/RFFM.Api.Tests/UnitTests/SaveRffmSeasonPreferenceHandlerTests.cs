#nullable enable
using System.Threading;
using System.Threading.Tasks;
using Moq;
using RFFM.Api.Domain.Entities.Federation;
using RFFM.Api.Features.Federation.Seasons.Commands;
using RFFM.Api.Features.Federation.Seasons.Services;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class SaveRffmSeasonPreferenceHandlerTests
    {
        [Fact]
        public async Task Handle_UpsertsPreferenceThroughService()
        {
            var serviceMock = new Mock<IRffmSeasonPreferenceService>();
            serviceMock
                .Setup(s => s.UpsertAsync("user-1", 21, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new RffmSeasonPreference("user-1", 21));

            var handler = new SaveRffmSeasonPreference.Handler(serviceMock.Object);
            await handler.Handle(new SaveRffmSeasonPreference.CommandApp("user-1", 21), CancellationToken.None);

            serviceMock.Verify(s => s.UpsertAsync("user-1", 21, It.IsAny<CancellationToken>()), Times.Once);
        }
    }
}
