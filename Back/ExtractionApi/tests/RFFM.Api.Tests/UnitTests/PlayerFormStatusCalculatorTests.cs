using RFFM.Api.Features.Coaches.Players.Services;
using RFFM.Api.Features.Coaches.SportEvents.Queries;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class PlayerFormStatusCalculatorTests
    {
        private static readonly string[] NoTypes = Array.Empty<string>();
        private static readonly string[] Fisico = { "Fisico" };
        private static readonly string[] Tactico = { "Tactico" };
        private static readonly string[] Tecnico = { "Tecnico" };
        private const int CadeteHalfMinutes = 40; // 2 x 40 = 80' de partido, 70' de estimulo completo
        private const int MatchEventTypeId = SportEventsConstants.MatchEventTypeId;
        private const int FriendlyEventTypeId = SportEventsConstants.FriendlyEventTypeId;

        private static readonly int[] ExampleTrainingDays = { 1, 3, 8, 10, 15, 17, 22, 24, 29, 31, 36, 38 };
        private static readonly int[] ExampleMatchDays = { 2, 9, 16, 23, 30, 37 };

        private static PlayerFormStatusCalculator.TrainingParticipation Training(
            int daysAgo, ParticipationOutcome outcome = ParticipationOutcome.Attended, string[]? types = null, string? reason = null) =>
            new($"t{daysAgo}", null, daysAgo, types ?? Fisico, outcome, reason);

        private static PlayerFormStatusCalculator.MatchInput Match(
            int daysAgo, int minutes, ParticipationOutcome outcome = ParticipationOutcome.Attended, int eventTypeId = MatchEventTypeId) =>
            new($"m{daysAgo}", null, eventTypeId, daysAgo, minutes, outcome);

        private static PlayerFormStatusCalculator.Result Calc(
            IReadOnlyList<PlayerFormStatusCalculator.TrainingParticipation> trainings,
            IReadOnlyList<PlayerFormStatusCalculator.MatchInput> matches,
            int fatigue = 0) =>
            PlayerFormStatusCalculator.Calculate(trainings, matches, fatigue, CadeteHalfMinutes);

        private static PlayerFormStatusCalculator.TrainingParticipation[] NoTrainings => Array.Empty<PlayerFormStatusCalculator.TrainingParticipation>();
        private static PlayerFormStatusCalculator.MatchInput[] NoMatches => Array.Empty<PlayerFormStatusCalculator.MatchInput>();

        private static List<PlayerFormStatusCalculator.TrainingParticipation> ExampleTrainings(params int[] absentDays) =>
            ExampleTrainingDays
                .Select(d => Training(d, absentDays.Contains(d) ? ParticipationOutcome.Absent : ParticipationOutcome.Attended))
                .ToList();

        private static List<PlayerFormStatusCalculator.MatchInput> ExampleMatches(int minutes) =>
            ExampleMatchDays.Select(d => Match(d, minutes)).ToList();

        [Fact]
        public void NoTrainingsNorMatches_FormStatusIsNull()
        {
            var result = Calc(NoTrainings, NoMatches);

            Assert.Null(result.FormStatus);
        }

        [Fact]
        public void EventsOlderThanWindow_DoNotCount()
        {
            var result = Calc(new[] { Training(43) }, new[] { Match(43, 70) });

            Assert.Null(result.FormStatus);
        }

        [Theory]
        [InlineData("Injustificada")]
        [InlineData("Justificada")]
        [InlineData("Lesion")]
        public void AbsenceOfAnyReason_StaysInDenominatorAndContributesZero(string reason)
        {
            var result = Calc(
                new[] { Training(1), Training(1, ParticipationOutcome.Absent, reason: reason) },
                NoMatches);

            Assert.Equal(50, result.TrainingRatioComponent!.Value, precision: 6);
            Assert.Equal(2, result.TrainingSessionsOffered);
            Assert.Equal(1, result.TrainingSessionsAttended);
        }

        [Fact]
        public void ExcludedTrainingsAndMatches_AreCountedButNotOffered()
        {
            var result = Calc(
                new[] { Training(1), Training(2, ParticipationOutcome.Excluded) },
                new[] { Match(1, 70), Match(2, 0, ParticipationOutcome.Excluded) });

            Assert.Equal(1, result.ExcludedTrainings);
            Assert.Equal(1, result.TrainingSessionsOffered);
            Assert.Equal(1, result.ExcludedMatches);
            Assert.Equal(1, result.MatchesConsidered);
        }

        [Fact]
        public void MissingFisicoSession_HurtsMoreThanMissingTactico()
        {
            var missFisico = Calc(new[] { Training(1), Training(1, ParticipationOutcome.Absent, Fisico) }, NoMatches);
            var missTactico = Calc(new[] { Training(1), Training(1, ParticipationOutcome.Absent, Tactico) }, NoMatches);

            Assert.True(missFisico.TrainingComponent < missTactico.TrainingComponent);
        }

        [Fact]
        public void MissingPureTecnicoSession_DoesNotReduceWhenOtherSessionsHaveWeight()
        {
            var result = Calc(
                new[] { Training(1), Training(1, ParticipationOutcome.Absent, Tecnico) },
                NoMatches);

            Assert.Equal(100, result.TrainingRatioComponent!.Value, precision: 6);
            Assert.False(result.TrainingTypeWeightFallbackUsed);
        }

        [Fact]
        public void SessionWithSeveralTypes_WeighsAverage_AndUntypedWeighsOne()
        {
            var result = Calc(
                new[] { Training(1, types: new[] { "Fisico", "Tactico" }), Training(2, types: NoTypes) },
                NoMatches);

            var byId = result.ConsideredTrainings.ToDictionary(t => t.EventId);
            Assert.Equal(0.75, byId["t1"].TypeWeight, precision: 6);
            Assert.Equal(1.0, byId["t2"].TypeWeight, precision: 6);
        }

        [Fact]
        public void AllPureTecnicoSessions_UseWeightOneFallback_AndRatioByAttendance()
        {
            var result = Calc(
                new[] { Training(1, types: Tecnico), Training(1, ParticipationOutcome.Absent, Tecnico) },
                NoMatches);

            Assert.True(result.TrainingTypeWeightFallbackUsed);
            Assert.Equal(50, result.TrainingRatioComponent!.Value, precision: 6);
            Assert.All(result.ConsideredTrainings, t => Assert.Equal(1.0, t.TypeWeight, precision: 6));
        }

        [Fact]
        public void TrainingDetails_ExposeRecencyLoadsAndAbsenceReason()
        {
            var result = Calc(
                new[] { Training(8), Training(21, ParticipationOutcome.Absent, reason: "Lesion") },
                NoMatches);

            var attended = result.ConsideredTrainings.Single(t => t.Attended);
            Assert.Equal(0.952, attended.RecencyWeight, precision: 3);
            Assert.Equal(attended.RecencyWeight, attended.OfferedLoad, precision: 6);
            Assert.Equal(attended.OfferedLoad, attended.ReceivedLoad, precision: 6);
            Assert.Null(attended.AbsenceReason);
            var absent = result.ConsideredTrainings.Single(t => !t.Attended);
            Assert.Equal(0, absent.ReceivedLoad);
            Assert.Equal("Lesion", absent.AbsenceReason);
            Assert.Equal(result.ConsideredTrainings.Sum(t => t.OfferedLoad), result.TrainingLoadOffered, precision: 6);
        }

        [Fact]
        public void MatchMinutes_ScaleAgainstFullStimulusAndCapAtOne()
        {
            var ten = Calc(NoTrainings, new[] { Match(1, 10) });
            var seventy = Calc(NoTrainings, new[] { Match(1, 70) });
            var hundred = Calc(NoTrainings, new[] { Match(1, 100) });

            Assert.Equal(70.0, ten.FullMatchMinutes, precision: 6);
            Assert.Equal(80, ten.CategoryMatchMinutes);
            Assert.Equal(0.875, ten.FullStimulusFraction, precision: 6);
            Assert.Equal(10.0 / 70.0, ten.ConsideredMatches.Single().Ratio, precision: 6);
            Assert.Equal(1.0, seventy.ConsideredMatches.Single().Ratio, precision: 6);
            Assert.Equal(1.0, hundred.ConsideredMatches.Single().Ratio, precision: 6);
            Assert.Equal(PlayerFormStatusCalculator.MatchStatusPlayed, ten.ConsideredMatches.Single().Status);
        }

        [Fact]
        public void MatchWithAbsence_CountsZeroInDenominator()
        {
            var result = Calc(NoTrainings, new[] { Match(1, 70), Match(1, 0, ParticipationOutcome.Absent) });

            Assert.Equal(50, result.MatchComponent!.Value, precision: 6);
            Assert.Equal(PlayerFormStatusCalculator.MatchStatusAbsent, result.ConsideredMatches.Single(m => m.MinutesPlayed == 0).Status);
        }

        [Fact]
        public void SubstituteWhoDidNotPlay_CountsZeroWithNotPlayedStatus()
        {
            var result = Calc(NoTrainings, new[] { Match(1, 0, ParticipationOutcome.Attended) });

            Assert.Equal(0, result.MatchComponent!.Value, precision: 6);
            Assert.Equal(PlayerFormStatusCalculator.MatchStatusNotPlayed, result.ConsideredMatches.Single().Status);
        }

        [Fact]
        public void MatchEventType_DoesNotChangeRatio()
        {
            var league = Calc(NoTrainings, new[] { Match(1, 35, eventTypeId: MatchEventTypeId) });
            var friendly = Calc(NoTrainings, new[] { Match(1, 35, eventTypeId: FriendlyEventTypeId) });

            Assert.Equal(league.MatchComponent, friendly.MatchComponent);
        }

        [Fact]
        public void OnlyTrainingsAvailable_TrainingWeightIsAppliedAtOneHundredPercent()
        {
            // 12 sesiones = volumen de referencia completo: el 100% no se penaliza.
            var result = Calc(ExampleTrainings(), NoMatches);

            Assert.Equal(1.0, result.TrainingWeightApplied, precision: 6);
            Assert.Equal(0.0, result.MatchWeightApplied, precision: 6);
            Assert.Null(result.MatchComponent);
            Assert.Equal(100, result.FormStatus);
        }

        [Fact]
        public void OnlyMatchesAvailable_MatchWeightIsAppliedAtOneHundredPercent()
        {
            var result = Calc(NoTrainings, ExampleMatches(70));

            Assert.Equal(0.0, result.TrainingWeightApplied, precision: 6);
            Assert.Equal(1.0, result.MatchWeightApplied, precision: 6);
            Assert.Null(result.TrainingComponent);
            Assert.Equal(100, result.FormStatus);
        }

        [Fact]
        public void TeamPlayedMatches_ButPlayerHasNoneComputable_MatchComponentIsZeroAndNotRenormalized()
        {
            var result = Calc(ExampleTrainings(), new[] { Match(5, 0, ParticipationOutcome.Excluded), Match(12, 0, ParticipationOutcome.Excluded) });

            Assert.Equal(0, result.MatchesConsidered);
            Assert.Equal(0d, result.MatchComponent);
            Assert.Equal(0.55, result.TrainingWeightApplied, precision: 6);
            Assert.Equal(0.45, result.MatchWeightApplied, precision: 6);
            Assert.InRange(result.FormStatus!.Value, 0, 55);
        }

        [Fact]
        public void TeamPlayedMatches_PlayerNeverPlays_WithFatigue_StaysBelowFiftyFiveTimesFactor()
        {
            var result = Calc(ExampleTrainings(), new[] { Match(5, 0, ParticipationOutcome.Excluded) }, fatigue: 20);

            Assert.True(result.FormStatus <= 50);
        }

        [Fact]
        public void TeamOfferedTrainings_ButPlayerHasNoneComputable_TrainingComponentIsZeroAndNotRenormalized()
        {
            var result = Calc(new[] { Training(3, ParticipationOutcome.Excluded) }, ExampleMatches(70));

            Assert.Equal(0d, result.TrainingComponent);
            Assert.Equal(0.55, result.TrainingWeightApplied, precision: 6);
            Assert.Equal(0.45, result.MatchWeightApplied, precision: 6);
            Assert.Equal(45, result.FormStatus);
        }

        [Fact]
        public void OutOfWindowExcludedMatches_DoNotCountAsTeamMatches_SoTrainingsRenormalize()
        {
            var result = Calc(new[] { Training(1) }, new[] { Match(50, 0, ParticipationOutcome.Excluded) });

            Assert.Null(result.MatchComponent);
            Assert.Equal(1.0, result.TrainingWeightApplied, precision: 6);
        }

        [Fact]
        public void EverythingExcluded_NoComputableData_FormStatusIsNull()
        {
            var result = Calc(new[] { Training(3, ParticipationOutcome.Excluded) }, new[] { Match(5, 0, ParticipationOutcome.Excluded) });

            Assert.Null(result.FormStatus);
        }

        [Fact]
        public void BothBlocksAvailable_NominalWeightsAreApplied()
        {
            var result = Calc(new[] { Training(1) }, new[] { Match(1, 70) });

            Assert.Equal(0.55, result.TrainingWeightApplied, precision: 6);
            Assert.Equal(0.45, result.MatchWeightApplied, precision: 6);
            Assert.Equal(0.55, result.TrainingWeightNominal, precision: 6);
            Assert.Equal(0.45, result.MatchWeightNominal, precision: 6);
        }

        [Fact]
        public void CaseA_AttendsEverythingAndPlaysFull_FatigueTwenty_IsNinety()
        {
            var result = Calc(ExampleTrainings(), ExampleMatches(70), fatigue: 20);

            Assert.Equal(100, result.BaseScore, precision: 6);
            Assert.Equal(0.90, result.FatigueFactor, precision: 6);
            Assert.Equal(90, result.FormStatus);
        }

        [Fact]
        public void CaseA_FatigueZero_IsOneHundred()
        {
            Assert.Equal(100, Calc(ExampleTrainings(), ExampleMatches(70), fatigue: 0).FormStatus);
        }

        [Fact]
        public void CaseB_MissesTwoOfTwelveTrainings_IsSeventyFour()
        {
            var result = Calc(ExampleTrainings(10, 24), ExampleMatches(70), fatigue: 20);

            // Ratio 81.8 x volumen (10 asistidas / 12 = 0.833) = 68.2; base 82.5 x 0.9
            Assert.Equal(81.8, result.TrainingRatioComponent!.Value, precision: 1);
            Assert.Equal(68.2, result.TrainingComponent!.Value, precision: 1);
            Assert.Equal(74, result.FormStatus);
        }

        [Fact]
        public void CaseC_AttendsEverythingButPlaysTenMinutes_IsFiftyFive()
        {
            var result = Calc(ExampleTrainings(), ExampleMatches(10), fatigue: 20);

            // Partidos 14.3 (10'/70') -> base 0.55x100 + 0.45x14.3 = 61.4 x 0.9
            Assert.Equal(14.3, result.MatchComponent!.Value, precision: 1);
            Assert.Equal(55, result.FormStatus);
        }

        [Fact]
        public void CaseD_MissesTwoTrainingsAndPlaysTenMinutes_IsForty()
        {
            Assert.Equal(40, Calc(ExampleTrainings(10, 24), ExampleMatches(10), fatigue: 20).FormStatus);
        }

        [Fact]
        public void CaseE_AttendsEverythingButNeverPlays_IsFifty_AndFiftyFiveWithoutFatigue()
        {
            var notPlayed = ExampleMatchDays.Select(d => Match(d, 0)).ToList();

            Assert.Equal(50, Calc(ExampleTrainings(), notPlayed, fatigue: 20).FormStatus);
            Assert.Equal(55, Calc(ExampleTrainings(), notPlayed, fatigue: 0).FormStatus);
        }

        [Fact]
        public void FatigueOneHundred_HalvesTheScore()
        {
            var result = Calc(ExampleTrainings(), ExampleMatches(70), fatigue: 100);

            Assert.Equal(0.5, result.FatigueFactor, precision: 6);
            Assert.Equal(100, result.Fatigue);
            Assert.Equal(50, result.FormStatus);
        }

        [Fact]
        public void MatchBlock_WeightsRatiosByRecency()
        {
            var result = Calc(NoTrainings, new[] { Match(1, 70), Match(21, 0, ParticipationOutcome.Absent) });

            Assert.Equal(1.5, result.MatchRecencyWeightSum, precision: 6);
            Assert.Equal(1.0, result.MatchRatioWeightedSum, precision: 6);
            Assert.Equal(100.0 / 1.5, result.MatchComponent!.Value, precision: 6);
        }

        private static List<PlayerFormStatusCalculator.TrainingParticipation> AttendedOnDays(int count) =>
            Enumerable.Range(1, count).Select(i => Training(i)).ToList();

        [Fact]
        public void ReferenceVolume_IsTwelveTrainingSessions()
        {
            Assert.Equal(12, PlayerFormStatusCalculator.ReferenceTrainingSessions);
        }

        [Theory]
        [InlineData(6, 0.5)]
        [InlineData(12, 1.0)]
        [InlineData(13, 1.0)]
        public void TrainingVolume_ScalesBelowReferenceAndDoesNotPenalizeAtOrAbove(int sessions, double expectedFactor)
        {
            var result = Calc(AttendedOnDays(sessions), NoMatches);

            Assert.Equal(expectedFactor, result.TrainingVolumeFactor!.Value, precision: 6);
            Assert.Equal(100, result.TrainingRatioComponent!.Value, precision: 6);
            Assert.Equal(100 * expectedFactor, result.TrainingComponent!.Value, precision: 6);
        }

        [Fact]
        public void MatchBlock_FewMatchesAreNotPenalizedByVolume()
        {
            var result = Calc(NoTrainings, new[] { Match(1, 70), Match(2, 70) });

            Assert.Equal(100, result.MatchComponent!.Value, precision: 6);
            Assert.Equal(100, result.FormStatus);
        }

        [Fact]
        public void MatchMinutesPossibleTotal_SumsCategoryMinutesOfConsideredMatches()
        {
            var result = Calc(NoTrainings, new[] { Match(3, 70), Match(5, 64), Match(6, 0, ParticipationOutcome.Excluded) });

            Assert.Equal(134, result.MatchMinutesPlayedTotal);
            Assert.Equal(160, result.MatchMinutesPossibleTotal);
        }

        [Fact]
        public void MatchMinutesPossibleTotal_IsZeroWithoutConsideredMatches()
        {
            Assert.Equal(0, Calc(ExampleTrainings(), NoMatches).MatchMinutesPossibleTotal);
        }

        [Fact]
        public void OnlyTrainingsBlockPresent_LowVolumeLowersResult_FactorIsNotRenormalized()
        {
            var result = Calc(AttendedOnDays(6), NoMatches);

            Assert.Null(result.MatchComponent);
            Assert.Equal(1.0, result.TrainingWeightApplied, precision: 6);
            Assert.Equal(50, result.FormStatus);
        }

        [Fact]
        public void EarlySeasonPlayer_SevenOfSevenTrainingsAndTwoFriendlies_IsAboutSixtySeven()
        {
            // Caso real (Lucas, cadete): 7/7 entrenos, 134' en 2 amistosos, cansancio 22.
            var trainings = AttendedOnDays(7);
            var matches = new[] { Match(3, 70, eventTypeId: FriendlyEventTypeId), Match(5, 64, eventTypeId: FriendlyEventTypeId) };

            var result = Calc(trainings, matches, fatigue: 22);

            Assert.Equal(58.3, result.TrainingComponent!.Value, precision: 1);
            Assert.Equal(95.7, result.MatchComponent!.Value, precision: 1);
            Assert.Equal(75.15, result.BaseScore, precision: 2);
            Assert.Equal(134, result.MatchMinutesPlayedTotal);
            Assert.Equal(160, result.MatchMinutesPossibleTotal);
            Assert.Equal(67, result.FormStatus);
        }

        [Fact]
        public void PlayerWhoBarelyTrainedAndNeverPlayed_IsAtMostTwenty()
        {
            // Caso real (Zuri): 5 de 7 entrenos, 0 minutos, 2 amistosos ausente.
            var trainings = Enumerable.Range(1, 7)
                .Select(d => Training(d, d <= 5 ? ParticipationOutcome.Attended : ParticipationOutcome.Absent))
                .ToList();
            var matches = new[] { Match(2, 0, ParticipationOutcome.Absent, FriendlyEventTypeId), Match(4, 0, ParticipationOutcome.Absent, FriendlyEventTypeId) };

            var result = Calc(trainings, matches, fatigue: 0);

            Assert.True(result.FormStatus <= 20, $"FormStatus was {result.FormStatus}");
        }

        [Fact]
        public void IdealPlayer_TwelveSessionsAndFullMatches_NoFatigue_IsOneHundred()
        {
            var result = Calc(ExampleTrainings(), ExampleMatches(70), fatigue: 0);

            Assert.Equal(1.0, result.TrainingVolumeFactor!.Value, precision: 6);
            Assert.Equal(100, result.FormStatus);
        }
    }
}
