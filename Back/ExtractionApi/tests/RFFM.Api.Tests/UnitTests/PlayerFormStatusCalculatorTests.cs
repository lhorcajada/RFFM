using System;
using System.Collections.Generic;
using System.Linq;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Features.Coaches.Players.Services;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class PlayerFormStatusCalculatorTests
    {
        // NOTE (deviation from implement.md §1.1): the script hardcoded ConvocationStatusId: 4
        // for "Deconvoke", but in this codebase's ConvocationStatus SmartEnum (Domain/Aggregates/
        // Assistances/ConvocationStatus.cs) id 4 is "Justified" and Deconvoke is 5. Using the
        // literal 4 made this test assert the wrong thing (Justified is NOT excluded — it scores
        // 45 points per design.md's table). Resolved via the real enum lookup so the test matches
        // its stated intent (a Deconvoke outcome is excluded from SessionsConsidered).
        private static readonly int DeconvokeStatusId = ConvocationStatus.FromName("Deconvoke").Id;

        private static PlayerFormStatusCalculator.TrainingOutcome Attended(DateTime date) =>
            new("ev", date, AssistanceTypeId: 1, ExcuseTypeId: null, ConvocationStatusId: null);

        private static PlayerFormStatusCalculator.TrainingOutcome InjuryAbsence(DateTime date) =>
            new("ev", date, AssistanceTypeId: 2, ExcuseTypeId: 1, ConvocationStatusId: null);

        private static PlayerFormStatusCalculator.TrainingOutcome StudyAbsence(DateTime date) =>
            new("ev", date, AssistanceTypeId: 2, ExcuseTypeId: 2, ConvocationStatusId: null);

        private static PlayerFormStatusCalculator.TrainingOutcome TechnicalDecision(DateTime date) =>
            new("ev", date, AssistanceTypeId: null, ExcuseTypeId: 7, ConvocationStatusId: null);

        private static PlayerFormStatusCalculator.TrainingOutcome DeconvokeNoReason(DateTime date) =>
            new("ev", date, AssistanceTypeId: null, ExcuseTypeId: null, ConvocationStatusId: DeconvokeStatusId);

        [Fact]
        public void FullAttendanceAndFullMatchMinutes_ScoresOneHundred()
        {
            var trainings = Enumerable.Range(0, 16)
                .Select(i => Attended(DateTime.UtcNow.AddDays(-i))).ToList();
            var matches = Enumerable.Repeat(PlayerFormStatusCalculator.ExpectedMinutesPerMatch, 8).ToList();

            var result = PlayerFormStatusCalculator.Calculate(trainings, matches);

            Assert.Equal(100, result.FormStatus);
        }

        [Fact]
        public void NoTrainingsAndNoMatchMinutes_FormStatusIsNull()
        {
            var result = PlayerFormStatusCalculator.Calculate(
                new List<PlayerFormStatusCalculator.TrainingOutcome>(),
                new List<int>());

            Assert.Null(result.FormStatus);
        }

        [Fact]
        public void InjuryAbsence_PenalizesMoreThanJustifiedAbsence()
        {
            // Both scenarios reduce TrainingComponent to 0 under the addendum-2 fix (a single
            // absence never contributes to the scoring numerator), so FormStatus can no longer
            // distinguish severity — the comparison moves to RecentAbsences[0].PointsImpact,
            // which remains purely informative (lesión = -90, estudios = -55).
            var baseTrainings = Enumerable.Range(0, 15)
                .Select(i => Attended(DateTime.UtcNow.AddDays(-i))).ToList();

            var withInjury = new List<PlayerFormStatusCalculator.TrainingOutcome>(baseTrainings)
                { InjuryAbsence(DateTime.UtcNow) };
            var withStudy = new List<PlayerFormStatusCalculator.TrainingOutcome>(baseTrainings)
                { StudyAbsence(DateTime.UtcNow) };

            var injuryResult = PlayerFormStatusCalculator.Calculate(withInjury, new List<int>());
            var studyResult = PlayerFormStatusCalculator.Calculate(withStudy, new List<int>());

            Assert.True(injuryResult.RecentAbsences[0].PointsImpact < studyResult.RecentAbsences[0].PointsImpact);
        }

        [Fact]
        public void SingleJustifiedTrainingAbsence_NeverExceedsZeroFormStatus()
        {
            // Addendum 2 regression: a single justified training absence (45/100 points) used to
            // outscore a player who actually played match minutes, because the absence still
            // contributed to TrainingComponent's numerator. Now any non-attendance outcome
            // contributes 0 to TrainingComponent, so with no matches FormStatus must be 0.
            var trainings = new List<PlayerFormStatusCalculator.TrainingOutcome>
            {
                StudyAbsence(DateTime.UtcNow),
            };

            var result = PlayerFormStatusCalculator.Calculate(trainings, new List<int>());

            Assert.Equal(0, result.FormStatus);
        }

        [Fact]
        public void RealMatchMinutes_ScoreHigherThanSingleTrainingAbsence()
        {
            var playerWithOnlyAbsence = PlayerFormStatusCalculator.Calculate(
                new List<PlayerFormStatusCalculator.TrainingOutcome> { StudyAbsence(DateTime.UtcNow) },
                new List<int>());

            var playerWithMatchMinutes = PlayerFormStatusCalculator.Calculate(
                new List<PlayerFormStatusCalculator.TrainingOutcome>(),
                new List<int> { 20 });

            Assert.True(playerWithMatchMinutes.FormStatus > playerWithOnlyAbsence.FormStatus);
        }

        [Fact]
        public void TechnicalDecisionAbsence_IsExcludedFromCount()
        {
            var trainings = Enumerable.Range(0, 15)
                .Select(i => Attended(DateTime.UtcNow.AddDays(-i))).ToList();

            var withTechnical = new List<PlayerFormStatusCalculator.TrainingOutcome>(trainings)
                { TechnicalDecision(DateTime.UtcNow) };

            var result = PlayerFormStatusCalculator.Calculate(withTechnical, new List<int>());

            Assert.Equal(15, result.SessionsConsidered);
        }

        [Fact]
        public void DeconvokeWithNoAssistanceType_IsExcludedFromCount()
        {
            var trainings = new List<PlayerFormStatusCalculator.TrainingOutcome>
            {
                Attended(DateTime.UtcNow),
                DeconvokeNoReason(DateTime.UtcNow.AddDays(-1)),
            };

            var result = PlayerFormStatusCalculator.Calculate(trainings, new List<int>());

            Assert.Equal(1, result.SessionsConsidered);
        }

        [Fact]
        public void MatchMinutesAboveBaseline_DoNotExceedOneHundredPercentComponent()
        {
            var excessiveMinutes = Enumerable.Repeat(200, 10).ToList(); // way above baseline

            var result = PlayerFormStatusCalculator.Calculate(
                new List<PlayerFormStatusCalculator.TrainingOutcome>(), excessiveMinutes);

            Assert.Equal(100, result.MatchComponent);
        }

        [Fact]
        public void RecentAbsences_ExcludesFullAttendanceAndCapsAtTen()
        {
            var trainings = Enumerable.Range(0, 20)
                .Select(i => StudyAbsence(DateTime.UtcNow.AddDays(-i))).ToList();
            trainings.Add(Attended(DateTime.UtcNow.AddDays(-100)));

            var result = PlayerFormStatusCalculator.Calculate(trainings, new List<int>());

            Assert.Equal(10, result.RecentAbsences.Length);
            Assert.All(result.RecentAbsences, a => Assert.True(a.PointsImpact < 0));
        }
    }
}
