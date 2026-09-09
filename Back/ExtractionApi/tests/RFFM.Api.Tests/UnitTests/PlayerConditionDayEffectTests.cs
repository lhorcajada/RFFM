using RFFM.Api.Features.Coaches.Players.Services;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class PlayerConditionDayEffectTests
    {
        [Fact]
        public void Training_AppliesFitnessPlusThreeAndFatiguePlusFive()
        {
            var (fitnessDelta, fatigueDelta) = PlayerConditionDayEffect.Calculate(
                new PlayerConditionDayEffect.DayEvent(PlayerConditionDayEffect.DayOutcome.Training));

            Assert.Equal(3, fitnessDelta);
            Assert.Equal(5, fatigueDelta);
        }

        [Fact]
        public void FullMatch_70Minutes_AppliesFitnessPlusTwoAndFatiguePlusTen()
        {
            var (fitnessDelta, fatigueDelta) = PlayerConditionDayEffect.Calculate(
                new PlayerConditionDayEffect.DayEvent(PlayerConditionDayEffect.DayOutcome.Match, MatchMinutesPlayed: 70));

            Assert.Equal(2, fitnessDelta);
            Assert.Equal(10, fatigueDelta);
        }

        [Fact]
        public void HalfMatch_35Minutes_AppliesHalfTheFullMatchEffect()
        {
            var (fitnessDelta, fatigueDelta) = PlayerConditionDayEffect.Calculate(
                new PlayerConditionDayEffect.DayEvent(PlayerConditionDayEffect.DayOutcome.Match, MatchMinutesPlayed: 35));

            Assert.Equal(1, fitnessDelta);
            Assert.Equal(5, fatigueDelta);
        }

        [Fact]
        public void ZeroMinutesMatch_AppliesNoEffect_NeverNegative()
        {
            var (fitnessDelta, fatigueDelta) = PlayerConditionDayEffect.Calculate(
                new PlayerConditionDayEffect.DayEvent(PlayerConditionDayEffect.DayOutcome.Match, MatchMinutesPlayed: 0));

            Assert.Equal(0, fitnessDelta);
            Assert.Equal(0, fatigueDelta);
        }

        [Fact]
        public void MatchMinutesAboveReference_IsCappedAtFullMatchEffect()
        {
            var (fitnessDelta, fatigueDelta) = PlayerConditionDayEffect.Calculate(
                new PlayerConditionDayEffect.DayEvent(PlayerConditionDayEffect.DayOutcome.Match, MatchMinutesPlayed: 120));

            Assert.Equal(2, fitnessDelta);
            Assert.Equal(10, fatigueDelta);
        }

        [Fact]
        public void InjuryAbsence_AppliesFitnessMinusFourAndFatigueMinusSix()
        {
            var (fitnessDelta, fatigueDelta) = PlayerConditionDayEffect.Calculate(
                new PlayerConditionDayEffect.DayEvent(PlayerConditionDayEffect.DayOutcome.InjuryAbsence));

            Assert.Equal(-4, fitnessDelta);
            Assert.Equal(-2, fatigueDelta);
        }

        [Fact]
        public void Rest_AppliesFitnessMinusTwoAndFatigueMinusSix()
        {
            var (fitnessDelta, fatigueDelta) = PlayerConditionDayEffect.Calculate(
                new PlayerConditionDayEffect.DayEvent(PlayerConditionDayEffect.DayOutcome.Rest));

            Assert.Equal(-2, fitnessDelta);
            Assert.Equal(-2, fatigueDelta);
        }

        [Fact]
        public void DefaultDayEvent_WithNoOutcomeSpecified_BehavesAsRest()
        {
            var (fitnessDelta, fatigueDelta) = PlayerConditionDayEffect.Calculate(default);

            Assert.Equal(-2, fitnessDelta);
            Assert.Equal(-2, fatigueDelta);
        }
    }
}
