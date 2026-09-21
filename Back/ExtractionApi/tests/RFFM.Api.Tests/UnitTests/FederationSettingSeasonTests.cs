#nullable enable
using System.Threading;
using System.Threading.Tasks;
using Moq;
using RFFM.Api.Domain.Entities.Federation;
using RFFM.Api.Features.Federation.Settings.Commands;
using RFFM.Api.Features.Federation.Settings.Models;
using RFFM.Api.Features.Federation.Settings.Services;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class FederationSettingSeasonTests
    {
        [Fact]
        public async Task Save_WithSeason_PersistsAndReturnsSeasonId()
        {
            var service = new Mock<IFederationSettingService>();
            FederationSetting? captured = null;
            service
                .Setup(s => s.CreateAsync(It.IsAny<FederationSetting>(), It.IsAny<CancellationToken>()))
                .Callback<FederationSetting, CancellationToken>((s, _) => captured = s)
                .ReturnsAsync((FederationSetting s, CancellationToken _) => s);
            var handler = new SaveFederationSettingHandler(service.Object);

            var response = await handler.Handle(
                new SaveFederationSettingCommand("u1",
                    new SaveFederationSettingRequest("c1", "Liga", "g1", "Grupo 1", "t1", "Equipo", true, 22)),
                CancellationToken.None);

            Assert.Equal(22, captured!.SeasonId);
            Assert.Equal(22, response.SeasonId);
        }

        [Fact]
        public void Update_ReplacesSeasonId()
        {
            var setting = new FederationSetting("u1", teamId: "t1", seasonId: 21);

            setting.Update(teamId: "t1", seasonId: 22);

            Assert.Equal(22, setting.SeasonId);
        }
    }
}
