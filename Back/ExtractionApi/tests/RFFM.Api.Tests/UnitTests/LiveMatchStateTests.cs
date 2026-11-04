#nullable enable
using System;
using RFFM.Api.Domain.Aggregates.LiveMatches;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class LiveMatchStateTests
    {
        private static readonly DateTime KickOffAt = new(2026, 11, 4, 10, 0, 0, DateTimeKind.Utc);

        private static LiveMatchState NewPreMatch() =>
            LiveMatchState.Create("e1", "t1", 60, KickOffAt, "u1");

        private static LiveMatchState FirstHalfRunning()
        {
            var state = NewPreMatch();
            state.Apply(Action(LiveMatchActionTypes.KickOff), KickOffAt, "u1");
            return state;
        }

        private static LiveMatchState Halftime()
        {
            var state = FirstHalfRunning();
            state.Apply(Action(LiveMatchActionTypes.EndHalf), KickOffAt.AddSeconds(1800), "u1");
            return state;
        }

        private static LiveMatchState SecondHalfRunning()
        {
            var state = Halftime();
            state.Apply(Action(LiveMatchActionTypes.StartSecondHalf), KickOffAt.AddSeconds(3600), "u1");
            return state;
        }

        private static LiveMatchActionInput Action(
            string type,
            int? durationMinutes = null,
            int? deltaSeconds = null,
            string? formation = null,
            int? scoreLocal = null,
            int? scoreVisitor = null,
            LiveMatchDocuments? documents = null) =>
            new(type, durationMinutes, deltaSeconds, formation, scoreLocal, scoreVisitor, documents);

        private static LiveMatchDocuments Documents(
            string? startingLineupJson = null,
            string? playersJson = null,
            string? goalsJson = null,
            string? cardsJson = null) =>
            new(startingLineupJson, playersJson, null, null, goalsJson, cardsJson, null);

        [Fact]
        public void Create_LiveStateCreatedForEventWithoutOne_IsPreMatchAtVersionOne()
        {
            var state = NewPreMatch();

            Assert.Equal(1, state.Version);
            Assert.Equal(LiveMatchPhases.PreMatch, state.Phase);
            Assert.Equal(0, state.ClockBaseSeconds);
            Assert.Null(state.ClockReferenceUtc);
            Assert.False(state.IsClosed);
        }

        [Fact]
        public void Create_NewState_StoresEventTeamAndDuration()
        {
            var state = NewPreMatch();

            Assert.Equal("e1", state.EventId);
            Assert.Equal("t1", state.TeamId);
            Assert.Equal(60, state.MatchDurationMinutes);
        }

        [Fact]
        public void Apply_KickOffInPreMatch_SetsClockReferenceAndFirstHalf()
        {
            var state = NewPreMatch();

            var result = state.Apply(Action(LiveMatchActionTypes.KickOff), KickOffAt, "u1");

            Assert.True(result.IsSuccess);
            Assert.Equal(LiveMatchPhases.FirstHalf, state.Phase);
            Assert.Equal(0, state.ClockBaseSeconds);
            Assert.Equal(KickOffAt, state.ClockReferenceUtc);
        }

        [Fact]
        public void Apply_SavedAction_IncrementsVersion()
        {
            var state = NewPreMatch();

            state.Apply(Action(LiveMatchActionTypes.KickOff), KickOffAt, "u1");

            Assert.Equal(2, state.Version);
        }

        [Fact]
        public void Apply_EndHalfWhileFirstHalfRuns_FreezesClockAtElapsedSeconds()
        {
            var state = FirstHalfRunning();
            var endAt = KickOffAt.AddSeconds(1800);

            var result = state.Apply(Action(LiveMatchActionTypes.EndHalf), endAt, "u1");

            Assert.True(result.IsSuccess);
            Assert.Equal(LiveMatchPhases.Halftime, state.Phase);
            Assert.Equal(1800, state.ClockBaseSeconds);
            Assert.Null(state.ClockReferenceUtc);
            Assert.Equal(1800, state.ElapsedSeconds(KickOffAt.AddSeconds(2400)));
        }

        [Fact]
        public void Apply_StartSecondHalfFromHalftime_ResumesFromFrozenTotal()
        {
            var state = Halftime();
            var resumeAt = KickOffAt.AddSeconds(3600);

            var result = state.Apply(Action(LiveMatchActionTypes.StartSecondHalf), resumeAt, "u1");

            Assert.True(result.IsSuccess);
            Assert.Equal(LiveMatchPhases.SecondHalf, state.Phase);
            Assert.Equal(1800, state.ClockBaseSeconds);
            Assert.Equal(resumeAt, state.ClockReferenceUtc);
            Assert.Equal(1860, state.ElapsedSeconds(resumeAt.AddSeconds(60)));
        }

        [Fact]
        public void Apply_AdjustClockPlusTwoMinutesWhileRunning_MovesBaseAndReferenceToNow()
        {
            var state = FirstHalfRunning();
            var adjustAt = KickOffAt.AddSeconds(1800);

            var result = state.Apply(Action(LiveMatchActionTypes.AdjustClock, deltaSeconds: 120), adjustAt, "u1");

            Assert.True(result.IsSuccess);
            Assert.Equal(1920, state.ClockBaseSeconds);
            Assert.Equal(adjustAt, state.ClockReferenceUtc);
        }

        [Fact]
        public void Apply_AdjustClockWhileFrozen_MovesBaseAndKeepsClockFrozen()
        {
            var state = Halftime();

            var result = state.Apply(
                Action(LiveMatchActionTypes.AdjustClock, deltaSeconds: 120),
                KickOffAt.AddSeconds(2000),
                "u1");

            Assert.True(result.IsSuccess);
            Assert.Equal(1920, state.ClockBaseSeconds);
            Assert.Null(state.ClockReferenceUtc);
        }

        [Fact]
        public void Apply_AdjustClockBelowZero_NeverMovesBaseBelowZero()
        {
            var state = FirstHalfRunning();
            var adjustAt = KickOffAt.AddSeconds(600);

            var result = state.Apply(Action(LiveMatchActionTypes.AdjustClock, deltaSeconds: -5000), adjustAt, "u1");

            Assert.True(result.IsSuccess);
            Assert.Equal(0, state.ElapsedSeconds(adjustAt));
        }

        [Fact]
        public void Apply_SetLineupInPreMatch_StoresLineupFormationAndIncrementsVersion()
        {
            var state = NewPreMatch();
            var documents = Documents(startingLineupJson: "[\"p1\",\"p2\"]", playersJson: "[{\"id\":\"p1\"}]");

            var result = state.Apply(
                Action(LiveMatchActionTypes.SetLineup, formation: "4-4-2", documents: documents),
                KickOffAt,
                "u1");

            Assert.True(result.IsSuccess);
            Assert.Equal("4-4-2", state.Formation);
            Assert.Equal("[\"p1\",\"p2\"]", state.Documents.StartingLineupJson);
            Assert.Equal(2, state.Version);
        }

        [Fact]
        public void Apply_SetLineupAfterKickOff_IsRejectedAndVersionUnchanged()
        {
            var state = FirstHalfRunning();
            var versionBefore = state.Version;

            var result = state.Apply(
                Action(LiveMatchActionTypes.SetLineup, formation: "4-3-3"),
                KickOffAt.AddSeconds(60),
                "u1");

            Assert.False(result.IsSuccess);
            Assert.NotNull(result.ErrorCode);
            Assert.Equal(versionBefore, state.Version);
        }

        [Fact]
        public void Apply_SetDurationInPreMatch_StoresDuration()
        {
            var state = NewPreMatch();

            var result = state.Apply(Action(LiveMatchActionTypes.SetDuration, durationMinutes: 70), KickOffAt, "u1");

            Assert.True(result.IsSuccess);
            Assert.Equal(70, state.MatchDurationMinutes);
            Assert.Equal(2, state.Version);
        }

        [Fact]
        public void Apply_SetDurationOfZero_IsRejectedAndDurationUnchanged()
        {
            var state = NewPreMatch();

            var result = state.Apply(Action(LiveMatchActionTypes.SetDuration, durationMinutes: 0), KickOffAt, "u1");

            Assert.False(result.IsSuccess);
            Assert.NotNull(result.ErrorCode);
            Assert.Equal(60, state.MatchDurationMinutes);
            Assert.Equal(1, state.Version);
        }

        [Fact]
        public void Apply_GoalWhileRunning_StoresScoreAndGoalsAndIgnoresDocumentsOutsideWhitelist()
        {
            var state = FirstHalfRunning();
            var documents = Documents(goalsJson: "[{\"minute\":12}]", cardsJson: "[{\"minute\":5}]");

            var result = state.Apply(
                Action(LiveMatchActionTypes.Goal, scoreLocal: 1, scoreVisitor: 0, documents: documents),
                KickOffAt.AddSeconds(720),
                "u1");

            Assert.True(result.IsSuccess);
            Assert.Equal(1, state.ScoreLocal);
            Assert.Equal(0, state.ScoreVisitor);
            Assert.Equal("[{\"minute\":12}]", state.Documents.GoalsJson);
            Assert.Null(state.Documents.CardsJson);
        }

        [Fact]
        public void Apply_GoalInPreMatch_IsRejected()
        {
            var state = NewPreMatch();

            var result = state.Apply(
                Action(LiveMatchActionTypes.Goal, scoreLocal: 1, scoreVisitor: 0),
                KickOffAt,
                "u1");

            Assert.False(result.IsSuccess);
            Assert.NotNull(result.ErrorCode);
            Assert.Equal(0, state.ScoreLocal);
        }

        [Fact]
        public void Apply_SubstitutionAtHalftime_Succeeds()
        {
            var state = Halftime();

            var result = state.Apply(Action(LiveMatchActionTypes.Substitution), KickOffAt.AddSeconds(2000), "u1");

            Assert.True(result.IsSuccess);
        }

        [Fact]
        public void Apply_ActionOnClosedState_IsRejectedAndVersionUnchanged()
        {
            var state = SecondHalfRunning();
            state.Close(KickOffAt.AddSeconds(5400), "u1");
            var versionBefore = state.Version;

            var result = state.Apply(
                Action(LiveMatchActionTypes.Goal, scoreLocal: 2, scoreVisitor: 1),
                KickOffAt.AddSeconds(5460),
                "u1");

            Assert.False(result.IsSuccess);
            Assert.NotNull(result.ErrorCode);
            Assert.Equal(0, state.ScoreLocal);
            Assert.Equal(versionBefore, state.Version);
        }

        [Fact]
        public void Close_InSecondHalf_FinishesAndFreezesClock()
        {
            var state = SecondHalfRunning();
            var finishAt = KickOffAt.AddSeconds(5400);

            var result = state.Close(finishAt, "u1");

            Assert.True(result.IsSuccess);
            Assert.Equal(LiveMatchPhases.Finished, state.Phase);
            Assert.True(state.IsClosed);
            Assert.Equal(finishAt, state.ClosedAtUtc);
            Assert.Null(state.ClockReferenceUtc);
            Assert.Equal(3600, state.ElapsedSeconds(finishAt.AddSeconds(600)));
        }

        [Fact]
        public void Close_BeforeSecondHalf_IsRejected()
        {
            var state = FirstHalfRunning();

            var result = state.Close(KickOffAt.AddSeconds(900), "u1");

            Assert.False(result.IsSuccess);
            Assert.False(state.IsClosed);
            Assert.Equal(LiveMatchPhases.FirstHalf, state.Phase);
        }
    }
}
