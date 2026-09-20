using RFFM.Api.Features.Coaches.Players.Services;
using RFFM.Api.Features.Coaches.SportEvents.Queries;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class PlayerFatigueCalculatorTests
    {
        private static readonly string[] NoTypes = Array.Empty<string>();
        private const int MatchEventTypeId = SportEventsConstants.MatchEventTypeId;
        private const int FriendlyEventTypeId = SportEventsConstants.FriendlyEventTypeId;

        [Fact]
        public void NoEvents_FatigueIsZero()
        {
            var result = PlayerFatigueCalculator.Calculate(
                trainings: Array.Empty<(string, DateTime?, int, IReadOnlyList<string>)>(),
                matches: Array.Empty<(string, DateTime?, int, int, int)>());

            Assert.Equal(0, result.Fatigue);
            Assert.Equal(0, result.TrainingComponent);
            Assert.Equal(0, result.MatchComponent);
        }

        [Fact]
        public void TrainingToday_DecaysToFullWeight()
        {
            // Untyped training (no TrainingTypes) keeps the pre-change neutral weight (1.00),
            // matching the exact result the old flat int-based signature produced.
            var result = PlayerFatigueCalculator.Calculate(
                trainings: new[] { (EventId: "ev", EventDate: (DateTime?)null, DaysAgo: 0, TrainingTypes: (IReadOnlyList<string>)NoTypes) },
                matches: Array.Empty<(string, DateTime?, int, int, int)>());

            // decay(0) = 1 -> decayedTrainingCount = 1 -> TrainingComponent = 1/2*100 = 50
            Assert.Equal(50, result.TrainingComponent);
        }

        [Fact]
        public void TrainingTwoDaysAgo_DecaysToHalfWeight()
        {
            var result = PlayerFatigueCalculator.Calculate(
                trainings: new[] { (EventId: "ev", EventDate: (DateTime?)null, DaysAgo: 2, TrainingTypes: (IReadOnlyList<string>)NoTypes) },
                matches: Array.Empty<(string, DateTime?, int, int, int)>());

            // decay(2) = 0.5^(2/2) = 0.5 -> decayedTrainingCount = 0.5 -> TrainingComponent = 25
            Assert.Equal(25, result.TrainingComponent);
        }

        [Fact]
        public void TwoTrainingsToday_TrainingComponentIsFull()
        {
            var result = PlayerFatigueCalculator.Calculate(
                trainings: new[]
                {
                    (EventId: "ev", EventDate: (DateTime?)null, DaysAgo: 0, TrainingTypes: (IReadOnlyList<string>)NoTypes),
                    (EventId: "ev", EventDate: (DateTime?)null, DaysAgo: 0, TrainingTypes: (IReadOnlyList<string>)NoTypes),
                },
                matches: Array.Empty<(string, DateTime?, int, int, int)>());

            Assert.Equal(100, result.TrainingComponent);
            Assert.Equal(40, result.Fatigue); // round(0.40*100 + 0.60*0)
        }

        [Fact]
        public void MatchToday_FullReferenceMinutes_MatchComponentIsFull()
        {
            var result = PlayerFatigueCalculator.Calculate(
                trainings: Array.Empty<(string, DateTime?, int, IReadOnlyList<string>)>(),
                matches: new[] { (EventId: "ev", EventDate: (DateTime?)null, DaysAgo: 0, MinutesPlayed: 70, EventTypeId: MatchEventTypeId) });

            Assert.Equal(100, result.MatchComponent);
            Assert.Equal(60, result.Fatigue); // round(0.40*0 + 0.60*100)
        }

        [Fact]
        public void MatchTwoDaysAgo_FullReferenceMinutes_DecaysToHalfComponent()
        {
            var result = PlayerFatigueCalculator.Calculate(
                trainings: Array.Empty<(string, DateTime?, int, IReadOnlyList<string>)>(),
                matches: new[] { (EventId: "ev", EventDate: (DateTime?)null, DaysAgo: 2, MinutesPlayed: 70, EventTypeId: MatchEventTypeId) });

            // decay(2) = 0.5 -> decayedMatchMinutes = 35 -> MatchComponent = 35/70*100 = 50
            Assert.Equal(50, result.MatchComponent);
        }

        [Fact]
        public void FullTrainingsAndFullMatch_AllToday_FatigueIsOneHundred()
        {
            var result = PlayerFatigueCalculator.Calculate(
                trainings: new[]
                {
                    (EventId: "ev", EventDate: (DateTime?)null, DaysAgo: 0, TrainingTypes: (IReadOnlyList<string>)NoTypes),
                    (EventId: "ev", EventDate: (DateTime?)null, DaysAgo: 0, TrainingTypes: (IReadOnlyList<string>)NoTypes),
                },
                matches: new[] { (EventId: "ev", EventDate: (DateTime?)null, DaysAgo: 0, MinutesPlayed: 70, EventTypeId: MatchEventTypeId) });

            Assert.Equal(100, result.Fatigue);
        }

        [Fact]
        public void TrainingsAboveReference_DoNotExceedOneHundredPercentComponent()
        {
            var result = PlayerFatigueCalculator.Calculate(
                trainings: Enumerable.Range(0, 5)
                    .Select(_ => (EventId: "ev", EventDate: (DateTime?)null, DaysAgo: 0, TrainingTypes: (IReadOnlyList<string>)NoTypes))
                    .ToArray(),
                matches: Array.Empty<(string, DateTime?, int, int, int)>());

            Assert.Equal(100, result.TrainingComponent);
        }

        [Fact]
        public void MatchMinutesAboveReference_DoNotExceedOneHundredPercentComponent()
        {
            var result = PlayerFatigueCalculator.Calculate(
                trainings: Array.Empty<(string, DateTime?, int, IReadOnlyList<string>)>(),
                matches: new[] { (EventId: "ev", EventDate: (DateTime?)null, DaysAgo: 0, MinutesPlayed: 250, EventTypeId: MatchEventTypeId) });

            Assert.Equal(100, result.MatchComponent);
        }

        [Fact]
        public void OldEventsBeyondTheLoadWindow_ContributeNegligibly()
        {
            // The handler never passes events older than WindowDays (14), but the calculator
            // itself must still decay them toward ~0 rather than treat them as full weight —
            // this documents that guarantee independent of how the handler filters its query.
            var result = PlayerFatigueCalculator.Calculate(
                trainings: new[] { (EventId: "ev", EventDate: (DateTime?)null, DaysAgo: 14, TrainingTypes: (IReadOnlyList<string>)NoTypes) },
                matches: Array.Empty<(string, DateTime?, int, int, int)>());

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
                trainings: new[]
                {
                    (EventId: "ev", EventDate: (DateTime?)null, DaysAgo: 6, TrainingTypes: (IReadOnlyList<string>)NoTypes),
                    (EventId: "ev", EventDate: (DateTime?)null, DaysAgo: 1, TrainingTypes: (IReadOnlyList<string>)NoTypes),
                },
                matches: new[] { (EventId: "ev", EventDate: (DateTime?)null, DaysAgo: 3, MinutesPlayed: 90, EventTypeId: MatchEventTypeId) });

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
                trainings: new[] { (EventId: "ev", EventDate: (DateTime?)null, DaysAgo: 0, TrainingTypes: (IReadOnlyList<string>)NoTypes) },
                matches: new[] { (EventId: "ev", EventDate: (DateTime?)null, DaysAgo: 0, MinutesPlayed: 70, EventTypeId: MatchEventTypeId) });

            Assert.Equal(50, result.TrainingComponent);
            Assert.Equal(100, result.MatchComponent);
            Assert.Equal(80, result.Fatigue); // round(0.40*50 + 0.60*100)
        }

        // ── Ponderación por tipo de entrenamiento (Decisión 1: Físico 1.00 > Táctico 0.70 > Técnico 0.40) ──

        [Fact]
        public void FisicoTraining_WeighsMoreThanTecnicoTraining_SameDaysAgo()
        {
            var fisicoResult = PlayerFatigueCalculator.Calculate(
                trainings: new[] { (EventId: "ev", EventDate: (DateTime?)null, DaysAgo: 0, TrainingTypes: (IReadOnlyList<string>)new[] { "Fisico" }) },
                matches: Array.Empty<(string, DateTime?, int, int, int)>());
            var tecnicoResult = PlayerFatigueCalculator.Calculate(
                trainings: new[] { (EventId: "ev", EventDate: (DateTime?)null, DaysAgo: 0, TrainingTypes: (IReadOnlyList<string>)new[] { "Tecnico" }) },
                matches: Array.Empty<(string, DateTime?, int, int, int)>());

            Assert.True(fisicoResult.TrainingComponent > tecnicoResult.TrainingComponent);
        }

        [Fact]
        public void LeagueMatch_WeighsMoreThanFriendlyMatch_SameMinutes()
        {
            var leagueResult = PlayerFatigueCalculator.Calculate(
                trainings: Array.Empty<(string, DateTime?, int, IReadOnlyList<string>)>(),
                matches: new[] { (EventId: "ev", EventDate: (DateTime?)null, DaysAgo: 0, MinutesPlayed: 70, EventTypeId: MatchEventTypeId) });
            var friendlyResult = PlayerFatigueCalculator.Calculate(
                trainings: Array.Empty<(string, DateTime?, int, IReadOnlyList<string>)>(),
                matches: new[] { (EventId: "ev", EventDate: (DateTime?)null, DaysAgo: 0, MinutesPlayed: 70, EventTypeId: FriendlyEventTypeId) });

            Assert.True(leagueResult.MatchComponent > friendlyResult.MatchComponent);
        }

        [Fact]
        public void SessionWithTwoTrainingTypes_WeighsAsAverageOfBoth()
        {
            var combinedResult = PlayerFatigueCalculator.Calculate(
                trainings: new[] { (EventId: "ev", EventDate: (DateTime?)null, DaysAgo: 0, TrainingTypes: (IReadOnlyList<string>)new[] { "Fisico", "Tecnico" }) },
                matches: Array.Empty<(string, DateTime?, int, int, int)>());
            var fisicoOnlyResult = PlayerFatigueCalculator.Calculate(
                trainings: new[] { (EventId: "ev", EventDate: (DateTime?)null, DaysAgo: 0, TrainingTypes: (IReadOnlyList<string>)new[] { "Fisico" }) },
                matches: Array.Empty<(string, DateTime?, int, int, int)>());
            var tecnicoOnlyResult = PlayerFatigueCalculator.Calculate(
                trainings: new[] { (EventId: "ev", EventDate: (DateTime?)null, DaysAgo: 0, TrainingTypes: (IReadOnlyList<string>)new[] { "Tecnico" }) },
                matches: Array.Empty<(string, DateTime?, int, int, int)>());

            // (Fisico=1.00 + Tecnico=0.40) / 2 = 0.70 -> halfway between the two single-type components.
            Assert.True(combinedResult.TrainingComponent > tecnicoOnlyResult.TrainingComponent);
            Assert.True(combinedResult.TrainingComponent < fisicoOnlyResult.TrainingComponent);
        }

        [Fact]
        public void SessionWithoutTrainingTypes_WeighsNeutral_SameAsUntyped()
        {
            // Retrocompat: a training with an empty TrainingTypes list must produce the exact
            // same TrainingComponent as the pre-change model (peso neutro 1.00).
            var untypedResult = PlayerFatigueCalculator.Calculate(
                trainings: new[] { (EventId: "ev", EventDate: (DateTime?)null, DaysAgo: 0, TrainingTypes: (IReadOnlyList<string>)NoTypes) },
                matches: Array.Empty<(string, DateTime?, int, int, int)>());
            var fisicoResult = PlayerFatigueCalculator.Calculate(
                trainings: new[] { (EventId: "ev", EventDate: (DateTime?)null, DaysAgo: 0, TrainingTypes: (IReadOnlyList<string>)new[] { "Fisico" }) },
                matches: Array.Empty<(string, DateTime?, int, int, int)>());

            Assert.Equal(fisicoResult.TrainingComponent, untypedResult.TrainingComponent);
        }

        // ── Transparencia del desglose (ConsideredTrainings/ConsideredMatches) ──

        [Fact]
        public void ConsideredTrainings_ExposesOneEntryPerSessionWithDecayAndTypeWeightAndContribution()
        {
            var result = PlayerFatigueCalculator.Calculate(
                trainings: new[]
                {
                    (EventId: "t1", EventDate: (DateTime?)DateTime.UtcNow.Date.AddDays(-2), DaysAgo: 2, TrainingTypes: (IReadOnlyList<string>)new[] { "Fisico" }),
                },
                matches: Array.Empty<(string, DateTime?, int, int, int)>());

            var entry = Assert.Single(result.ConsideredTrainings);
            Assert.Equal("t1", entry.EventId);
            Assert.Equal(2, entry.DaysAgo);
            Assert.Equal(1.00, entry.TypeWeight, precision: 3); // Fisico
            Assert.Equal(0.5, entry.Decay, precision: 3);        // decay(2) = 0.5^(2/2)
            Assert.Equal(0.5, entry.Contribution, precision: 3); // Decay * TypeWeight
        }

        [Fact]
        public void ConsideredMatches_LeagueVsFriendly_ExposeDifferentTypeWeightAndEffectiveMinutes()
        {
            var result = PlayerFatigueCalculator.Calculate(
                trainings: Array.Empty<(string, DateTime?, int, IReadOnlyList<string>)>(),
                matches: new[]
                {
                    (EventId: "m1", EventDate: (DateTime?)DateTime.UtcNow.Date, DaysAgo: 0, MinutesPlayed: 70, EventTypeId: FriendlyEventTypeId),
                });

            var entry = Assert.Single(result.ConsideredMatches);
            Assert.Equal("m1", entry.EventId);
            Assert.Equal(0.70, entry.TypeWeight, precision: 3);   // Amistoso
            Assert.Equal(1.0, entry.Decay, precision: 3);         // decay(0) = 1
            Assert.Equal(49.0, entry.EffectiveMinutes, precision: 3); // 70 * 1 * 0.70
        }

        [Fact]
        public void SessionWithoutTrainingTypes_ConsideredTrainingHasNeutralTypeWeight()
        {
            var result = PlayerFatigueCalculator.Calculate(
                trainings: new[] { (EventId: "t1", EventDate: (DateTime?)null, DaysAgo: 0, TrainingTypes: (IReadOnlyList<string>)NoTypes) },
                matches: Array.Empty<(string, DateTime?, int, int, int)>());

            var entry = Assert.Single(result.ConsideredTrainings);
            Assert.Equal(1.00, entry.TypeWeight, precision: 3);
        }
    }
}
