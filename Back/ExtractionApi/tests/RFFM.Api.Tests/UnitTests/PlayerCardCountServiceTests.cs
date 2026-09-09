#nullable enable
using RFFM.Api.Features.Coaches.Players.Services;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class PlayerCardCountServiceTests
    {
        [Fact]
        public void CountCards_WithSeveralOwnAndRivalCards_CountsOnlyOwnMatchingType()
        {
            var teamPlayerId = "tp-1";
            var cardsJson = $"[{{\"teamPlayerId\":\"{teamPlayerId}\",\"cardType\":\"yellow\"}}," +
                             $"{{\"teamPlayerId\":\"{teamPlayerId}\",\"cardType\":\"yellow\"}}," +
                             $"{{\"teamPlayerId\":\"{teamPlayerId}\",\"cardType\":\"red\"}}," +
                             $"{{\"teamPlayerId\":\"rival-1\",\"cardType\":\"yellow\",\"isRivalPlayer\":true}}]";

            Assert.Equal(2, PlayerCardCountService.CountCards(cardsJson, teamPlayerId, "yellow"));
            Assert.Equal(1, PlayerCardCountService.CountCards(cardsJson, teamPlayerId, "red"));
            Assert.True(PlayerCardCountService.HasRedCard(cardsJson, teamPlayerId));
        }

        [Fact]
        public void CountCards_IsCaseInsensitiveOnCardType()
        {
            var teamPlayerId = "tp-1";
            var cardsJson = $"[{{\"teamPlayerId\":\"{teamPlayerId}\",\"cardType\":\"Yellow\"}}]";

            Assert.Equal(1, PlayerCardCountService.CountCards(cardsJson, teamPlayerId, "yellow"));
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        public void CountCards_WithNullOrEmptyJson_ReturnsZero(string? cardsJson)
        {
            Assert.Equal(0, PlayerCardCountService.CountCards(cardsJson, "tp-1", "yellow"));
            Assert.False(PlayerCardCountService.HasRedCard(cardsJson, "tp-1"));
        }

        [Fact]
        public void CountCards_WithMalformedJson_ReturnsZeroInsteadOfThrowing()
        {
            Assert.Equal(0, PlayerCardCountService.CountCards("{not-a-valid-array}", "tp-1", "yellow"));
            Assert.False(PlayerCardCountService.HasRedCard("{not-a-valid-array}", "tp-1"));
        }

        [Fact]
        public void CountCards_PlayerWithNoCards_ReturnsZero()
        {
            var cardsJson = "[{\"teamPlayerId\":\"someone-else\",\"cardType\":\"red\"}]";

            Assert.Equal(0, PlayerCardCountService.CountCards(cardsJson, "tp-1", "red"));
            Assert.False(PlayerCardCountService.HasRedCard(cardsJson, "tp-1"));
        }
    }
}
