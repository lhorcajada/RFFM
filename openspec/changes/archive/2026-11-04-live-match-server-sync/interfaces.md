## Step 1: Live match state aggregate and clock rules

**Interfaces**:
```csharp
namespace RFFM.Api.Domain.Aggregates.LiveMatches;

public static class LiveMatchPhases { public const string PreMatch = "preMatch", FirstHalf = "firstHalf", Halftime = "halftime", SecondHalf = "secondHalf", Finished = "finished"; }

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

public sealed class LiveMatchState
{
    public string EventId { get; }  public string TeamId { get; }  public int Version { get; }
    public string Phase { get; }  public int ClockBaseSeconds { get; }  public DateTime? ClockReferenceUtc { get; }
    public int MatchDurationMinutes { get; }  public int ScoreLocal { get; }  public int ScoreVisitor { get; }
    public string? Formation { get; }  public LiveMatchDocuments Documents { get; }  public DateTime? ClosedAtUtc { get; }
    public bool IsClosed { get; }

    public static LiveMatchState Create(string eventId, string teamId, int matchDurationMinutes, DateTime serverNow, string? userId);
    public LiveMatchApplyResult Apply(LiveMatchActionInput action, DateTime serverNow, string? userId);
    public LiveMatchApplyResult Close(DateTime serverNow, string? userId);   // finish transition, allowed only from secondHalf
    public int ElapsedSeconds(DateTime serverNow);
}

public sealed record LiveMatchApplyResult(bool IsSuccess, string? ErrorCode, string? ErrorMessage);
```

**Test assertions**:
- `Create("e1","t1",60, now, "u1")` yields Version 1, Phase `preMatch`, ClockBaseSeconds 0, ClockReferenceUtc null, IsClosed false (`openspec/changes/live-match-server-sync/specs/live-match-server-state/spec.md` § Single live state per event, scenario "Live state is created for an event without one").
- `Apply(kickOff)` at `preMatch` with now = T: Phase `firstHalf`, ClockBaseSeconds 0, ClockReferenceUtc T, Version 2 (same spec § Server-owned match clock, scenario "Kick-off sets the clock reference"; § Monotonic state version).
- `Apply(endHalf)` while `firstHalf` started at T, applied at T+1800s: Phase `halftime`, ClockBaseSeconds 1800, ClockReferenceUtc null; `ElapsedSeconds(T+2400s)` returns 1800 (scenario "End of half freezes the clock"; realtime spec scenario "Clock after a frozen phase" in `openspec/changes/live-match-server-sync/specs/live-match-realtime-sync/spec.md`).
- `Apply(startSecondHalf)` at `halftime` with base 1800 at T2: Phase `secondHalf`, ClockBaseSeconds 1800, ClockReferenceUtc T2; `ElapsedSeconds(T2+60s)` returns 1860.
- `Apply(adjustClock, DeltaSeconds=+120)` on a running match whose elapsed is 1800 at now: ClockBaseSeconds 1920, ClockReferenceUtc now; with DeltaSeconds=-5000 the base never goes below 0 (scenario "Minutes adjustment moves the clock").
- `Apply(setLineup)` at `preMatch` stores the lineup, formation and documents and increments Version; the same action at `firstHalf` returns `IsSuccess=false` with a phase error code and leaves Version unchanged (§ Pre-match lineup, formation and duration are stored).
- `Apply(setDuration, DurationMinutes=70)` at `preMatch` stores 70 and increments Version; DurationMinutes 0 or above the maximum match duration returns `IsSuccess=false` (scenario "Match duration is stored").
- `Apply(goal, ScoreLocal=1, ScoreVisitor=0, Documents{GoalsJson})` at `firstHalf` stores score and goals and ignores any document field outside the goal whitelist; `Apply(goal)` at `finished` or `preMatch` returns `IsSuccess=false`.
- `Apply(substitution)` at `halftime` succeeds; `Apply(card)` and `Apply(formationChange)` follow the same running-or-halftime guard.
- Any action on a closed state returns `IsSuccess=false` with a closed-state error code and Version unchanged.
- `Close(serverNow)` on a state in `secondHalf` sets Phase `finished`, freezes the clock at the elapsed seconds, sets ClosedAtUtc and increments Version (§ Finishing converts the live state into match participation).

## Step 2: Persistence, EF configuration and migration

**Interfaces**:
```csharp
// AppDbContext
public DbSet<LiveMatchState> LiveMatchStates => Set<LiveMatchState>();

// IEntityTypeConfiguration<LiveMatchState>
public sealed class LiveMatchStateEntityConfiguration : IEntityTypeConfiguration<LiveMatchState>
{
    public void Configure(EntityTypeBuilder<LiveMatchState> builder);
}
```
Table `app.LiveMatchStates`: `EventId` unique index, `Version` concurrency token, `MatchDataJson` text column.

**Test assertions**:
- Inserting two `LiveMatchState` rows with the same `EventId` throws `DbUpdateException` caused by the unique index (`openspec/changes/live-match-server-sync/specs/live-match-server-state/spec.md` § Single live state per event, scenario "Concurrent creation keeps one state").
- Loading one row in two contexts, saving an action in the first, then saving in the second throws `DbUpdateConcurrencyException` (§ Actions carry the base version, scenario "Two simultaneous actions on the same version").
- Saving and reloading a state preserves Phase, clock fields, score, formation and all seven JSON documents byte-for-byte.

## Step 3: Team access check and state response mapping

**Interfaces**:
```csharp
public static class LiveMatchTeamAccess
{
    public static Task<bool> IsTeamCoachAsync(AppDbContext db, string userId, string eventId, CancellationToken ct);
}

public sealed record LiveMatchClockResponse(int BaseSeconds, DateTime? ReferenceUtc);
public sealed record LiveMatchMatchDataResponse(string? StartingLineupJson, string? PlayersJson, string? SubstitutionWindowsJson,
    string? RatingSnapshotsJson, string? GoalsJson, string? CardsJson, string? FormationChangesJson);
public sealed record LiveMatchStateResponse(string EventId, string TeamId, int Version, string Phase, LiveMatchClockResponse Clock,
    int MatchDurationMinutes, int ScoreLocal, int ScoreVisitor, string? Formation, LiveMatchMatchDataResponse MatchData,
    bool IsClosed, DateTime ServerNowUtc)
{
    public static LiveMatchStateResponse From(LiveMatchState state, DateTime serverNow);
}
```

**Test assertions**:
- A user with a `UserTeams` row of coach membership for the event's team: `IsTeamCoachAsync` returns true (`openspec/changes/live-match-server-sync/specs/live-match-team-access/spec.md` § Only coaches of the event team can read and act, scenario "Assigned coach reads the live match").
- A coach assigned to a different team returns false (scenario "Coach of another team").
- An administrator with no `UserTeams` row returns false (scenario "Administrator without team"); a non-coach membership on the same team also returns false.
- An unknown event id returns false.
- `LiveMatchStateResponse.From(state, now)` carries `ServerNowUtc == now`, the state's version and a null `Clock.ReferenceUtc` when the clock is frozen (`openspec/changes/live-match-server-sync/specs/live-match-server-state/spec.md` § Monotonic state version, scenario "Reading returns the full state with its version").

## Step 4: SignalR hub, broadcaster and hub authentication

**Interfaces**:
```csharp
public sealed class LiveMatchHub : Hub
{
    public static string GroupName(string eventId);          // "liveMatch-{eventId}"
    public Task JoinMatch(string eventId);                    // throws HubException when not a team coach
    public Task LeaveMatch(string eventId);
}

public interface ILiveMatchBroadcaster
{
    Task BroadcastUpdatedAsync(string eventId, LiveMatchStateResponse state, CancellationToken ct);
    Task BroadcastDeletedAsync(string eventId, CancellationToken ct);
}

public sealed class LiveMatchBroadcaster(IHubContext<LiveMatchHub> hub) : ILiveMatchBroadcaster { }

public static class LiveMatchHubAuthentication
{
    public static bool AllowsQueryStringToken(PathString path);   // true only under "/hubs"
}
```
Hub events sent to clients: `MatchUpdated(LiveMatchStateResponse)` and `MatchDeleted(string eventId)`. Endpoint mapped at `/hubs/live-match` with `RequireAuthorization()`.

**Test assertions**:
- `AllowsQueryStringToken("/hubs/live-match")` is true; `AllowsQueryStringToken("/api/events/e1/live-match")` is false (`openspec/changes/live-match-server-sync/specs/live-match-realtime-sync/spec.md` § Hub authentication through the access token query string, scenario "Query-string token outside the hub").
- `JoinMatch("e1")` by a team coach adds the connection to group `liveMatch-e1` (`openspec/changes/live-match-server-sync/specs/live-match-team-access/spec.md` § Hub join is restricted to the event team, scenario "Authorized join").
- `JoinMatch("e1")` by a user who is not a team coach throws `HubException` and adds no group (scenario "Unauthorized join"); the REST check and the hub decide identically for the same user and event (§ One shared membership check).
- `BroadcastUpdatedAsync` sends exactly one `MatchUpdated` to group `liveMatch-{eventId}` with the given state (`openspec/changes/live-match-server-sync/specs/live-match-realtime-sync/spec.md` § One SignalR group per match, scenario "Saved action is broadcast"); `BroadcastDeletedAsync` sends one `MatchDeleted`.

## Step 5: Read and create live match slices

**Interfaces**:
```csharp
public class GetLiveMatch : IFeatureModule
{
    public record GetLiveMatchQuery(string EventId, string UserId) : IQueryApp<LiveMatchStateResponse>;
    public class Handler : IRequestHandler<GetLiveMatchQuery, LiveMatchStateResponse> { }   // NotFoundException when no state, ForbiddenException-style failure when not a team coach
}

public class CreateLiveMatch : IFeatureModule
{
    public record CreateLiveMatchCommand(string EventId, string UserId) : ICommand<CreateLiveMatchResult>;
    public record CreateLiveMatchResult(LiveMatchStateResponse State, bool Created);
    public class Handler : IRequestHandler<CreateLiveMatchCommand, CreateLiveMatchResult> { }
    public class Validator : AbstractValidator<CreateLiveMatchCommand> { }
}
```
Routes: `GET` and `POST` on the live-match resource of an event, roles `Coach,Administrator`; failures are ProblemDetails (404 no state, 403 not a team coach).

**Test assertions**:
- Get on an event without live state fails with not-found (404) (`openspec/changes/live-match-server-sync/specs/live-match-server-state/spec.md` § Single live state per event).
- Get by an assigned coach returns the state with `ServerNowUtc` set and the stored Version (§ Monotonic state version, scenario "Reading returns the full state with its version").
- Get by a coach of another team and by an administrator without team both fail with 403 (`openspec/changes/live-match-server-sync/specs/live-match-team-access/spec.md` scenarios "Coach of another team" and "Administrator without team").
- Create on an event without state returns `Created=true`, Phase `preMatch`, Version 1; a second Create returns `Created=false` with the same Version (state-server spec scenario "Live state is created for an event without one").
- Two Create calls run concurrently leave exactly one row and both results carry the same EventId and Version (scenario "Concurrent creation keeps one state").

## Step 6: Apply live match actions

**Interfaces**:
```csharp
public class ApplyLiveMatchAction : IFeatureModule
{
    public record ApplyLiveMatchActionRequest(string Type, int BaseVersion, ActionPayload? Payload);
    public record ActionPayload(int? DurationMinutes, int? DeltaSeconds, string? Formation, int? ScoreLocal, int? ScoreVisitor,
        LiveMatchDocuments? Documents);

    public record ApplyLiveMatchActionCommand(string EventId, string UserId, ApplyLiveMatchActionRequest Request)
        : ICommand<ApplyLiveMatchActionResult>;
    public record ApplyLiveMatchActionResult(LiveMatchStateResponse State, bool Conflict);

    public class Handler : IRequestHandler<ApplyLiveMatchActionCommand, ApplyLiveMatchActionResult> { }
    public class Validator : AbstractValidator<ApplyLiveMatchActionCommand> { }
}
```
Endpoint: `POST` on the actions sub-resource of the live match; 200 with the state, 409 ProblemDetails with extension `currentState` when `Conflict`, 400 ProblemDetails on validation failure, 403 when not a team coach.

**Test assertions**:
- State at version 7, action `goal` with BaseVersion 7: result `Conflict=false`, stored Version 8, one `BroadcastUpdatedAsync` call (`openspec/changes/live-match-server-sync/specs/live-match-server-state/spec.md` § Actions carry the base version, scenario "Action with matching base version").
- State at version 8, BaseVersion 7: `Conflict=true`, `State.Version == 8`, stored state unchanged, no broadcast (scenario "Action with obsolete base version"; `openspec/changes/live-match-server-sync/specs/live-match-realtime-sync/spec.md` scenario "Rejected action is not broadcast").
- Two commands with the same BaseVersion run concurrently: exactly one result has `Conflict=false`, the other `Conflict=true` with the winning state (scenario "Two simultaneous actions on the same version").
- Unknown `Type`, negative `BaseVersion`, or a payload field missing for the type (for example `adjustClock` without `DeltaSeconds`) fails validation and leaves the stored state unchanged (§ Invalid actions are rejected with ProblemDetails).
- A user who is not a team coach gets 403 and the state is unchanged (`openspec/changes/live-match-server-sync/specs/live-match-team-access/spec.md` scenario "Unauthorized action").
- `kickOff` stores the server instant as `ClockReferenceUtc` and the response carries `ServerNowUtc` (state-server spec § Server-owned match clock).

## Step 7: Extract the match participation writer

**Interfaces**:
```csharp
internal sealed class MatchParticipationWriter
{
    public MatchParticipationWriter(/* the dependencies SaveMatchParticipation.Handler already holds */);
    public Task SaveAsync(SaveMatchParticipation.SaveMatchParticipationRequest request, CancellationToken ct);
}
// SaveMatchParticipation.Handler: constructor and Handle signature unchanged; Handle delegates to MatchParticipationWriter.SaveAsync.
```

**Test assertions**:
- The unchanged suites `SaveMatchParticipationHandlerTests`, `SaveMatchParticipationAutomaticSanctionTests` and `SaveMatchParticipationMinutesLimitSanctionTests` pass with no edit, including: finished phase updates the event goals for calendar display, a fifth cyclic yellow creates an automatic sanction, a red card creates one, re-saving the same finished match creates no duplicate (`openspec/changes/live-match-server-sync/specs/coach-live-match-tracking/spec.md` § Match data is saved automatically when the match ends, scenario "Ending the match saves it").

## Step 8: Finish slice converts the live state

**Interfaces**:
```csharp
public class FinishLiveMatch : IFeatureModule
{
    public record FinishLiveMatchRequest(int BaseVersion, List<FinishPlayer> Players);
    public record FinishPlayer(string TeamPlayerId, int MinutesPlayed, bool IsStarter, int? EnteredAtMinute, int? ExitedAtMinute);
    public record FinishLiveMatchCommand(string EventId, string UserId, FinishLiveMatchRequest Request) : ICommand<FinishLiveMatchResult>;
    public record FinishLiveMatchResult(LiveMatchStateResponse State, bool Conflict);
    public class Handler : IRequestHandler<FinishLiveMatchCommand, FinishLiveMatchResult> { }
    public class Validator : AbstractValidator<FinishLiveMatchCommand> { }
}
// Handler: builds SaveMatchParticipation.SaveMatchParticipationRequest(MatchPhase = "finished", scores, *Json documents,
// MatchDurationMinutes, StartingLineupJson, Players from the request), then runs MatchParticipationWriter.SaveAsync and
// LiveMatchState.Close inside db.Database.CreateExecutionStrategy().ExecuteAsync with one transaction.
```
Route: `POST` on the finish sub-resource of the live match, roles `Coach,Administrator`; 200 closed state, 409 ProblemDetails with `currentState`, 400, 403. `Players` requires at least one entry.

**Test assertions**:
- Finish on a `secondHalf` state with players: `MatchParticipation` rows exist for the event with the final score and the supplied minutes, the live state has Phase `finished` and ClosedAtUtc set, and both were committed together (`openspec/changes/live-match-server-sync/specs/live-match-server-state/spec.md` § Finishing converts the live state into match participation, scenario "Finish converts and closes").
- A writer failure (forced exception) leaves zero `MatchParticipation` rows and the live state open with the same Version (scenario "Conversion failure keeps the live state").
- A stored red card makes the same automatic sanction a direct save would create (`SaveMatchParticipationAutomaticSanctionTests` behavior; `openspec/changes/live-match-server-sync/specs/coach-live-match-tracking/spec.md` § Match data is saved automatically when the match ends).
- After a successful finish exactly one `BroadcastUpdatedAsync` is sent with Phase `finished` (state-server spec scenario "Finish broadcasts to all devices"); an action sent afterwards through the action slice returns `Conflict=true` with the closed state.
- Finish with an obsolete BaseVersion returns `Conflict=true` and changes nothing; finish with an empty `Players` list or from `preMatch` fails validation and changes nothing; a user who is not a team coach gets 403.

## Step 9: Delete live match and API version bump

**Interfaces**:
```csharp
public class DeleteLiveMatch : IFeatureModule
{
    public record DeleteLiveMatchCommand(string EventId, string UserId) : ICommand;
    public class Handler : IRequestHandler<DeleteLiveMatchCommand, Unit> { }
    public class Validator : AbstractValidator<DeleteLiveMatchCommand> { }
}
```
Route: `DELETE` on the live-match resource of an event, roles `Coach,Administrator`, 204 on success. `Directory.Build.props` `<Version>` becomes 1.47.0.

**Test assertions**:
- Delete on an event with a live state and `MatchParticipation` rows removes both and sends one `BroadcastDeletedAsync` (`openspec/changes/live-match-server-sync/specs/live-match-server-state/spec.md` § Deleting a live match removes its state and participation, scenarios "Delete removes both records" and "Devices return to pre-match").
- Delete on an event with neither record succeeds without error (idempotent) for a team coach.
- A user who is not a team coach gets 403 and nothing is removed (`openspec/changes/live-match-server-sync/specs/live-match-team-access/spec.md` § Only coaches of the event team can read and act).
- The existing delete-participation endpoint behavior is unchanged: it still deletes only participation rows.

## Step 10: Frontend types, server clock helper and REST wrappers

**Interfaces**:
```ts
// liveMatch.types.ts
export type LiveMatchServerClock = { baseSeconds: number; referenceUtc: string | null };
export type LiveMatchServerState = {
  eventId: string; teamId: string; version: number; phase: LiveMatchPhase; clock: LiveMatchServerClock;
  matchDurationMinutes: number; scoreLocal: number; scoreVisitor: number; formation: string | null;
  matchData: { startingLineupJson: string | null; playersJson: string | null; substitutionWindowsJson: string | null;
    ratingSnapshotsJson: string | null; goalsJson: string | null; cardsJson: string | null; formationChangesJson: string | null };
  isClosed: boolean; serverNowUtc: string;
};
export type LiveMatchActionType = 'setLineup' | 'setDuration' | 'kickOff' | 'endHalf' | 'startSecondHalf' | 'adjustClock'
  | 'goal' | 'card' | 'substitution' | 'formationChange';
export type LiveMatchFinishPlayer = { teamPlayerId: string; minutesPlayed: number; isStarter: boolean;
  enteredAtMinute: number | null; exitedAtMinute: number | null };
export type LiveMatchActionRequest = { type: LiveMatchActionType; baseVersion: number; payload?: Record<string, unknown> };
export type LiveMatchActionResult = { conflict: false; state: LiveMatchServerState } | { conflict: true; state: LiveMatchServerState };

// utils/liveMatchClock.ts
export function computeElapsedSeconds(clock: LiveMatchServerClock, serverOffsetMs: number, nowMs: number): number;
export function computeServerOffsetMs(serverNowUtc: string, deviceReceivedAtMs: number): number;

// services/liveMatchService.ts (additions)
export function getLiveMatch(eventId: string): Promise<LiveMatchServerState | null>;          // 404 -> null
export function createLiveMatch(eventId: string): Promise<LiveMatchServerState>;
export function sendLiveMatchAction(eventId: string, request: LiveMatchActionRequest): Promise<LiveMatchActionResult>; // 409 -> conflict true
export function finishLiveMatch(eventId: string, baseVersion: number, players: LiveMatchFinishPlayer[]): Promise<LiveMatchActionResult>; // 409 -> conflict true
export function deleteLiveMatch(eventId: string): Promise<void>;
```

**Test assertions**:
- Running clock `{ baseSeconds: 600, referenceUtc: T }` with offset 0 at `T + 90 s` returns 690; a frozen clock (`referenceUtc: null`) returns 600 at any time (`openspec/changes/live-match-server-sync/specs/live-match-realtime-sync/spec.md` § Clock displayed with the server offset, scenario "Clock after a frozen phase").
- A device 20 s ahead of the server: `computeServerOffsetMs(serverNowUtc, deviceReceivedAtMs)` returns -20000 and `computeElapsedSeconds` then equals the value a correct device computes (scenario "Device clock differs from the server clock").
- The result never goes below 0 and is rounded down to whole seconds.
- `getLiveMatch` resolves `null` when the client rejects with status 404 and the state otherwise; `sendLiveMatchAction` resolves `{ conflict: true, state }` using the 409 body field `currentState`, and rethrows other errors; each wrapper calls the shared client, never a new Axios instance (`openspec/changes/live-match-server-sync/specs/live-match-realtime-sync/spec.md` § Rejected action discards the local action).

## Step 11: SignalR client service, dependency and dev proxy

**Interfaces**:
```ts
// services/liveMatchRealtimeService.ts
export type LiveMatchConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
export type LiveMatchRealtimeHandlers = {
  onMatchUpdated: (state: LiveMatchServerState) => void;
  onMatchDeleted: (eventId: string) => void;
  onReconnected: () => void;
  onStatusChange: (status: LiveMatchConnectionStatus) => void;
};
export type LiveMatchRealtimeConnection = {
  joinMatch(eventId: string): Promise<void>;
  leaveMatch(eventId: string): Promise<void>;
  stop(): Promise<void>;
};
export function connectLiveMatch(handlers: LiveMatchRealtimeHandlers): Promise<LiveMatchRealtimeConnection>;
```
`vite.config.ts` proxies the hub path with websocket support; `Front/package.json` lists `@microsoft/signalr`.

**Test assertions**:
- `connectLiveMatch` builds a connection to the live-match hub path whose access token factory returns the value stored under `coachAuthToken`, with automatic reconnect enabled (`openspec/changes/live-match-server-sync/specs/live-match-realtime-sync/spec.md` § Hub authentication through the access token query string, scenario "Hub connection with a valid token").
- A `MatchUpdated` message invokes `onMatchUpdated` once with the received state; `MatchDeleted` invokes `onMatchDeleted` with the event id.
- After the connection reports reconnected, `onReconnected` is invoked and `onStatusChange` goes `reconnecting` then `connected` (scenario "Reconnection").
- `joinMatch("e1")` invokes the hub method `JoinMatch` with `"e1"`; `leaveMatch` invokes `LeaveMatch`.

## Step 12: Server state hook

**Interfaces**:
```ts
// hooks/useLiveMatchServerState.ts
export type UseLiveMatchServerStateReturn = {
  state: LiveMatchServerState | null;
  status: 'loading' | 'ready' | 'offline';
  isOnline: boolean;
  serverOffsetMs: number;
  send: (type: LiveMatchActionType, payload?: Record<string, unknown>) => Promise<{ ok: boolean; conflict: boolean }>;
  finish: (players: LiveMatchFinishPlayer[]) => Promise<{ ok: boolean; conflict: boolean }>;
  ensureCreated: () => Promise<void>;
  remove: () => Promise<void>;
};
export function useLiveMatchServerState(eventId: string | undefined): UseLiveMatchServerStateReturn;
```

**Test assertions**:
- On mount the hook calls `getLiveMatch`, applies the returned state, joins the hub group and exposes `status: 'ready'` (`openspec/changes/live-match-server-sync/specs/live-match-realtime-sync/spec.md` § Full state recovery, scenario "Opening the screen"); a 404 leaves `state: null` until `ensureCreated` is called.
- After a reconnection callback it calls `getLiveMatch` again and applies the result (scenario "Reconnection").
- Holding version 5 and receiving `MatchUpdated` with version 8 triggers `getLiveMatch` and does not apply the received event (scenario "Version gap"); version 6 is applied directly.
- A `MatchUpdated` from another device replaces the state (scenario "State from another device").
- `send('goal', payload)` at version 4 calls `sendLiveMatchAction` with `baseVersion: 4` and applies the returned state (§ Server state is the source of truth in the frontend, scenario "Action sent with the base version").
- A conflict result applies the returned state, does not apply the local action and dispatches `rffm.show_snackbar` with a message asking the coach to repeat the action (§ Rejected action discards the local action, scenario "Rejection by obsolete version").
- When the connection status is not connected, `send` returns `{ ok: false, conflict: false }`, does not call the service and dispatches a no-connection snackbar (§ Actions are blocked without connection, scenario "Action while offline"); the exposed `serverOffsetMs` is unchanged so the clock keeps advancing (scenario "Clock while offline").
- `MatchDeleted` for the open event resets `state` to null and re-reads the state (state-server spec scenario "Devices return to pre-match" in `openspec/changes/live-match-server-sync/specs/live-match-server-state/spec.md`).

## Step 13: Switch useLiveMatch and PartidoEnDirectoTab to server state

**Interfaces**:
```ts
// hooks/useLiveMatch.ts: UseLiveMatchReturn keeps its existing members except the removed backup members
//   (backup, acceptBackup, discardBackup) and gains:
//   isOnline: boolean;
//   serverVersion: number | null;
// Actions keep their names and signatures (adjustClock, addGoal, addCard, changeFormation, setMatchDuration,
//   replaceWindows, deleteParticipation, ...), but each resolves by sending a server action and applying the returned state.

// services/liveMatchService.ts: removes saveLiveMatchBackup, loadLiveMatchBackup, clearLiveMatchBackup;
//   saveMatchParticipation and getMatchParticipation remain for manual edits of finished matches.
// liveMatch.types.ts: removes LiveMatchBackup.
// LiveMatchRecoveryDialog component file is deleted; PartidoEnDirectoTab no longer imports or renders it.

// hooks/__tests__/fakeLiveMatchServer.ts (test fixture)
export function createFakeLiveMatchServer(initial?: Partial<LiveMatchServerState>): {
  getLiveMatch: jest-compatible mock; sendLiveMatchAction: mock; finishLiveMatch: mock; emitUpdate(state: LiveMatchServerState): void;
  setOffline(offline: boolean): void; readonly state: LiveMatchServerState;
};
```

**Test assertions**:
- Finishing the match calls `finishLiveMatch` once with the player minutes and never calls `saveMatchParticipation`, and the saved-match banner appears after the server state arrives with phase finished (`openspec/changes/live-match-server-sync/specs/coach-live-match-tracking/spec.md` § Match data is saved automatically when the match ends, scenarios "Frontend does not post the final participation" and "Ending the match saves it").
- A failed finish (rejected request) shows the error with a retry action and keeps the screen data (scenario "Save fails"); no "Guardar datos del partido" button is rendered (scenario "No manual save button").
- Reloading mid-match after an expulsion restores the reduced formation from the server state with no recovery dialog (scenario "Current formation survives a reload"; `openspec/changes/live-match-server-sync/specs/live-match-realtime-sync/spec.md` scenario "Returning to the screen").
- Leaving the screen of a server-backed match writes nothing to `localStorage` (scenario "Leaving the screen mid-match"); with no server state and a legacy backup in `localStorage`, the backup key is removed and the pre-match phase is shown.
- `adjustClock(+2 minutes)` sends an `adjustClock` action with `deltaSeconds: 120` and the displayed time follows the returned server clock; a goal sent at base version 4 appears only after the returned state is applied (realtime spec § Server state is the source of truth in the frontend).
- While `isOnline` is false every action is blocked with a notice and the displayed clock keeps advancing from the last server reference (realtime spec § Actions are blocked without connection).
- A server-backed delete calls `deleteLiveMatch` and returns the screen to the pre-match phase on all devices (`openspec/changes/live-match-server-sync/specs/live-match-server-state/spec.md` § Deleting a live match removes its state and participation).
- The adapted `useLiveMatch.*` suites keep their original behavior assertions (goals ordering, expulsion formation, minutes limit sanctions, match duration, starting lineup, score setting) driven through the fake server instead of local state.
