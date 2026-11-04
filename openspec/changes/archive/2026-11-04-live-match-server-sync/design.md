## Target State

After the last step the live match is a shared, versioned resource owned by the backend. One row per sport event in `app.LiveMatchStates` holds the server-owned fields (phase, clock, score, duration, version) plus the client-computed football documents; four REST slices and one SignalR hub read and change it; the frontend renders what the server sends.

Finished shape of the state the server returns (REST responses, 409 bodies and `MatchUpdated` events carry this same object):

```json
{
  "eventId": "<SportEvent id>",
  "teamId": "<SportEvent.TeamId>",
  "version": 8,
  "phase": "firstHalf",
  "clock": { "baseSeconds": 0, "referenceUtc": "2026-11-04T10:00:00Z" },
  "matchDurationMinutes": 60,
  "scoreLocal": 1,
  "scoreVisitor": 0,
  "formation": "4-4-2",
  "matchData": {
    "startingLineupJson": "...", "playersJson": "...", "substitutionWindowsJson": "...",
    "ratingSnapshotsJson": "...", "goalsJson": "...", "cardsJson": "...", "formationChangesJson": "..."
  },
  "isClosed": false,
  "serverNowUtc": "2026-11-04T10:12:03Z"
}
```

`phase` is one of `preMatch`, `firstHalf`, `halftime`, `secondHalf`, `finished` (the existing `LiveMatchPhase`). `clock.referenceUtc` is `null` while the clock is frozen (`preMatch`, `halftime`, `finished`). Elapsed seconds = `baseSeconds` + (`serverNowUtc` - `referenceUtc`) while running, `baseSeconds` otherwise.

Table `app.LiveMatchStates`: `EventId` (unique), `TeamId`, `Version` (int, EF concurrency token), `Phase`, `ClockBaseSeconds`, `ClockReferenceUtc` (nullable), `MatchDurationMinutes`, `ScoreLocal`, `ScoreVisitor`, `Formation`, `MatchDataJson` (text, same convention as `MatchParticipation` JSON columns), `ClosedAtUtc` (nullable), `CreatedAtUtc`, `UpdatedAtUtc`, `UpdatedByUserId`.

### Architecture Snapshot

#### External Surfaces

- `GET /api/events/{eventId}/live-match` -> `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/LiveMatch/GetLiveMatch.cs`; 200 full state, 404 when the event has no live state, 403 for non-team users.
- `POST /api/events/{eventId}/live-match` -> `Features/Coaches/LiveMatch/CreateLiveMatch.cs`; create-or-get, 201 when created, 200 when it already existed, always the one state of the event.
- `POST /api/events/{eventId}/live-match/actions` -> `Features/Coaches/LiveMatch/ApplyLiveMatchAction.cs`; body `{ type, baseVersion, payload }`; 200 new state, 409 ProblemDetails with `currentState`, 400 ProblemDetails on validation, 403 for non-team users.
- `DELETE /api/events/{eventId}/live-match` -> `Features/Coaches/LiveMatch/DeleteLiveMatch.cs`; removes live state and `MatchParticipation` of the event, 204.
- SignalR hub `/hubs/live-match` -> `Features/Coaches/LiveMatch/LiveMatchHub.cs`; methods `JoinMatch(eventId)` and `LeaveMatch(eventId)`; server events `MatchUpdated(state)` and `MatchDeleted(eventId)`.
- JWT `access_token` query-string handling limited to `/hubs` routes -> `Back/ExtractionApi/src/RFFM.Host/Startup.cs`.
- Table `app.LiveMatchStates` and its EF migration -> `Back/ExtractionApi/src/RFFM.Api/Infrastructure/Migrations`.
- Closed action `type` set accepted by `POST .../actions`: `setLineup`, `setDuration`, `kickOff`, `endHalf`, `startSecondHalf`, `adjustClock`, `goal`, `card`, `substitution`, `formationChange`.
- `POST /api/events/{eventId}/live-match/finish` -> `Features/Coaches/LiveMatch/FinishLiveMatch.cs`; body `{ baseVersion, players[] }`; converts the live state into `MatchParticipation` and closes the state in one transaction; 200 closed state, 409 ProblemDetails with `currentState`, 400 on validation, 403 for non-team users.

#### Internal Public Surfaces

- `LiveMatchState` aggregate (`Create`, `Apply(action, serverNow)`, `Elapsed(serverNow)`, `Close`) -> `Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/LiveMatches/LiveMatchState.cs`.
- `LiveMatchTeamAccess.IsTeamCoachAsync(db, userId, eventId, ct)` -> `Features/Coaches/LiveMatch/LiveMatchTeamAccess.cs`; the one membership check used by the four slices and the hub.
- `MatchParticipationWriter.SaveAsync(request, ct)` -> `Features/Coaches/Convocations/MatchParticipationWriter.cs`; conversion and automatic-sanctions logic extracted from `SaveMatchParticipation.Handler`, called by that handler and by the `FinishLiveMatch` slice.
- `LiveMatchStateResponse` mapping shared by REST and hub -> `Features/Coaches/LiveMatch/LiveMatchStateResponse.cs`.
- `liveMatchRealtimeService` (`connect`, `joinMatch`, `leaveMatch`, `onMatchUpdated`, `onMatchDeleted`, `onReconnected`, `onDisconnected`) -> `Front/src/apps/coach/services/liveMatchRealtimeService.ts`.
- `liveMatchService` REST wrappers (`getLiveMatch`, `createLiveMatch`, `sendLiveMatchAction`, `deleteLiveMatch`) -> `Front/src/apps/coach/services/liveMatchService.ts`; the `localStorage` backup helpers are removed.
- `useLiveMatchServerState` (state, version, connection status, `send(action)`, clock offset) -> `Front/src/apps/coach/pages/convocations/hooks/useLiveMatchServerState.ts`; consumed by `useLiveMatch`.
- `computeElapsedSeconds(clock, serverOffsetMs, nowMs)` pure clock helper -> `Front/src/apps/coach/pages/convocations/utils/liveMatchClock.ts`.

### File Manifest

- M Back/ExtractionApi/Directory.Build.props (Step 9)
- A Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/LiveMatches/LiveMatchState.cs (Step 1)
- A Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Convocations/MatchParticipationWriter.cs (Step 7)
- M Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Convocations/SaveMatchParticipation.cs (Step 7)
- A Back/ExtractionApi/src/RFFM.Api/Features/Coaches/LiveMatch/ApplyLiveMatchAction.cs (Step 6)
- A Back/ExtractionApi/src/RFFM.Api/Features/Coaches/LiveMatch/CreateLiveMatch.cs (Step 5)
- A Back/ExtractionApi/src/RFFM.Api/Features/Coaches/LiveMatch/DeleteLiveMatch.cs (Step 9)
- A Back/ExtractionApi/src/RFFM.Api/Features/Coaches/LiveMatch/FinishLiveMatch.cs (Step 8)
- A Back/ExtractionApi/src/RFFM.Api/Features/Coaches/LiveMatch/GetLiveMatch.cs (Step 5)
- A Back/ExtractionApi/src/RFFM.Api/Features/Coaches/LiveMatch/LiveMatchBroadcaster.cs (Step 4)
- A Back/ExtractionApi/src/RFFM.Api/Features/Coaches/LiveMatch/LiveMatchHub.cs (Step 4)
- A Back/ExtractionApi/src/RFFM.Api/Features/Coaches/LiveMatch/LiveMatchHubAuthentication.cs (Step 4)
- A Back/ExtractionApi/src/RFFM.Api/Features/Coaches/LiveMatch/LiveMatchStateResponse.cs (Step 3)
- A Back/ExtractionApi/src/RFFM.Api/Features/Coaches/LiveMatch/LiveMatchTeamAccess.cs (Step 3)
- A Back/ExtractionApi/src/RFFM.Api/Infrastructure/Migrations/2026*_AddLiveMatchStates.Designer.cs — generated count=1 (Step 2)
- A Back/ExtractionApi/src/RFFM.Api/Infrastructure/Migrations/2026*_AddLiveMatchStates.cs — generated count=1 (Step 2)
- M Back/ExtractionApi/src/RFFM.Api/Infrastructure/Migrations/AppDbContextModelSnapshot.cs (Step 2)
- M Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/AppDbContext.cs (Step 2)
- A Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/Configuration/Entities/LiveMatchStateEntityConfiguration.cs (Step 2)
- M Back/ExtractionApi/src/RFFM.Host/Startup.cs (Step 4)
- A Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/ApplyLiveMatchActionHandlerTests.cs (Step 6)
- A Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/CreateLiveMatchHandlerTests.cs (Step 5)
- A Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/DeleteLiveMatchHandlerTests.cs (Step 9)
- A Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/FinishLiveMatchHandlerTests.cs (Step 8)
- A Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/GetLiveMatchHandlerTests.cs (Step 5)
- A Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/LiveMatchHubTests.cs (Step 4)
- A Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/LiveMatchStateConfigurationTests.cs (Step 2)
- A Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/LiveMatchStateTests.cs (Step 1)
- A Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/LiveMatchTeamAccessTests.cs (Step 3)
- M Front/package-lock.json (Step 11)
- M Front/package.json (Step 11, Step 13)
- M Front/src/apps/coach/pages/convocations/components/PartidoEnDirectoTab.tsx (Step 13)
- D Front/src/apps/coach/pages/convocations/components/__tests__/PartidoEnDirectoTab.backupRecovery.test.tsx (Step 13)
- A Front/src/apps/coach/pages/convocations/components/__tests__/PartidoEnDirectoTab.serverState.test.tsx (Step 13)
- D Front/src/apps/coach/pages/convocations/components/simulation/LiveMatchRecoveryDialog.tsx (Step 13)
- M Front/src/apps/coach/pages/convocations/components/simulation/liveMatch.types.ts (Step 10, Step 13)
- A Front/src/apps/coach/pages/convocations/hooks/__tests__/fakeLiveMatchServer.ts (Step 13)
- M Front/src/apps/coach/pages/convocations/hooks/__tests__/useLiveMatch.adjustClock.test.tsx (Step 13)
- M Front/src/apps/coach/pages/convocations/hooks/__tests__/useLiveMatch.autoSave.test.tsx (Step 13)
- M Front/src/apps/coach/pages/convocations/hooks/__tests__/useLiveMatch.deleteReset.test.tsx (Step 13)
- M Front/src/apps/coach/pages/convocations/hooks/__tests__/useLiveMatch.expulsion.test.tsx (Step 13)
- M Front/src/apps/coach/pages/convocations/hooks/__tests__/useLiveMatch.goalsOrdering.test.tsx (Step 13)
- M Front/src/apps/coach/pages/convocations/hooks/__tests__/useLiveMatch.matchDuration.test.tsx (Step 13)
- M Front/src/apps/coach/pages/convocations/hooks/__tests__/useLiveMatch.minuteLimitSanctions.test.tsx (Step 13)
- M Front/src/apps/coach/pages/convocations/hooks/__tests__/useLiveMatch.setScore.test.tsx (Step 13)
- M Front/src/apps/coach/pages/convocations/hooks/__tests__/useLiveMatch.startingLineup.test.tsx (Step 13)
- M Front/src/apps/coach/pages/convocations/hooks/__tests__/useLiveMatch.timerPersistence.test.tsx (Step 13)
- A Front/src/apps/coach/pages/convocations/hooks/__tests__/useLiveMatchServerState.test.tsx (Step 12)
- M Front/src/apps/coach/pages/convocations/hooks/useLiveMatch.ts (Step 13)
- A Front/src/apps/coach/pages/convocations/hooks/useLiveMatchServerState.ts (Step 12)
- A Front/src/apps/coach/pages/convocations/utils/__tests__/liveMatchClock.test.ts (Step 10)
- A Front/src/apps/coach/pages/convocations/utils/liveMatchClock.ts (Step 10)
- A Front/src/apps/coach/services/__tests__/liveMatchRealtimeService.test.ts (Step 11)
- A Front/src/apps/coach/services/__tests__/liveMatchService.test.ts (Step 10)
- A Front/src/apps/coach/services/liveMatchRealtimeService.ts (Step 11)
- M Front/src/apps/coach/services/liveMatchService.ts (Step 10, Step 13)
- M Front/vite.config.ts (Step 11)

## Context

- Today `useLiveMatch` (`Front/src/apps/coach/pages/convocations/hooks/useLiveMatch.ts`) owns the whole live match in React state with a wall-clock anchor (L285-290) and a `localStorage` backup (L385-412). The final save is one `POST /api/events/{id}/match-participation` (L864) built from the front's own per-player minutes (L339-347, payload builder L817-862). Its only consumer is `PartidoEnDirectoTab.tsx` (L104), which also renders `LiveMatchRecoveryDialog` (L504-510).
- Football rules live in the front: reduced formations after an expulsion (`Front/src/apps/coach/types/formation.ts`, `utils/expulsions.ts`), substitution windows (`simulation.types.ts`), minutes played. The server knows none of them.
- Backend: `SaveMatchParticipation` (`Features/Coaches/Convocations/SaveMatchParticipation.cs`, Roles `Coach,Administrator`) has conversion and automatic-sanction logic in private `Handler` methods (L174-300) that call `SaveChangesAsync` several times (L157, L196, L264). Sanctions only run for `MatchPhase = finished` (L144-162). Handlers in this project call `SaveChangesAsync` themselves.
- `TeamEditAuthorization.CanEditAsync` also grants club Directive/Coach access (L15-21), broader than the spec; `CoachTeamIdsAsync` checks `UserTeams` `Membership.Coach` only (L37-40). `SportEvent.TeamId` is a string with a `Team` navigation (`Domain/Aggregates/Assistances/SportEvent.cs` L18, L35).
- `Startup.cs` clears the `access_token` unless the endpoint has authorization metadata (L101), CORS already allows credentials (L160), features are mapped at L219, and no SignalR code exists. `AppDbContext` discovers `IEntityTypeConfiguration<>` by reflection (L207-209); JSON columns are plain text; no entity uses a row-version token. Vite proxies only `/api` (`Front/vite.config.ts` L72-80).
- Constraints: one Azure Container Apps replica (no backplane), PostgreSQL, RFC 7807 for every error, one feature per `.cs` file, TDD, migration in its own commit, `feat` bumps API (1.46.1 -> 1.47.0) and web (1.110.0 -> 1.111.0) minor versions.

## Goals / Non-Goals

**Goals**
- One versioned live state per event, with a server-owned clock, shared through REST and SignalR among the coaches of the event team (specs `live-match-server-state`, `live-match-realtime-sync`, `live-match-team-access`).
- Finishing converts the live state into `MatchParticipation` with unchanged sanction behaviour and closes the state in one transaction; deleting removes both records (specs above, plus modified `coach-live-match-tracking`).
- The front renders server state, blocks actions offline and drops the `localStorage` backup and recovery dialog.

**Non-Goals**
- Moving football rules (reduced formations, expulsion relocation, minutes played, substitution-window limits) to the backend.
- Changing manual editing of finished matches, the minutes-reason flows (`UpdateMatchParticipationReason`, `UpdateConvocationMinutesReason`) or the existing `DeleteMatchParticipation` endpoint behaviour.
- Horizontal scale-out of the hub (no Redis/Azure SignalR backplane).
- Importing a pre-existing `localStorage` backup into server state.
- Out of scope: a `minutesReason` field in the participation payload — it is typed in the front but not sent or stored today; revisit when the minutes reason becomes part of the live flow.

## Decisions

### D1. The server owns phase, clock, score, duration and version; football documents stay client-computed
Every action carries `{ type, baseVersion, payload }`. For `goal`, `card`, `substitution`, `formationChange`, `setLineup` the payload holds the resulting client-computed documents (the same `*Json` fields `SaveMatchParticipationRequest` already accepts, plus `formation` and `scoreLocal`/`scoreVisitor`) and the server replaces only the fields that action type is allowed to touch (a per-type whitelist), after checking the phase guard (lineup only in `preMatch`; goal/card/substitution/formationChange only while a half runs or at `halftime`; nothing once `finished`). `kickOff`, `endHalf`, `startSecondHalf`, `adjustClock` and `setDuration` carry no football documents; the server computes their clock effect from its own instant. `finish` has the same `{ baseVersion, payload }` envelope and version rules but is its own slice and route (it converts to `MatchParticipation` rather than patching state), and its payload adds the per-player minute list (`players`: `teamPlayerId`, `minutesPlayed`, `isStarter`, `enteredAtMinute`, `exitedAtMinute`), because minutes derive from rules that stay in the front.
- Alternatives considered: (a) port formations, expulsion relocation and minute accounting to C# so the server computes everything — rejected: doubles the rule set and `useLiveMatch` stays the reference for coaches; (b) server stores an opaque blob and owns nothing — rejected: it cannot own the clock or validate phase transitions.
- Rationale: the spec makes the clock, version and transitions server-owned, while the rules already work in the front and carry no cross-device conflict once actions are serialised by version.
- **Record family**: adr
- **Provenance**: derived

### D2. Optimistic concurrency by base version, 409 carries the current state
The handler loads the state, rejects with 409 when `baseVersion != Version`, otherwise applies the action, increments `Version` and saves; `Version` is also the EF concurrency token, so two simultaneous saves on the same version leave one winner and a `DbUpdateConcurrencyException` becomes a 409 with the reloaded state. The handler returns a result record (`State`, `Conflict`) and the endpoint maps `Conflict` to `Results.Problem(statusCode: 409, extensions: { currentState })`; validation failures stay ProblemDetails 400. A rejected action broadcasts nothing.
- **Provenance**: user

### D3. One row per event, created idempotently; a finished match stays as a closed row
`POST /live-match` inserts a `preMatch` row and relies on the unique index on `EventId`; on a unique violation it returns the existing row, so concurrent creates observe one state. `finish` sets `phase = finished`, `ClosedAtUtc`, increments the version and keeps the row, so a device reconnecting after the end still reads the finished state; actions on a closed state fail with a 409 carrying it. `DELETE` removes the row. The front creates the state lazily on the first coach interaction when `GET` answers 404.
- Alternatives considered: delete the row on finish — rejected: late devices would get 404 and show a pre-match screen for a finished match.
- **Record family**: adr
- **Provenance**: derived

### D4. Server clock: base seconds plus reference instant
`kickOff` -> `firstHalf`, base 0, reference = server now. `endHalf` -> `halftime`, base = elapsed, reference cleared. `startSecondHalf` -> `secondHalf`, base unchanged (the frozen first-half total, as `useLiveMatch` L783-785 does today), reference = server now. `adjustClock(deltaSeconds)` -> base = max(0, elapsed + delta), reference = server now while running, unchanged otherwise. `finish` freezes. Every response and event carries `serverNowUtc`; the front stores `offset = serverNowUtc - deviceNow` at receipt and computes elapsed with `computeElapsedSeconds`, so a device with a skewed clock shows the same time, and offline the clock keeps advancing from the last reference.
- **Provenance**: user

### D5. Finish is one transaction around an extracted `MatchParticipationWriter`
The conversion and automatic-sanction logic moves out of `SaveMatchParticipation.Handler` into `MatchParticipationWriter`; the existing handler delegates to it, so `SaveMatchParticipationHandlerTests` and `SaveMatchParticipationAutomaticSanctionTests` must stay green unchanged. The `FinishLiveMatch` slice builds a `SaveMatchParticipationRequest` from the stored state (team, score, duration, `*Json` documents, formation) plus the payload `players`, validates that the stored phase allows finishing, then inside one explicit database transaction calls the writer and closes the state. `AppDbContext` is registered with `EnableRetryOnFailure` (`Back/ExtractionApi/src/RFFM.Api/DependencyInjection/ServiceCollectionExtensions.cs` L121), so the transaction is opened inside `db.Database.CreateExecutionStrategy().ExecuteAsync(...)`; the retried delegate reloads the state and rebuilds the request on every attempt. Any failure rolls back both and leaves the state open and unchanged; the broadcast happens only after commit.
- **Record family**: adr
- **Provenance**: codebase-forced

### D6. One shared team-membership check
`LiveMatchTeamAccess.IsTeamCoachAsync` resolves `SportEvent.TeamId` and tests it against `TeamEditAuthorization.CoachTeamIdsAsync` (`UserTeams` `Membership.Coach`). REST slices keep `Roles = "Coach,Administrator"` and then call the check, returning 403 on failure, so an administrator with no team is excluded; `LiveMatchHub.JoinMatch` calls the same method and refuses to add the connection on failure. `CanEditAsync` is not reused because its club-level grants exceed the spec.
- **Provenance**: user

### D7. SignalR hub with a group per event
`LiveMatchHub` (`[Authorize]`) is mapped at `/hubs/live-match` with `RequireAuthorization()` so the existing `OnMessageReceived` keeps the token; the handler is extended to accept `access_token` from the query string only when the path starts with `/hubs`. Groups are named `liveMatch-{eventId}`. Slices broadcast through `IHubContext<LiveMatchHub>` after `SaveChangesAsync`: `MatchUpdated(state)` once per saved action and `MatchDeleted(eventId)` after a delete. `RFFM.Api.csproj` already has `FrameworkReference Microsoft.AspNetCore.App` (L34, net9.0), so `Hub` and `IHubContext` need no new NuGet package; in-memory groups are valid because there is one replica. The user id is read as the slices do, `FindFirst(ClaimTypes.NameIdentifier) ?? FindFirst("sub")` (`Features/Coaches/ClubJoinRequests/Queries/GetClubJoinRequests.cs` L25-26), from `Context.User` in the hub.
- **Provenance**: codebase-forced

### D8. `MatchDeleted` is a second hub event
The specs name only `MatchUpdated`, and a deleted state has no next version to broadcast. `DELETE /live-match` therefore emits `MatchDeleted(eventId)`; the front resets to the pre-match phase and re-reads the state (404). Existing `DeleteMatchParticipation` stays unchanged for matches finished without a live state; the front calls the new delete only when it holds server state.
- **Provenance**: derived

### D9. Frontend: server state is the source of truth
A new `useLiveMatchServerState` hook owns connection, state, version, offset and `send`. `useLiveMatch` keeps its public return shape but its actions become `send(...)` calls that apply the returned state; it holds no authoritative copy, writes no `localStorage` backup and `PartidoEnDirectoTab.tsx` no longer renders `LiveMatchRecoveryDialog`. The client requests the full state on open, on reconnect and when a received version is not `current + 1`; on a 409 it applies the returned state, discards the local action and dispatches `rffm.show_snackbar` asking the coach to repeat it; when offline it blocks actions with a snackbar. The final `POST` and the backup helpers of `liveMatchService.ts` are removed. `vite.config.ts` gains a `/hubs` proxy with `ws: true`. `@microsoft/signalr` is added to `Front/package.json`; the token comes from the same `coachAuthToken` source the Axios interceptor uses.
- **Provenance**: user

### D10. Pre-existing local backups are discarded, not imported
The specs retire the backup and recovery dialog for matches with server state and recover from the server; they say nothing about a backup written by the previous build. When the screen finds no server state for the event and a legacy `localStorage` backup exists, the front removes it silently and shows the pre-match phase. Importing a local match into server state is out of scope (Non-Goals).
- **Provenance**: derived

## Risks / Trade-offs

- [Server does not enforce football rules, so a buggy or older client could store an inconsistent lineup or minutes] -> Mitigation: per-action field whitelists and phase guards, version serialisation, and `finish` validation of phase and score ranges; rules stay in one place (the front).
- [`MatchParticipationWriter` calls `SaveChangesAsync` several times, and the retrying execution strategy rejects a user-started transaction outside `ExecuteAsync`] -> Mitigation: wrap the transaction in `CreateExecutionStrategy().ExecuteAsync(...)` (D5) and cover rollback with a test that forces a writer failure.
- [`OnMessageReceived` only keeps the token for endpoints with `AuthorizeAttribute` metadata (`Startup.cs` L101); a hub mapped without it would reject every connection] -> Mitigation: `RequireAuthorization()` on the hub endpoint plus an integration test that connects with a query-string token and one that sends it to a non-hub route.
- [`Startup.cs` L42 also calls `AddDbContext<AppDbContext>()` with no options, not reconciled with the registration that enables the retry strategy] -> Mitigation: the finish test runs against the real host configuration and fails if the transaction is opened outside the execution strategy.
- [One replica only: in-memory hub groups lose connections on restart or scale-out] -> Mitigation: clients re-join and fetch the full state on reconnect; scale-out would need a backplane, recorded as a non-goal.
- [Matches in progress at deploy time lose their local-only backup (D10)] -> Mitigation: deploy outside match windows.
- [Websocket upgrade may fail behind the Container Apps ingress or the dev proxy] -> Mitigation: allow SignalR's SSE/long-polling fallback and verify in the manual smoke check.

## Migration Plan

1. Add the `LiveMatchStates` entity, `DbSet` and configuration, then generate the migration with `manage-migrations.ps1 -Action create` in its own commit, separate from application code.
2. Deploy API before web: the new endpoints and hub are additive, `DeleteMatchParticipation` and `SaveMatchParticipation` keep working for the old web build.
3. Deploy web after the API; web uses the new endpoints for every match.
4. Rollback: web back to the previous build (it still posts the final save), API back to the previous image; the `LiveMatchStates` table is additive and can stay in place, so no down-migration is run on a live database.

## Open Questions

None — the two questions raised during drafting were resolved: SignalR server types are available through the existing `Microsoft.AspNetCore.App` framework reference (D7), and the handling of legacy local backups is decided in D10.

## Manual Verification

- Generated-artifact drift: the new migration and `AppDbContextModelSnapshot.cs` match the `LiveMatchState` entity configuration (re-running `manage-migrations.ps1 -Action create` produces no further changes), and `Front/package-lock.json` lists `@microsoft/signalr`.
- End-to-end smoke across real runtimes: with the API on real PostgreSQL and the Vite dev server (`/hubs` proxied), open the same event in two browsers as two coaches of one team; kick off on one and confirm the other shows the running clock within a second, record a goal on the second and see it on the first, finish and confirm the saved-match banner appears on both. Then stop the network on one device: the clock keeps running, actions show the no-connection notice, and after reconnecting it shows the current server state with no recovery dialog.
- Deployed hub transport: against the Azure Container Apps environment, confirm the `/hubs/live-match` connection stays up (websocket or fallback) for a full half.
