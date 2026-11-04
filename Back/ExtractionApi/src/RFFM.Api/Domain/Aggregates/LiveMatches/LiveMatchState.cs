#nullable enable
using System;

namespace RFFM.Api.Domain.Aggregates.LiveMatches;

public static class LiveMatchPhases
{
    public const string PreMatch = "preMatch", FirstHalf = "firstHalf", Halftime = "halftime", SecondHalf = "secondHalf", Finished = "finished";
}

public static class LiveMatchActionTypes
{
    public const string SetLineup = "setLineup", SetDuration = "setDuration", KickOff = "kickOff", EndHalf = "endHalf",
        StartSecondHalf = "startSecondHalf", AdjustClock = "adjustClock", Goal = "goal", Card = "card",
        Substitution = "substitution", FormationChange = "formationChange";
}

public sealed record LiveMatchDocuments(string? StartingLineupJson, string? PlayersJson, string? SubstitutionWindowsJson,
    string? RatingSnapshotsJson, string? GoalsJson, string? CardsJson, string? FormationChangesJson);

public sealed record LiveMatchActionInput(string Type, int? DurationMinutes, int? DeltaSeconds, string? Formation,
    int? ScoreLocal, int? ScoreVisitor, LiveMatchDocuments? Documents);

public sealed record LiveMatchApplyResult(bool IsSuccess, string? ErrorCode, string? ErrorMessage);

public sealed class LiveMatchState
{
    private const int MaxMatchDurationMinutes = 200;
    private const string ClosedErrorCode = "LiveMatchClosed";
    private const string PhaseErrorCode = "LiveMatchPhaseNotAllowed";
    private const string InvalidPayloadErrorCode = "LiveMatchInvalidPayload";
    private const string UnknownActionErrorCode = "LiveMatchUnknownAction";
    private const string PhaseNotAllowedMessage = "La acción no está permitida en la fase actual del partido.";

    private static readonly LiveMatchApplyResult Applied = new(true, null, null);

    public string EventId { get; private set; } = string.Empty;
    public string TeamId { get; private set; } = string.Empty;
    public int Version { get; private set; } = 1;
    public string Phase { get; private set; } = LiveMatchPhases.PreMatch;
    public int ClockBaseSeconds { get; private set; }
    public DateTime? ClockReferenceUtc { get; private set; }
    public int MatchDurationMinutes { get; private set; }
    public int ScoreLocal { get; private set; }
    public int ScoreVisitor { get; private set; }
    public string? Formation { get; private set; }
    public LiveMatchDocuments Documents { get; private set; } = new(null, null, null, null, null, null, null);
    public DateTime? ClosedAtUtc { get; private set; }
    public bool IsClosed => ClosedAtUtc is not null;

    private bool IsPlayPhase => Phase is LiveMatchPhases.FirstHalf or LiveMatchPhases.Halftime or LiveMatchPhases.SecondHalf;

    private LiveMatchState() { }

    public static LiveMatchState Create(string eventId, string teamId, int matchDurationMinutes, DateTime serverNow, string? userId)
        => new()
        {
            EventId = eventId,
            TeamId = teamId,
            MatchDurationMinutes = matchDurationMinutes,
        };

    public LiveMatchApplyResult Apply(LiveMatchActionInput action, DateTime serverNow, string? userId)
    {
        if (IsClosed)
            return Rejected(ClosedErrorCode, "La partida en directo ya está cerrada.");

        var result = action.Type switch
        {
            LiveMatchActionTypes.SetLineup => SetLineup(action),
            LiveMatchActionTypes.SetDuration => SetDuration(action),
            LiveMatchActionTypes.KickOff => KickOff(serverNow),
            LiveMatchActionTypes.EndHalf => EndHalf(serverNow),
            LiveMatchActionTypes.StartSecondHalf => StartSecondHalf(serverNow),
            LiveMatchActionTypes.AdjustClock => AdjustClock(action, serverNow),
            LiveMatchActionTypes.Goal => Goal(action),
            LiveMatchActionTypes.Card => Card(action),
            LiveMatchActionTypes.Substitution => Substitution(action),
            LiveMatchActionTypes.FormationChange => FormationChange(action),
            _ => Rejected(UnknownActionErrorCode, "Tipo de acción desconocido."),
        };

        if (result.IsSuccess)
            Version++;
        return result;
    }

    public LiveMatchApplyResult Close(DateTime serverNow, string? userId)
    {
        if (IsClosed)
            return Rejected(ClosedErrorCode, "La partida en directo ya está cerrada.");
        if (Phase != LiveMatchPhases.SecondHalf)
            return PhaseNotAllowed();

        FreezeClock(serverNow);
        Phase = LiveMatchPhases.Finished;
        ClosedAtUtc = serverNow;
        Version++;
        return Applied;
    }

    public int ElapsedSeconds(DateTime serverNow)
    {
        if (ClockReferenceUtc is not { } reference)
            return ClockBaseSeconds;

        var runningSeconds = (int)(serverNow - reference).TotalSeconds;
        return ClockBaseSeconds + Math.Max(0, runningSeconds);
    }

    private LiveMatchApplyResult SetLineup(LiveMatchActionInput action)
    {
        if (Phase != LiveMatchPhases.PreMatch)
            return PhaseNotAllowed();

        Formation = action.Formation ?? Formation;
        Documents = Documents with
        {
            StartingLineupJson = action.Documents?.StartingLineupJson ?? Documents.StartingLineupJson,
            PlayersJson = action.Documents?.PlayersJson ?? Documents.PlayersJson,
        };
        return Applied;
    }

    private LiveMatchApplyResult SetDuration(LiveMatchActionInput action)
    {
        if (Phase != LiveMatchPhases.PreMatch)
            return PhaseNotAllowed();
        if (action.DurationMinutes is not int durationMinutes || durationMinutes is < 1 or > MaxMatchDurationMinutes)
            return Rejected(InvalidPayloadErrorCode, $"La duración del partido debe estar entre 1 y {MaxMatchDurationMinutes} minutos.");

        MatchDurationMinutes = durationMinutes;
        return Applied;
    }

    private LiveMatchApplyResult KickOff(DateTime serverNow)
    {
        if (Phase != LiveMatchPhases.PreMatch)
            return PhaseNotAllowed();

        Phase = LiveMatchPhases.FirstHalf;
        ClockReferenceUtc = serverNow;
        return Applied;
    }

    private LiveMatchApplyResult EndHalf(DateTime serverNow)
    {
        if (Phase != LiveMatchPhases.FirstHalf)
            return PhaseNotAllowed();

        FreezeClock(serverNow);
        Phase = LiveMatchPhases.Halftime;
        return Applied;
    }

    private LiveMatchApplyResult StartSecondHalf(DateTime serverNow)
    {
        if (Phase != LiveMatchPhases.Halftime)
            return PhaseNotAllowed();

        Phase = LiveMatchPhases.SecondHalf;
        ClockReferenceUtc = serverNow;
        return Applied;
    }

    private LiveMatchApplyResult AdjustClock(LiveMatchActionInput action, DateTime serverNow)
    {
        if (!IsPlayPhase)
            return PhaseNotAllowed();
        if (action.DeltaSeconds is not int deltaSeconds)
            return Rejected(InvalidPayloadErrorCode, "El ajuste del reloj requiere los segundos a sumar o restar.");

        var adjustedSeconds = Math.Clamp((long)ElapsedSeconds(serverNow) + deltaSeconds, 0, int.MaxValue);
        ClockBaseSeconds = (int)adjustedSeconds;
        if (ClockReferenceUtc is not null)
            ClockReferenceUtc = serverNow;
        return Applied;
    }

    private LiveMatchApplyResult Goal(LiveMatchActionInput action)
    {
        if (!IsPlayPhase)
            return PhaseNotAllowed();

        ScoreLocal = action.ScoreLocal ?? ScoreLocal;
        ScoreVisitor = action.ScoreVisitor ?? ScoreVisitor;
        Documents = Documents with
        {
            GoalsJson = action.Documents?.GoalsJson ?? Documents.GoalsJson,
        };
        return Applied;
    }

    private LiveMatchApplyResult Card(LiveMatchActionInput action)
    {
        if (!IsPlayPhase)
            return PhaseNotAllowed();

        Documents = Documents with
        {
            CardsJson = action.Documents?.CardsJson ?? Documents.CardsJson,
            PlayersJson = action.Documents?.PlayersJson ?? Documents.PlayersJson,
        };
        return Applied;
    }

    private LiveMatchApplyResult Substitution(LiveMatchActionInput action)
    {
        if (!IsPlayPhase)
            return PhaseNotAllowed();

        Documents = Documents with
        {
            PlayersJson = action.Documents?.PlayersJson ?? Documents.PlayersJson,
            SubstitutionWindowsJson = action.Documents?.SubstitutionWindowsJson ?? Documents.SubstitutionWindowsJson,
            RatingSnapshotsJson = action.Documents?.RatingSnapshotsJson ?? Documents.RatingSnapshotsJson,
        };
        return Applied;
    }

    private LiveMatchApplyResult FormationChange(LiveMatchActionInput action)
    {
        if (!IsPlayPhase)
            return PhaseNotAllowed();

        Formation = action.Formation ?? Formation;
        Documents = Documents with
        {
            FormationChangesJson = action.Documents?.FormationChangesJson ?? Documents.FormationChangesJson,
        };
        return Applied;
    }

    private void FreezeClock(DateTime serverNow)
    {
        ClockBaseSeconds = ElapsedSeconds(serverNow);
        ClockReferenceUtc = null;
    }

    private static LiveMatchApplyResult PhaseNotAllowed() => Rejected(PhaseErrorCode, PhaseNotAllowedMessage);

    private static LiveMatchApplyResult Rejected(string errorCode, string errorMessage) => new(false, errorCode, errorMessage);
}
