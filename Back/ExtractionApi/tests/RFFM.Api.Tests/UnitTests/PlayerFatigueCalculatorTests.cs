using RFFM.Api.Features.Coaches.Players.Services;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class PlayerFatigueCalculatorTests
    {
        [Fact]
        public void NoEvents_FatigueIsZero()
        {
            var result = PlayerFatigueCalculator.Calculate(
                trainingDaysAgo: Array.Empty<int>(),
                matches: Array.Empty<(int, int)>());

            Assert.Equal(0, result.Fatigue);
            Assert.Equal(0, result.TrainingComponent);
            Assert.Equal(0, result.MatchComponent);
        }

        [Fact]
        public void TrainingToday_DecaysToFullWeight()
        {
            var result = PlayerFatigueCalculator.Calculate(
                trainingDaysAgo: new[] { 0 },
                matches: Array.Empty<(int, int)>());

            // decay(0) = 1 -> decayedTrainingCount = 1 -> TrainingComponent = 1/2*100 = 50
            Assert.Equal(50, result.TrainingComponent);
        }

        [Fact]
        public void TrainingTwoDaysAgo_DecaysToHalfWeight()
        {
            var result = PlayerFatigueCalculator.Calculate(
                trainingDaysAgo: new[] { 2 },
                matches: Array.Empty<(int, int)>());

            // decay(2) = 0.5^(2/2) = 0.5 -> decayedTrainingCount = 0.5 -> TrainingComponent = 25
            Assert.Equal(25, result.TrainingComponent);
        }

        [Fact]
        public void TwoTrainingsToday_TrainingComponentIsFull()
        {
            var result = PlayerFatigueCalculator.Calculate(
                trainingDaysAgo: new[] { 0, 0 },
                matches: Array.Empty<(int, int)>());

            Assert.Equal(100, result.TrainingComponent);
            Assert.Equal(40, result.Fatigue); // round(0.40*100 + 0.60*0)
        }

        [Fact]
        public void MatchToday_FullReferenceMinutes_MatchComponentIsFull()
        {
            var result = PlayerFatigueCalculator.Calculate(
                trainingDaysAgo: Array.Empty<int>(),
                matches: new[] { (DaysAgo: 0, MinutesPlayed: 70) });

            Assert.Equal(100, result.MatchComponent);
            Assert.Equal(60, result.Fatigue); // round(0.40*0 + 0.60*100)
        }

        [Fact]
        public void MatchTwoDaysAgo_FullReferenceMinutes_DecaysToHalfComponent()
        {
            var result = PlayerFatigueCalculator.Calculate(
                trainingDaysAgo: Array.Empty<int>(),
                matches: new[] { (DaysAgo: 2, MinutesPlayed: 70) });

            // decay(2) = 0.5 -> decayedMatchMinutes = 35 -> MatchComponent = 35/70*100 = 50
            Assert.Equal(50, result.MatchComponent);
        }

        [Fact]
        public void FullTrainingsAndFullMatch_AllToday_FatigueIsOneHundred()
        {
            var result = PlayerFatigueCalculator.Calculate(
                trainingDaysAgo: new[] { 0, 0 },
                matches: new[] { (DaysAgo: 0, MinutesPlayed: 70) });

            Assert.Equal(100, result.Fatigue);
        }

        [Fact]
        public void TrainingsAboveReference_DoNotExceedOneHundredPercentComponent()
        {
            var result = PlayerFatigueCalculator.Calculate(
                trainingDaysAgo: new[] { 0, 0, 0, 0, 0 },
                matches: Array.Empty<(int, int)>());

            Assert.Equal(100, result.TrainingComponent);
        }

        [Fact]
        public void MatchMinutesAboveReference_DoNotExceedOneHundredPercentComponent()
        {
            var result = PlayerFatigueCalculator.Calculate(
                trainingDaysAgo: Array.Empty<int>(),
                matches: new[] { (DaysAgo: 0, MinutesPlayed: 250) });

            Assert.Equal(100, result.MatchComponent);
        }

        [Fact]
        public void OldEventsBeyondTheLoadWindow_ContributeNegligibly()
        {
            // The handler never passes events older than WindowDays (14), but the calculator
            // itself must still decay them toward ~0 rather than treat them as full weight —
            // this documents that guarantee independent of how the handler filters its query.
            var result = PlayerFatigueCalculator.Calculate(
                trainingDaysAgo: new[] { 14 },
                matches: Array.Empty<(int, int)>());

            Assert.True(result.TrainingComponent < 1);
        }

        [Fact]
        public void RealProductionCase_Lucas_RecoversFromPinnedOneHundredPercent()
        {
            // Regression for the exact production bug: a player who trained Thursday (6 days
            // ago), played a 90' match Sunday (3 days ago) and trained again Tuesday (1 day
            // ago), evaluated today (Wednesday) — with the old flat 7-day-window model this
            // always read 100% regardless of the rest days already taken since. With recency
            // decay (2-day half-life) it must read ~44%, reflecting the partial recovery.
            // See design.md for the full worked calculation.
            var result = PlayerFatigueCalculator.Calculate(
                trainingDaysAgo: new[] { 6, 1 },
                matches: new[] { (DaysAgo: 3, MinutesPlayed: 90) });

            Assert.Equal(44, result.Fatigue);
            Assert.NotEqual(100, result.Fatigue);
        }

        [Fact]
        public void SameDayTrainingAndMatch_BothContributeIndependently()
        {
            // No special-casing needed (unlike the old per-day-state model): a training and a
            // match on the same day are independent additive contributions to their own
            // component, not a single "day event" where one wins.
            var result = PlayerFatigueCalculator.Calculate(
                trainingDaysAgo: new[] { 0 },
                matches: new[] { (DaysAgo: 0, MinutesPlayed: 70) });

            Assert.Equal(50, result.TrainingComponent);
            Assert.Equal(100, result.MatchComponent);
            Assert.Equal(80, result.Fatigue); // round(0.40*50 + 0.60*100)
        }
    }
}
