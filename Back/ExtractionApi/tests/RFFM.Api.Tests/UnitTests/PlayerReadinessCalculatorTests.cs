using System;
using System.Collections.Generic;
using System.Linq;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Features.Coaches.Players.Services;
using RFFM.Api.Features.Coaches.SportEvents.Queries;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class PlayerReadinessCalculatorTests
    {
        // NOTE (deviation from implement.md §1.1): the script hardcoded ConvocationStatusId: 4
        // for "Deconvoke", but in this codebase's ConvocationStatus SmartEnum (Domain/Aggregates/
        // Assistances/ConvocationStatus.cs) id 4 is "Justified" and Deconvoke is 5. Using the
        // literal 4 made this test assert the wrong thing (Justified is NOT excluded — it scores
        // 45 points per design.md's table). Resolved via the real enum lookup so the test matches
        // its stated intent (a Deconvoke outcome is excluded from SessionsConsidered).
        private static readonly int DeconvokeStatusId = ConvocationStatus.FromName("Deconvoke").Id;
        private static readonly string[] NoTypes = Array.Empty<string>();
        private const int MatchEventTypeId = SportEventsConstants.MatchEventTypeId;
        private const int FriendlyEventTypeId = SportEventsConstants.FriendlyEventTypeId;

        private static PlayerReadinessCalculator.TrainingOutcome Attended(DateTime date, IReadOnlyList<string>? trainingTypes = null) =>
            new("ev", date, trainingTypes ?? NoTypes, AssistanceTypeId: 1, ExcuseTypeId: null, ConvocationStatusId: null);

        private static PlayerReadinessCalculator.TrainingOutcome InjuryAbsence(DateTime date) =>
            new("ev", date, NoTypes, AssistanceTypeId: 2, ExcuseTypeId: 1, ConvocationStatusId: null);

        private static PlayerReadinessCalculator.TrainingOutcome StudyAbsence(DateTime date) =>
            new("ev", date, NoTypes, AssistanceTypeId: 2, ExcuseTypeId: 2, ConvocationStatusId: null);

        private static PlayerReadinessCalculator.TrainingOutcome TechnicalDecision(DateTime date) =>
            new("ev", date, NoTypes, AssistanceTypeId: null, ExcuseTypeId: 7, ConvocationStatusId: null);

        private static PlayerReadinessCalculator.TrainingOutcome DeconvokeNoReason(DateTime date) =>
            new("ev", date, NoTypes, AssistanceTypeId: null, ExcuseTypeId: null, ConvocationStatusId: DeconvokeStatusId);

        private static (string EventId, DateTime? EventDate, int MinutesPlayed, int EventTypeId) Match(int minutes, int eventTypeId = MatchEventTypeId) =>
            ("ev", null, minutes, eventTypeId);

        [Fact]
        public void FullAttendanceAndFullMatchMinutes_ScoresOneHundred()
        {
            // Full attendance with Tactico (Rodaje weight 1.00) so the training component can
            // reach 100% — an untyped/Fisico-only session could no longer saturate on its own
            // after weighting was introduced.
            var trainings = Enumerable.Range(0, 16)
                .Select(i => Attended(DateTime.UtcNow.AddDays(-i), new[] { "Tactico" })).ToList();
            var matches = Enumerable.Repeat(Match(PlayerReadinessCalculator.ExpectedMinutesPerMatch), 8).ToList();

            var result = PlayerReadinessCalculator.Calculate(trainings, matches);

            Assert.Equal(100, result.Readiness);
        }

        [Fact]
        public void NoTrainingsAndNoMatchMinutes_ReadinessIsNull()
        {
            var result = PlayerReadinessCalculator.Calculate(
                new List<PlayerReadinessCalculator.TrainingOutcome>(),
                new List<(string, DateTime?, int, int)>());

            Assert.Null(result.Readiness);
        }

        [Fact]
        public void InjuryAbsence_PenalizesMoreThanJustifiedAbsence()
        {
            // Both scenarios reduce TrainingComponent to 0 under the addendum-2 fix (a single
            // absence never contributes to the scoring numerator), so Readiness can no longer
            // distinguish severity — the comparison moves to RecentAbsences[0].PointsImpact,
            // which remains purely informative (lesión = -90, estudios = -55).
            var baseTrainings = Enumerable.Range(0, 15)
                .Select(i => Attended(DateTime.UtcNow.AddDays(-i))).ToList();

            var withInjury = new List<PlayerReadinessCalculator.TrainingOutcome>(baseTrainings)
                { InjuryAbsence(DateTime.UtcNow) };
            var withStudy = new List<PlayerReadinessCalculator.TrainingOutcome>(baseTrainings)
                { StudyAbsence(DateTime.UtcNow) };

            var injuryResult = PlayerReadinessCalculator.Calculate(withInjury, new List<(string, DateTime?, int, int)>());
            var studyResult = PlayerReadinessCalculator.Calculate(withStudy, new List<(string, DateTime?, int, int)>());

            Assert.True(injuryResult.RecentAbsences[0].PointsImpact < studyResult.RecentAbsences[0].PointsImpact);
        }

        [Fact]
        public void SingleJustifiedTrainingAbsence_NeverExceedsZeroReadiness()
        {
            // Addendum 2 regression: a single justified training absence (45/100 points) used to
            // outscore a player who actually played match minutes, because the absence still
            // contributed to TrainingComponent's numerator. Now any non-attendance outcome
            // contributes 0 to TrainingComponent, so with no matches Readiness must be 0.
            var trainings = new List<PlayerReadinessCalculator.TrainingOutcome>
            {
                StudyAbsence(DateTime.UtcNow),
            };

            var result = PlayerReadinessCalculator.Calculate(trainings, new List<(string, DateTime?, int, int)>());

            Assert.Equal(0, result.Readiness);
        }

        [Fact]
        public void RealMatchMinutes_ScoreHigherThanSingleTrainingAbsence()
        {
            var playerWithOnlyAbsence = PlayerReadinessCalculator.Calculate(
                new List<PlayerReadinessCalculator.TrainingOutcome> { StudyAbsence(DateTime.UtcNow) },
                new List<(string, DateTime?, int, int)>());

            var playerWithMatchMinutes = PlayerReadinessCalculator.Calculate(
                new List<PlayerReadinessCalculator.TrainingOutcome>(),
                new List<(string, DateTime?, int, int)> { Match(20) });

            Assert.True(playerWithMatchMinutes.Readiness > playerWithOnlyAbsence.Readiness);
        }

        [Fact]
        public void TechnicalDecisionAbsence_IsExcludedFromCount()
        {
            var trainings = Enumerable.Range(0, 15)
                .Select(i => Attended(DateTime.UtcNow.AddDays(-i))).ToList();

            var withTechnical = new List<PlayerReadinessCalculator.TrainingOutcome>(trainings)
                { TechnicalDecision(DateTime.UtcNow) };

            var result = PlayerReadinessCalculator.Calculate(withTechnical, new List<(string, DateTime?, int, int)>());

            Assert.Equal(15, result.SessionsConsidered);
        }

        [Fact]
        public void DeconvokeWithNoAssistanceType_IsExcludedFromCount()
        {
            var trainings = new List<PlayerReadinessCalculator.TrainingOutcome>
            {
                Attended(DateTime.UtcNow),
                DeconvokeNoReason(DateTime.UtcNow.AddDays(-1)),
            };

            var result = PlayerReadinessCalculator.Calculate(trainings, new List<(string, DateTime?, int, int)>());

            Assert.Equal(1, result.SessionsConsidered);
        }

        [Fact]
        public void MatchMinutesAboveBaseline_DoNotExceedOneHundredPercentComponent()
        {
            var excessiveMinutes = Enumerable.Repeat(Match(200), 10).ToList(); // way above baseline

            var result = PlayerReadinessCalculator.Calculate(
                new List<PlayerReadinessCalculator.TrainingOutcome>(), excessiveMinutes);

            Assert.Equal(100, result.MatchComponent);
        }

        [Fact]
        public void RecentAbsences_ExcludesFullAttendanceAndCapsAtTen()
        {
            var trainings = Enumerable.Range(0, 20)
                .Select(i => StudyAbsence(DateTime.UtcNow.AddDays(-i))).ToList();
            trainings.Add(Attended(DateTime.UtcNow.AddDays(-100)));

            var result = PlayerReadinessCalculator.Calculate(trainings, new List<(string, DateTime?, int, int)>());

            Assert.Equal(10, result.RecentAbsences.Length);
            Assert.All(result.RecentAbsences, a => Assert.True(a.PointsImpact < 0));
        }

        // ── Ponderación por tipo de entrenamiento (Decisión 1: Táctico 1.00 > Técnico 0.60 > Físico 0.00) ──

        [Fact]
        public void TacticoTraining_ContributesMoreThanTecnicoTraining_SameAttendance()
        {
            var tacticoResult = PlayerReadinessCalculator.Calculate(
                new List<PlayerReadinessCalculator.TrainingOutcome> { Attended(DateTime.UtcNow, new[] { "Tactico" }) },
                new List<(string, DateTime?, int, int)>());
            var tecnicoResult = PlayerReadinessCalculator.Calculate(
                new List<PlayerReadinessCalculator.TrainingOutcome> { Attended(DateTime.UtcNow, new[] { "Tecnico" }) },
                new List<(string, DateTime?, int, int)>());

            Assert.True(tacticoResult.TrainingComponent > tecnicoResult.TrainingComponent);
        }

        [Fact]
        public void FisicoOnlyTraining_ContributesWithWeightThirtyPercent_LessThanTecnico()
        {
            var fisico = PlayerReadinessCalculator.Calculate(
                new List<PlayerReadinessCalculator.TrainingOutcome> { Attended(DateTime.UtcNow, new[] { "Fisico" }) },
                new List<(string, DateTime?, int, int)>());
            var tecnico = PlayerReadinessCalculator.Calculate(
                new List<PlayerReadinessCalculator.TrainingOutcome> { Attended(DateTime.UtcNow, new[] { "Tecnico" }) },
                new List<(string, DateTime?, int, int)>());

            Assert.Equal(0.30, Assert.Single(fisico.ConsideredTrainings).TypeWeight, precision: 3);
            Assert.True(fisico.TrainingComponent > 0);
            Assert.True(fisico.TrainingComponent < tecnico.TrainingComponent);
        }

        [Fact]
        public void SessionWithTacticoAndFisico_WeighsAverageOfSixtyFiveHundredths()
        {
            var result = PlayerReadinessCalculator.Calculate(
                new List<PlayerReadinessCalculator.TrainingOutcome> { Attended(DateTime.UtcNow, new[] { "Tactico", "Fisico" }) },
                new List<(string, DateTime?, int, int)>());

            Assert.Equal(0.65, Assert.Single(result.ConsideredTrainings).TypeWeight, precision: 3);
        }

        [Fact]
        public void LeagueMatch_ContributesMoreThanFriendlyMatch_SameMinutes()
        {
            var leagueResult = PlayerReadinessCalculator.Calculate(
                new List<PlayerReadinessCalculator.TrainingOutcome>(),
                new List<(string, DateTime?, int, int)> { Match(70, MatchEventTypeId) });
            var friendlyResult = PlayerReadinessCalculator.Calculate(
                new List<PlayerReadinessCalculator.TrainingOutcome>(),
                new List<(string, DateTime?, int, int)> { Match(70, FriendlyEventTypeId) });

            Assert.True(leagueResult.MatchComponent > friendlyResult.MatchComponent);
        }

        [Fact]
        public void SessionWithSeveralTrainingTypes_WeighsAsAverageOfPresentOnly()
        {
            var combinedResult = PlayerReadinessCalculator.Calculate(
                new List<PlayerReadinessCalculator.TrainingOutcome> { Attended(DateTime.UtcNow, new[] { "Tactico", "Tecnico" }) },
                new List<(string, DateTime?, int, int)>());
            var tacticoOnlyResult = PlayerReadinessCalculator.Calculate(
                new List<PlayerReadinessCalculator.TrainingOutcome> { Attended(DateTime.UtcNow, new[] { "Tactico" }) },
                new List<(string, DateTime?, int, int)>());
            var tecnicoOnlyResult = PlayerReadinessCalculator.Calculate(
                new List<PlayerReadinessCalculator.TrainingOutcome> { Attended(DateTime.UtcNow, new[] { "Tecnico" }) },
                new List<(string, DateTime?, int, int)>());

            Assert.True(combinedResult.TrainingComponent > tecnicoOnlyResult.TrainingComponent);
            Assert.True(combinedResult.TrainingComponent < tacticoOnlyResult.TrainingComponent);
        }

        [Fact]
        public void SessionWithoutTrainingTypes_WeighsNeutral_SameAsUntyped()
        {
            // Retrocompat: untyped attendance must produce the exact same TrainingComponent as
            // pre-change behaviour, equivalent to a peso neutro of 1.00 (higher than Tactico=1.00
            // is impossible, so untyped must equal the Tactico-only result exactly).
            var untypedResult = PlayerReadinessCalculator.Calculate(
                new List<PlayerReadinessCalculator.TrainingOutcome> { Attended(DateTime.UtcNow) },
                new List<(string, DateTime?, int, int)>());
            var tacticoResult = PlayerReadinessCalculator.Calculate(
                new List<PlayerReadinessCalculator.TrainingOutcome> { Attended(DateTime.UtcNow, new[] { "Tactico" }) },
                new List<(string, DateTime?, int, int)>());

            Assert.Equal(tacticoResult.TrainingComponent, untypedResult.TrainingComponent);
        }

        // ── Transparencia del desglose (ConsideredTrainings/ConsideredMatches) ──

        [Fact]
        public void ConsideredTrainings_FullAttendance_CountsTowardScoreWithTypeWeightAndContribution()
        {
            var result = PlayerReadinessCalculator.Calculate(
                new List<PlayerReadinessCalculator.TrainingOutcome> { Attended(DateTime.UtcNow, new[] { "Tactico" }) },
                new List<(string, DateTime?, int, int)>());

            var entry = Assert.Single(result.ConsideredTrainings);
            Assert.True(entry.CountsTowardScore);
            Assert.Equal(100, entry.Points);
            Assert.Equal(1.00, entry.TypeWeight, precision: 3); // Tactico
            Assert.Equal(100, entry.Contribution, precision: 3);
        }

        [Fact]
        public void ConsideredTrainings_Absence_DoesNotCountTowardScoreButStillAppearsWithReason()
        {
            var result = PlayerReadinessCalculator.Calculate(
                new List<PlayerReadinessCalculator.TrainingOutcome> { StudyAbsence(DateTime.UtcNow) },
                new List<(string, DateTime?, int, int)>());

            var entry = Assert.Single(result.ConsideredTrainings);
            Assert.False(entry.CountsTowardScore);
            Assert.Equal(0, entry.Contribution);
            Assert.NotEmpty(entry.Reason);
        }

        [Fact]
        public void ConsideredMatches_League_ExposesTypeWeightOneAndEffectiveMinutesEqualToReal()
        {
            var result = PlayerReadinessCalculator.Calculate(
                new List<PlayerReadinessCalculator.TrainingOutcome>(),
                new List<(string, DateTime?, int, int)> { Match(70, MatchEventTypeId) });

            var entry = Assert.Single(result.ConsideredMatches);
            Assert.Equal(1.00, entry.TypeWeight, precision: 3);
            Assert.Equal(70, entry.EffectiveMinutes, precision: 3);
        }

        [Fact]
        public void ConsideredMatches_Friendly_ExposesReducedTypeWeightAndEffectiveMinutes()
        {
            var result = PlayerReadinessCalculator.Calculate(
                new List<PlayerReadinessCalculator.TrainingOutcome>(),
                new List<(string, DateTime?, int, int)> { Match(70, FriendlyEventTypeId) });

            var entry = Assert.Single(result.ConsideredMatches);
            Assert.Equal(0.70, entry.TypeWeight, precision: 3);
            Assert.Equal(49.0, entry.EffectiveMinutes, precision: 3);
        }
    }
}
