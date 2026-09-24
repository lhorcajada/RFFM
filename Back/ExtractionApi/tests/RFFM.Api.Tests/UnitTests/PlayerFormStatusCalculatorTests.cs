using RFFM.Api.Features.Coaches.Players.Services;
using RFFM.Api.Features.Coaches.SportEvents.Queries;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class PlayerFormStatusCalculatorTests
    {
        private static readonly DateTime Today = new(2026, 9, 24);
        private static readonly string[] Fisico = { "Fisico" };
        private static readonly string[] Tactico = { "Tactico" };
        private static readonly string[] Tecnico = { "Tecnico" };
        private const int CadeteHalfMinutes = 40; // 80' de partido, 70' de estímulo completo
        private const int MatchEventTypeId = SportEventsConstants.MatchEventTypeId;
        private const int FriendlyEventTypeId = SportEventsConstants.FriendlyEventTypeId;

        private static DailyLoadModel.TrainingInput Training(
            int daysAgo, ParticipationOutcome outcome = ParticipationOutcome.Attended, string[]? types = null, string? reason = null) =>
            new($"t{daysAgo}", Today.AddDays(-daysAgo), types ?? Fisico, outcome, reason);

        private static DailyLoadModel.MatchInput Match(int daysAgo, int minutes, int eventTypeId = MatchEventTypeId, string? reason = null) =>
            new($"m{daysAgo}", Today.AddDays(-daysAgo), eventTypeId, minutes, reason);

        private static DailyLoadModel.MetricResult Calc(
            IReadOnlyList<DailyLoadModel.TrainingInput> trainings,
            IReadOnlyList<DailyLoadModel.MatchInput> matches,
            DateTime? startDate = null) =>
            PlayerFormStatusCalculator.Calculate(trainings, matches, startDate ?? Today.AddDays(-83), Today, CadeteHalfMinutes);

        private static readonly DailyLoadModel.TrainingInput[] NoTrainings = Array.Empty<DailyLoadModel.TrainingInput>();
        private static readonly DailyLoadModel.MatchInput[] NoMatches = Array.Empty<DailyLoadModel.MatchInput>();

        // Satura el valor con cuatro meses de entreno y partido diarios y deja `restDays` días completos
        // sin actividad hasta ayer (hoy, sin actividad todavía, no cuenta).
        private static DailyLoadModel.TrainingInput[] SaturatedTrainings(int restDays) =>
            Enumerable.Range(restDays + 1, 120).Select(d => Training(d)).ToArray();

        private static DailyLoadModel.MatchInput[] SaturatedMatches(int restDays) =>
            Enumerable.Range(restDays + 1, 120).Select(d => Match(d, 80)).ToArray();

        [Fact]
        public void WithoutActivityInReplay_FormStatusIsNull()
        {
            var result = Calc(new[] { Training(2, ParticipationOutcome.Absent) }, new[] { Match(3, 0) });

            Assert.Null(result.Value);
            Assert.Null(result.Model);
        }

        [Fact]
        public void ActivityOlderThanReplay_DoesNotCount()
        {
            var result = Calc(new[] { Training(84) }, new[] { Match(90, 70) });

            Assert.Null(result.Value);
        }

        [Fact]
        public void OneFisicoTrainingToday_Gives15()
        {
            var result = Calc(new[] { Training(0) }, NoMatches);

            Assert.Equal(15, result.Value);
        }

        [Theory]
        [InlineData(new[] { "Fisico" }, 1.00)]
        [InlineData(new[] { "Tactico" }, 0.50)]
        [InlineData(new[] { "Tecnico" }, 0.00)]
        [InlineData(new[] { "Fisico", "Tactico" }, 0.75)]
        [InlineData(new string[0], 1.00)]
        public void TrainingLoad_IsItsTypeWeight(string[] types, double expectedLoad)
        {
            var result = Calc(new[] { Training(0, types: types) }, NoMatches);

            Assert.Equal(expectedLoad, result.Model!.Steps.Single().Load, precision: 6);
        }

        [Fact]
        public void TecnicoOnlyTraining_KeepsValueButDoesNotAdd()
        {
            var withTecnico = Calc(new[] { Training(8), Training(3, types: Tecnico) }, NoMatches);
            var withoutTecnico = Calc(new[] { Training(8) }, NoMatches);

            Assert.Equal(15, withTecnico.Value);
            Assert.Equal(2, withTecnico.Model!.CurrentRestStreakDays);
            Assert.True(withoutTecnico.Model!.Value < withTecnico.Model.Value);
        }

        [Fact]
        public void FullCadeteMatch_HasLoadOneAndAHalfAndGives21()
        {
            var result = Calc(NoTrainings, new[] { Match(0, 70) });

            Assert.Equal(1.5, result.Model!.Steps.Single().Load, precision: 6);
            Assert.Equal(21, result.Value);
        }

        [Fact]
        public void MatchType_DoesNotWeigh()
        {
            var league = Calc(NoTrainings, new[] { Match(0, 60) });
            var friendly = Calc(NoTrainings, new[] { Match(0, 60, FriendlyEventTypeId) });

            Assert.Equal(league.Model!.Value, friendly.Model!.Value, precision: 9);
        }

        [Theory]
        [InlineData(70, 36, 90, 18)]
        [InlineData(36, 70, 90, 18)]
        [InlineData(53, 53, 18, 90)]
        public void MoreMinutes_NeverGiveLessFormStatus(int lowA, int lowB, int highA, int highB)
        {
            DailyLoadModel.MetricResult Run(int a, int b) => Calc(
                new[] { Training(13), Training(11, types: Tactico), Training(6), Training(4, types: Tactico) },
                new[] { Match(8, a, FriendlyEventTypeId), Match(1, b, FriendlyEventTypeId) });

            Assert.True(Run(highA, highB).Model!.Value >= Run(lowA, lowB).Model!.Value);
        }

        [Fact]
        public void CalledUpWithoutPlaying_IsARestDay()
        {
            var result = Calc(new[] { Training(8) }, new[] { Match(3, 0, reason: "Convocado sin jugar") });

            Assert.Equal(7, result.Model!.CurrentRestStreakDays);
            Assert.Contains(result.MissedEvents, m => m.EventId == "m3" && m.Reason == "Convocado sin jugar");
        }

        [Theory]
        [InlineData(4, 100)]
        [InlineData(5, 100)]
        [InlineData(7, 97)]
        [InlineData(14, 78)]
        [InlineData(21, 57)]
        [InlineData(28, 36)]
        public void RestDays_KeepFormStatusForFourDaysAndThenLowerIt(int restDays, int expected)
        {
            var result = Calc(SaturatedTrainings(restDays), SaturatedMatches(restDays), Today.AddDays(-(restDays + 120)));

            Assert.Equal(expected, result.Value);
        }

        [Theory]
        [InlineData(ParticipationOutcome.Absent, "Lesión")]
        [InlineData(ParticipationOutcome.Absent, "Falta injustificada")]
        [InlineData(ParticipationOutcome.Excluded, "Decisión técnica")]
        public void AbsenceReason_DoesNotChangeTheValue(ParticipationOutcome outcome, string reason)
        {
            var withAbsence = Calc(new[] { Training(8), Training(3, outcome, reason: reason) }, NoMatches);
            var withoutEvent = Calc(new[] { Training(8) }, NoMatches);

            Assert.Equal(withoutEvent.Model!.Value, withAbsence.Model!.Value, precision: 9);
            Assert.Contains(withAbsence.MissedEvents, m => m.EventId == "t3" && m.Reason == reason);
        }

        [Fact]
        public void MissedEvents_AreMostRecentFirstAndCappedAtTen()
        {
            var trainings = Enumerable.Range(1, 12).Select(d => Training(d, ParticipationOutcome.Absent)).Append(Training(0)).ToArray();

            var result = Calc(trainings, NoMatches);

            Assert.Equal(10, result.MissedEvents.Length);
            Assert.Equal("t1", result.MissedEvents.First().EventId);
        }

        [Fact]
        public void ReplayStartsAtGivenStartDate()
        {
            var result = Calc(new[] { Training(10), Training(2) }, NoMatches, Today.AddDays(-5));

            Assert.Equal(Today.AddDays(-5), result.StartDate);
            Assert.Equal(1, result.TrainingsAttended);
            Assert.Equal(15, result.Value);
        }

        [Fact]
        public void Totals_CountAttendedTrainingsAndPlayedMatches()
        {
            var result = Calc(
                new[] { Training(5), Training(3), Training(1, ParticipationOutcome.Absent) },
                new[] { Match(4, 55), Match(2, 70), Match(0, 0) });

            Assert.Equal(2, result.TrainingsAttended);
            Assert.Equal(2, result.MatchesPlayed);
            Assert.Equal(125, result.MatchMinutesPlayed);
            Assert.Equal(70d, result.ReferenceMatchMinutes, precision: 6);
        }
    }
}
