#nullable enable
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Options;
using Moq;
using RFFM.Api.Domain.Entities.Federation;
using RFFM.Api.Features.Federation.Seasons.Queries;
using RFFM.Api.Features.Federation.Seasons.Services;
using RFFM.Api.Infrastructure.Options;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class GetRffmSeasonsHandlerTests
    {
        private static IOptions<RffmOptions> CreateOptions() => Options.Create(new RffmOptions
        {
            CurrentSeasonId = 22,
            SelectableSeasons =
            [
                new(22, "2026-2027"),
                new(21, "2025-2026"),
                new(20, "2024-2025"),
            ]
        });

        [Fact]
        public async Task Handle_UserWithoutPreference_ReturnsNullPreferredSeasonId()
        {
            var serviceMock = new Mock<IRffmSeasonPreferenceService>();
            serviceMock
                .Setup(s => s.GetForUserAsync("user-1", It.IsAny<CancellationToken>()))
                .ReturnsAsync((RffmSeasonPreference?)null);

            var handler = new GetRffmSeasons.Handler(serviceMock.Object, CreateOptions());
            var result = await handler.Handle(new GetRffmSeasons.QueryApp("user-1"), CancellationToken.None);

            Assert.Equal(22, result.CurrentSeasonId);
            Assert.Null(result.PreferredSeasonId);
            Assert.Equal(3, result.Seasons.Length);
        }

        [Fact]
        public async Task Handle_UserWithPreference_ReturnsPreferredSeasonId()
        {
            var serviceMock = new Mock<IRffmSeasonPreferenceService>();
            serviceMock
                .Setup(s => s.GetForUserAsync("user-1", It.IsAny<CancellationToken>()))
                .ReturnsAsync(new RffmSeasonPreference("user-1", 21));

            var handler = new GetRffmSeasons.Handler(serviceMock.Object, CreateOptions());
            var result = await handler.Handle(new GetRffmSeasons.QueryApp("user-1"), CancellationToken.None);

            Assert.Equal(22, result.CurrentSeasonId);
            Assert.Equal(21, result.PreferredSeasonId);
        }

        [Fact]
        public async Task Handle_NoUserId_ReturnsNullPreferredSeasonIdWithoutCallingService()
        {
            var serviceMock = new Mock<IRffmSeasonPreferenceService>();

            var handler = new GetRffmSeasons.Handler(serviceMock.Object, CreateOptions());
            var result = await handler.Handle(new GetRffmSeasons.QueryApp(null), CancellationToken.None);

            Assert.Null(result.PreferredSeasonId);
            serviceMock.Verify(s => s.GetForUserAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        }
    }
}
