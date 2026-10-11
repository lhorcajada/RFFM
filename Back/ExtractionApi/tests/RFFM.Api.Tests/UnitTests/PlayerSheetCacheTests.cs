#nullable enable
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Caching.Memory;
using Moq;
using RFFM.Api.Features.Federation.Players.Models;
using RFFM.Api.Features.Federation.Players.Queries;
using RFFM.Api.Features.Federation.Players.Services;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class PlayerSheetCacheTests
    {
        private readonly Mock<IPlayerService> _playerService = new();
        private readonly MemoryCache _cache = new(new MemoryCacheOptions());

        private Task<Player?> GetSheetAsync()
            => _cache.GetPlayerSheetOrDefaultAsync(_playerService.Object, "1001", 22, CancellationToken.None);

        [Fact]
        public async Task GetPlayerSheetOrDefault_ShouldRetryOnNextCall_WhenSheetCouldNotBeLoaded()
        {
            _playerService
                .SetupSequence(s => s.GetPlayerAsync("1001", 22, It.IsAny<CancellationToken>()))
                .ReturnsAsync((Player?)null)
                .ReturnsAsync(new Player { PlayerId = "1001" });

            await GetSheetAsync();
            var second = await GetSheetAsync();

            Assert.Equal("1001", second?.PlayerId);
        }

        [Fact]
        public async Task GetPlayerSheetOrDefault_ShouldRetryOnNextCall_WhenServiceThrows()
        {
            _playerService
                .SetupSequence(s => s.GetPlayerAsync("1001", 22, It.IsAny<CancellationToken>()))
                .ThrowsAsync(new HttpRequestException("rffm caída"))
                .ReturnsAsync(new Player { PlayerId = "1001" });

            await GetSheetAsync();
            var second = await GetSheetAsync();

            Assert.Equal("1001", second?.PlayerId);
        }

        [Fact]
        public async Task GetPlayerSheetOrDefault_ShouldReuseLoadedSheet()
        {
            _playerService
                .Setup(s => s.GetPlayerAsync("1001", 22, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new Player { PlayerId = "1001" });

            await GetSheetAsync();
            await GetSheetAsync();

            _playerService.Verify(s => s.GetPlayerAsync("1001", 22, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task GetPlayerHandler_ShouldReuseSheetAlreadyLoadedForSeasonSummary()
        {
            _playerService
                .Setup(s => s.GetPlayerAsync("1001", 22, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new Player { PlayerId = "1001" });
            await GetSheetAsync();

            var player = await new FederationGetPlayer.RequestHandler(_playerService.Object, _cache)
                .Handle(new FederationGetPlayer.PlayerQueryApp("1001", 22), CancellationToken.None);

            Assert.Equal("1001", player?.PlayerId);
            _playerService.Verify(s => s.GetPlayerAsync("1001", 22, It.IsAny<CancellationToken>()), Times.Once);
        }
    }
}
