## Why

A live match currently lives only in the local React state and `localStorage` of a single device (`Front/src/apps/coach/pages/convocations/hooks/useLiveMatch.ts`), so it cannot be recovered from another device and several coaches or devices cannot act on the same match at once. Moving the match state, the clock and the actions to the backend, synchronised in real time, makes the live match a shared resource of the team.

## What Changes

- The full state of a live match (lineup, formation, duration, score, events and clock) is stored and computed in the backend: one state per sport event, with a monotonic version and a server-owned clock.
- Every user action (start, end of half, second half, finish, minutes adjustment, goal, card, substitution, formation change, pre-match lineup/formation/duration edits) is sent to the backend with its base version; if the base version matches, the state is saved, the version is incremented and the full state is broadcast; otherwise the action is rejected with a 409 carrying the current state.
- A SignalR hub per match pushes the full state (`MatchUpdated`) to every connected device of the team; opening the screen, reconnecting or detecting a version gap fetches the full state.
- Only coaches assigned to the team of the event can read or act on a live match, through REST and through the hub; an administrator without an assigned team is excluded.
- Finishing a live match converts the live state into `MatchParticipation` (reusing the current save logic) and closes the live state in the same transaction; the front stops sending the final `POST`. Deleting a live match removes the live state and the `MatchParticipation`, and every device returns to the pre-match phase.
- The front stops using `localStorage` backup and the recovery dialog for matches with server state; without a connection actions are blocked with a notice while the clock stays visible from the last server reference.
- Manual editing of finished matches and the change of the minutes reason keep the current `MatchParticipation` flow.

## Capabilities

### New Capabilities
- `live-match-server-state`: server-side live match state per event (single state per event, monotonic version, server clock, optimistic concurrency on actions, conversion to `MatchParticipation` on finish, deletion).
- `live-match-realtime-sync`: SignalR hub per match, full-state recovery on open/reconnect/version gap, device clock offset against server time, offline blocking and rejected-action handling in the front.
- `live-match-team-access`: access control restricting live match reading and acting (REST and hub) to coaches assigned to the team of the event.

### Modified Capabilities
- `coach-live-match-tracking`: the automatic save at match end becomes a server-side conversion (the front no longer posts the final participation), and the reload/recovery behaviour (`localStorage` backup and recovery dialog) is replaced by server state recovery for matches with server state.

## Impact

- Backend (`Back/ExtractionApi`): new `LiveMatchState` table in the `app` schema (separate migration commit); new slices under `Features/Coaches/LiveMatch/`; new SignalR hub `/hubs/live-match`; JWT `access_token` query-string handling for `/hubs` routes in `RFFM.Host/Startup.cs`; shared team-membership check used by REST and hub; reuse of `SaveMatchParticipation` conversion logic; API version bump (minor) in `Directory.Build.props`.
- Frontend (`Front`): new dependency `@microsoft/signalr`; new `liveMatchRealtimeService` in `services/`; `useLiveMatch` stops being the source of truth; removal of the `localStorage` backup, `LiveMatchRecoveryDialog` usage and the final `POST` for server-backed matches; web version bump (minor).
- Deployment: a single Azure Container Apps replica is assumed, so no SignalR backplane is required.
- Tests: handler and hub tests in the backend; hook and service tests in the frontend.

## Proposal Research Documentation

**Local files**:
- Front/src/apps/coach/pages/convocations/hooks/useLiveMatch.ts - current local state, wall-clock anchor, `localStorage` backup, final save and delete flows.
- Front/src/apps/coach/pages/convocations/components/simulation/liveMatch.types.ts - `LiveMatchBackup`, event types and participation payload.
- Front/src/apps/coach/services/liveMatchService.ts - backup helpers and match participation REST calls.
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Convocations/SaveMatchParticipation.cs - current conversion to `MatchParticipation`, automatic sanctions.
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Teams/TeamEditAuthorization.cs - existing team coach membership check.
- Back/ExtractionApi/src/RFFM.Host/Startup.cs - JWT bearer events and CORS policy.
- openspec/specs/coach-live-match-tracking/spec.md - current live match requirements.
- Back/ExtractionApi/Directory.Build.props - API version.
- Front/package.json - web version and dependencies.
- openspec/config.yaml - project context (none defined).

**External URLs**:
- None

## Additional Notes

- `Startup.cs` `JwtBearerEvents.OnMessageReceived` already exists and clears the token when the endpoint has no `AuthorizeAttribute` metadata; the hub endpoint therefore needs authorization metadata for the `access_token` query-string token to be honoured.
- The JWT uses `RoleClaimType = "roles"` and `MapInboundClaims = false`; `SaveMatchParticipation` is currently authorized with `Roles = "Coach,Administrator"`, and team coach membership is modelled by `UserTeams` rows with `Membership.Coach`.
- `SaveMatchParticipation` also creates automatic sanctions and fulfils minutes-limit sanctions when the phase is `finished`; the conversion on finish must keep that behaviour.
- `useLiveMatch` already exposes a minutes-adjustment action (`adjustClock`) that re-anchors the clock, and the frontend `liveMatchService.ts` holds the `localStorage` backup helpers that this change retires for server-backed matches.
