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
        public void InjuryAbsence_AppliesFitnessMinusFourAndFatigueMinusFourPointSixFour()
        {
            var (fitnessDelta, fatigueDelta) = PlayerConditionDayEffect.Calculate(
                new PlayerConditionDayEffect.DayEvent(PlayerConditionDayEffect.DayOutcome.InjuryAbsence));

            Assert.Equal(-4, fitnessDelta);
            Assert.Equal(-4.64, fatigueDelta);
        }

        [Fact]
        public void Rest_AppliesFitnessMinusTwoAndFatigueMinusFourPointSixFour()
        {
            var (fitnessDelta, fatigueDelta) = PlayerConditionDayEffect.Calculate(
                new PlayerConditionDayEffect.DayEvent(PlayerConditionDayEffect.DayOutcome.Rest));

            Assert.Equal(-2, fitnessDelta);
            Assert.Equal(-4.64, fatigueDelta);
        }

        [Fact]
        public void DefaultDayEvent_WithNoOutcomeSpecified_BehavesAsRest()
        {
            var (fitnessDelta, fatigueDelta) = PlayerConditionDayEffect.Calculate(default);

            Assert.Equal(-2, fitnessDelta);
            Assert.Equal(-4.64, fatigueDelta);
        }

        [Fact]
        public void ReferenceWeeklyLoad_TwoTrainingsAndOneSixtyMinuteMatch_FatigueStaysRoughlyFlat()
        {
            // 2 trainings + 1 match (60 min) + 4 rest days = one reference "plena forma" week.
            // The whole point of calibrating RestFatigueDelta to this load is that a player who
            // keeps this exact rhythm indefinitely should NOT see Cansancio climb to the 100
            // cap — it should hover near where it started.
            double fatigue = 0;
            fatigue += PlayerConditionDayEffect.Calculate(new(PlayerConditionDayEffect.DayOutcome.Training)).FatigueDelta;
            fatigue += PlayerConditionDayEffect.Calculate(new(PlayerConditionDayEffect.DayOutcome.Match, 60)).FatigueDelta;
            fatigue += PlayerConditionDayEffect.Calculate(new(PlayerConditionDayEffect.DayOutcome.Training)).FatigueDelta;
            for (var i = 0; i < 4; i++)
                fatigue += PlayerConditionDayEffect.Calculate(new(PlayerConditionDayEffect.DayOutcome.Rest)).FatigueDelta;

            Assert.InRange(fatigue, -1, 1);
        }
    }
}
