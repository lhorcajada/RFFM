using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Features.Coaches.Players.Services;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class TeamPlayerConditionTests
    {
        [Fact]
        public void CreateInitial_SetsFitnessThirtyAndFatigueTwenty_AtGivenDate()
        {
            var asOfDate = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

            var condition = TeamPlayerCondition.CreateInitial("team-player-1", asOfDate);

            Assert.Equal("team-player-1", condition.TeamPlayerId);
            Assert.Equal(PlayerConditionDayEffect.InitialFitness, condition.PhysicalFitness);
            Assert.Equal(PlayerConditionDayEffect.InitialFatigue, condition.Fatigue);
            Assert.Equal(asOfDate, condition.LastCalculatedDate);
        }

        [Fact]
        public void Advance_ClampsFitnessAndFatigueAtUpperBoundOfOneHundred()
        {
            var condition = TeamPlayerCondition.CreateInitial("team-player-1", DateTime.UtcNow.Date);

            condition.Advance(fitnessDelta: 1000, fatigueDelta: 1000, newDate: DateTime.UtcNow.Date.AddDays(1));

            Assert.Equal(100, condition.PhysicalFitness);
            Assert.Equal(100, condition.Fatigue);
        }

        [Fact]
        public void Advance_ClampsFitnessAndFatigueAtLowerBoundOfZero()
        {
            var condition = TeamPlayerCondition.CreateInitial("team-player-1", DateTime.UtcNow.Date);

            condition.Advance(fitnessDelta: -1000, fatigueDelta: -1000, newDate: DateTime.UtcNow.Date.AddDays(1));

            Assert.Equal(0, condition.PhysicalFitness);
            Assert.Equal(0, condition.Fatigue);
        }

        [Fact]
        public void Advance_UpdatesLastCalculatedDateToTheGivenDate()
        {
            var condition = TeamPlayerCondition.CreateInitial("team-player-1", DateTime.UtcNow.Date);
            var newDate = DateTime.UtcNow.Date.AddDays(3);

            condition.Advance(fitnessDelta: 1, fatigueDelta: 1, newDate: newDate);

            Assert.Equal(newDate, condition.LastCalculatedDate);
        }
    }
}
