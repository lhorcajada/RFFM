using System;
using System.Collections.Generic;
using System.Linq;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Features.Coaches.Players.Services;
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

        private static PlayerReadinessCalculator.TrainingOutcome Attended(DateTime date) =>
            new("ev", date, AssistanceTypeId: 1, ExcuseTypeId: null, ConvocationStatusId: null);

        private static PlayerReadinessCalculator.TrainingOutcome InjuryAbsence(DateTime date) =>
            new("ev", date, AssistanceTypeId: 2, ExcuseTypeId: 1, ConvocationStatusId: null);

        private static PlayerReadinessCalculator.TrainingOutcome StudyAbsence(DateTime date) =>
            new("ev", date, AssistanceTypeId: 2, ExcuseTypeId: 2, ConvocationStatusId: null);

        private static PlayerReadinessCalculator.TrainingOutcome TechnicalDecision(DateTime date) =>
            new("ev", date, AssistanceTypeId: null, ExcuseTypeId: 7, ConvocationStatusId: null);

        private static PlayerReadinessCalculator.TrainingOutcome DeconvokeNoReason(DateTime date) =>
            new("ev", date, AssistanceTypeId: null, ExcuseTypeId: null, ConvocationStatusId: DeconvokeStatusId);

        [Fact]
        public void FullAttendanceAndFullMatchMinutes_ScoresOneHundred()
        {
            var trainings = Enumerable.Range(0, 16)
                .Select(i => Attended(DateTime.UtcNow.AddDays(-i))).ToList();
            var matches = Enumerable.Repeat(PlayerReadinessCalculator.ExpectedMinutesPerMatch, 8).ToList();

            var result = PlayerReadinessCalculator.Calculate(trainings, matches);

            Assert.Equal(100, result.Readiness);
        }

        [Fact]
        public void NoTrainingsAndNoMatchMinutes_ReadinessIsNull()
        {
            var result = PlayerReadinessCalculator.Calculate(
                new List<PlayerReadinessCalculator.TrainingOutcome>(),
                new List<int>());

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

            var injuryResult = PlayerReadinessCalculator.Calculate(withInjury, new List<int>());
            var studyResult = PlayerReadinessCalculator.Calculate(withStudy, new List<int>());

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

            var result = PlayerReadinessCalculator.Calculate(trainings, new List<int>());

            Assert.Equal(0, result.Readiness);
        }

        [Fact]
        public void RealMatchMinutes_ScoreHigherThanSingleTrainingAbsence()
        {
            var playerWithOnlyAbsence = PlayerReadinessCalculator.Calculate(
                new List<PlayerReadinessCalculator.TrainingOutcome> { StudyAbsence(DateTime.UtcNow) },
                new List<int>());

            var playerWithMatchMinutes = PlayerReadinessCalculator.Calculate(
                new List<PlayerReadinessCalculator.TrainingOutcome>(),
                new List<int> { 20 });

            Assert.True(playerWithMatchMinutes.Readiness > playerWithOnlyAbsence.Readiness);
        }

        [Fact]
        public void TechnicalDecisionAbsence_IsExcludedFromCount()
        {
            var trainings = Enumerable.Range(0, 15)
                .Select(i => Attended(DateTime.UtcNow.AddDays(-i))).ToList();

            var withTechnical = new List<PlayerReadinessCalculator.TrainingOutcome>(trainings)
                { TechnicalDecision(DateTime.UtcNow) };

            var result = PlayerReadinessCalculator.Calculate(withTechnical, new List<int>());

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

            var result = PlayerReadinessCalculator.Calculate(trainings, new List<int>());

            Assert.Equal(1, result.SessionsConsidered);
        }

        [Fact]
        public void MatchMinutesAboveBaseline_DoNotExceedOneHundredPercentComponent()
        {
            var excessiveMinutes = Enumerable.Repeat(200, 10).ToList(); // way above baseline

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

            var result = PlayerReadinessCalculator.Calculate(trainings, new List<int>());

            Assert.Equal(10, result.RecentAbsences.Length);
            Assert.All(result.RecentAbsences, a => Assert.True(a.PointsImpact < 0));
        }
    }
}
