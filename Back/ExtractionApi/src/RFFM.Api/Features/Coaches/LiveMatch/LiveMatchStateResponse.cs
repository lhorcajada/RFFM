using RFFM.Api.Domain.Aggregates.LiveMatches;

namespace RFFM.Api.Features.Coaches.LiveMatch
{
    public sealed record LiveMatchClockResponse(int BaseSeconds, DateTime? ReferenceUtc);

    public sealed record LiveMatchMatchDataResponse(string? StartingLineupJson, string? PlayersJson, string? SubstitutionWindowsJson,
        string? RatingSnapshotsJson, string? GoalsJson, string? CardsJson, string? FormationChangesJson);

    public sealed record LiveMatchStateResponse(string EventId, string TeamId, int Version, string Phase, LiveMatchClockResponse Clock,
        int MatchDurationMinutes, int ScoreLocal, int ScoreVisitor, string? Formation, LiveMatchMatchDataResponse MatchData,
        bool IsClosed, DateTime ServerNowUtc)
    {
        public static LiveMatchStateResponse From(LiveMatchState state, DateTime serverNow)
            => new(
                state.EventId,
                state.TeamId,
                state.Version,
                state.Phase,
                new LiveMatchClockResponse(state.ClockBaseSeconds, state.ClockReferenceUtc),
                state.MatchDurationMinutes,
                state.ScoreLocal,
                state.ScoreVisitor,
                state.Formation,
                new LiveMatchMatchDataResponse(
                    state.Documents.StartingLineupJson,
                    state.Documents.PlayersJson,
                    state.Documents.SubstitutionWindowsJson,
                    state.Documents.RatingSnapshotsJson,
                    state.Documents.GoalsJson,
                    state.Documents.CardsJson,
                    state.Documents.FormationChangesJson),
                state.IsClosed,
                serverNow);
    }
}
