## Step 1: Live match state aggregate and clock rules

- [x] Step 1: Live match state aggregate and clock rules

**Routing**: category=backend · context=medium · difficulty=medium

**Files Affected**:
- A Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/LiveMatches/LiveMatchState.cs
- A Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/LiveMatchStateTests.cs

**What Will Be Done**: Add the `LiveMatchState` aggregate with a static `Create` factory (pre-match, version 1) and an `Apply(action, serverNow)` method that enforces the per-type field whitelist and phase guards of design D1, implements the clock transitions of D4 (`Elapsed(serverNow)`), increments the version, and a `Close` for the finish transition (D3). Pure domain code with no EF or HTTP types so it can be tested without a database. Domain rules come from `specs/live-match-server-state/spec.md`; model it on the existing aggregates under `Domain/Aggregates/` (public factory, intention-revealing methods).

**Testing Strategy**: xUnit tests in the existing `UnitTests` folder, written first: kick-off, end of half, second half, minutes adjustment (running and frozen, never below zero), phase guards, whitelist rejection and version increment. Reviewed `TeamNoteTests.cs` and `SeasonPlanTests.cs` as the nearest domain-test pattern.

**Existing Tests Broken**: None

## Step 2: Persistence, EF configuration and migration

- [x] Step 2: Persistence, EF configuration and migration

**Routing**: category=data · context=medium · difficulty=medium

**Files Affected**:
- M Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/AppDbContext.cs
- A Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/Configuration/Entities/LiveMatchStateEntityConfiguration.cs
- A Back/ExtractionApi/src/RFFM.Api/Infrastructure/Migrations/2026*_AddLiveMatchStates.cs — generated count=1
- A Back/ExtractionApi/src/RFFM.Api/Infrastructure/Migrations/2026*_AddLiveMatchStates.Designer.cs — generated count=1
- M Back/ExtractionApi/src/RFFM.Api/Infrastructure/Migrations/AppDbContextModelSnapshot.cs
- A Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/LiveMatchStateConfigurationTests.cs

**What Will Be Done**: Add the `LiveMatchStates` `DbSet`, an `IEntityTypeConfiguration<LiveMatchState>` (table in the `app` schema, unique index on `EventId`, `Version` as concurrency token, JSON as plain text as in `MatchParticipationEntityConfiguration`), then generate the migration with `manage-migrations.ps1 -Action create` (name `AddLiveMatchStates`). The configuration is discovered by reflection, so no registration is needed. The persistence step keeps the model and its migration in one commit so no boundary has a model without its snapshot; it contains no feature code. Shape per `specs/live-match-server-state/spec.md` (single state per event, version).

**Testing Strategy**: Tests against `PostgresContainerFixture`: a second insert for the same event fails on the unique index, and a stale `Version` update raises `DbUpdateConcurrencyException`. The model-versus-migration drift check is the manual verification listed in `design.md`. Reviewed `SaveMatchParticipationHandlerTests.cs` fixture use (real Postgres, `PostgresCollection`) as the pattern.

**Existing Tests Broken**: None

## Step 3: Team access check and state response mapping

- [x] Step 3: Team access check and state response mapping

**Routing**: category=backend · context=small · difficulty=low

**Files Affected**:
- A Back/ExtractionApi/src/RFFM.Api/Features/Coaches/LiveMatch/LiveMatchTeamAccess.cs
- A Back/ExtractionApi/src/RFFM.Api/Features/Coaches/LiveMatch/LiveMatchStateResponse.cs
- A Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/LiveMatchTeamAccessTests.cs

**What Will Be Done**: Add `LiveMatchTeamAccess.IsTeamCoachAsync` resolving `SportEvent.TeamId` and testing it against `TeamEditAuthorization.CoachTeamIdsAsync` (D6), and the `LiveMatchStateResponse` record plus mapping from `LiveMatchState` and `serverNowUtc` shared by REST and the hub (D2, D7). Read the current user id as the existing slices do (`NameIdentifier` or `sub`). Behavior per `specs/live-match-team-access/spec.md`.

**Testing Strategy**: Real-Postgres tests: assigned coach allowed, coach of another team denied, administrator with no `UserTeams` row denied, event without team denied. Reviewed `TeamEditAuthorizationTests.cs` as the nearest pattern; the existing class is not modified.

**Existing Tests Broken**: None

## Step 4: SignalR hub, broadcaster and hub authentication

- [x] Step 4: SignalR hub, broadcaster and hub authentication

**Routing**: category=backend · context=medium · difficulty=high (token handling interacts with the existing JwtBearer events)

**Files Affected**:
- A Back/ExtractionApi/src/RFFM.Api/Features/Coaches/LiveMatch/LiveMatchHub.cs
- A Back/ExtractionApi/src/RFFM.Api/Features/Coaches/LiveMatch/LiveMatchBroadcaster.cs
- A Back/ExtractionApi/src/RFFM.Api/Features/Coaches/LiveMatch/LiveMatchHubAuthentication.cs
- M Back/ExtractionApi/src/RFFM.Host/Startup.cs
- A Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/LiveMatchHubTests.cs

**What Will Be Done**: Add `LiveMatchHub` with `JoinMatch`/`LeaveMatch` guarded by `LiveMatchTeamAccess`, a `LiveMatchBroadcaster` wrapping `IHubContext<LiveMatchHub>` (`MatchUpdated`, `MatchDeleted`, group `liveMatch-{eventId}`), and a small static helper that decides whether the `access_token` query string may be used (only for paths under `/hubs`). In `Startup.cs` call `AddSignalR`, register the broadcaster, map the hub at `/hubs/live-match` with `RequireAuthorization()`, and extend the existing `OnMessageReceived` event to use the helper without changing its behavior for other routes. This must land before any slice that broadcasts. Requirements in `specs/live-match-realtime-sync/spec.md` and `specs/live-match-team-access/spec.md`.

**Testing Strategy**: Unit tests for the path helper (hub path allowed, `/api` path ignored) and for `JoinMatch` with an authorized and an unauthorized user using a fake `Groups` implementation. An integration check that a token in the query string authenticates `/hubs/live-match` is covered by the manual smoke test in `design.md`. Reviewed existing JwtBearer tests (`TokenServiceTests.cs`) as unaffected.

**Existing Tests Broken**: None

## Step 5: Read and create live match slices

- [x] Step 5: Read and create live match slices

**Routing**: category=backend · context=medium · difficulty=medium

**Files Affected**:
- A Back/ExtractionApi/src/RFFM.Api/Features/Coaches/LiveMatch/GetLiveMatch.cs
- A Back/ExtractionApi/src/RFFM.Api/Features/Coaches/LiveMatch/CreateLiveMatch.cs
- A Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/GetLiveMatchHandlerTests.cs
- A Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/CreateLiveMatchHandlerTests.cs

**What Will Be Done**: Two vertical slices, one file each (`IFeatureModule` with endpoint, request, handler, validator), following the nearest sibling under `Features/Coaches/Convocations/`. `GetLiveMatch` returns 200 with the state and `serverNowUtc` or 404. `CreateLiveMatch` inserts a pre-match row and, on the unique-index violation, returns the existing one (D3); both check `LiveMatchTeamAccess` after the role check and answer 403 as ProblemDetails. Specs: `specs/live-match-server-state/spec.md` (single state, version, read) and `specs/live-match-team-access/spec.md`.

**Testing Strategy**: Handler tests on the real-Postgres fixture: 404 without state, 403 for an outsider and for an administrator without team, creation, and two concurrent creations observing one state. Reviewed `GetMatchParticipationHandlerTests.cs` as the pattern.

**Existing Tests Broken**: None

## Step 6: Apply live match actions

- [x] Step 6: Apply live match actions

**Routing**: category=backend · context=large · difficulty=high

**Files Affected**:
- A Back/ExtractionApi/src/RFFM.Api/Features/Coaches/LiveMatch/ApplyLiveMatchAction.cs
- A Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/ApplyLiveMatchActionHandlerTests.cs

**What Will Be Done**: One slice for `POST .../live-match/actions` handling the closed set of state-patching action types (finish has its own slice in Step 8). The handler checks access, loads the state, compares `baseVersion` (D2), applies the action through the aggregate, saves, and calls the broadcaster after the commit. A stale version or `DbUpdateConcurrencyException` returns the result record with `Conflict`, which the endpoint maps to a 409 ProblemDetails carrying `currentState`. The validator checks action type, payload shape and numeric ranges. Behavior per `specs/live-match-server-state/spec.md` and `specs/live-match-realtime-sync/spec.md`.

**Testing Strategy**: Handler tests: matching version saves and increments, obsolete version returns conflict with unchanged state and no broadcast, two simultaneous actions leave one winner, invalid payload returns ProblemDetails, 403 leaves the state unchanged, broadcast called once per saved action (fake broadcaster). Reviewed `SaveMatchParticipationHandlerTests.cs` for seeding helpers.

**Existing Tests Broken**: None

## Step 7: Extract the match participation writer

- [x] Step 7: Extract the match participation writer

**Routing**: category=backend · context=medium · difficulty=high (behavior-preserving refactor of sanction logic)

**Files Affected**:
- A Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Convocations/MatchParticipationWriter.cs
- M Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Convocations/SaveMatchParticipation.cs

**What Will Be Done**: Move the conversion to `MatchParticipation` and the automatic-sanction logic from the private methods of `SaveMatchParticipation.Handler` into a plain `MatchParticipationWriter` class constructed with the dependencies the handler already holds. The handler keeps its constructor and public surface unchanged and delegates to the writer, so tests that build the handler directly keep compiling (D5). No behavior change: this is the Refactor of a green suite.

**Testing Strategy**: Run the existing suites unchanged before and after: `SaveMatchParticipationHandlerTests.cs`, `SaveMatchParticipationAutomaticSanctionTests.cs`, `SaveMatchParticipationMinutesLimitSanctionTests.cs`. Reviewed `SetPlayerSanctionAutomaticFieldsTests.cs` and `UpdateMatchParticipationReasonHandlerTests.cs`; they do not use the handler internals and remain compatible.

**Existing Tests Broken**: None

## Step 8: Finish slice converts the live state

- [x] Step 8: Finish slice converts the live state

**Routing**: category=backend · context=medium · difficulty=high

**Files Affected**:
- A Back/ExtractionApi/src/RFFM.Api/Features/Coaches/LiveMatch/FinishLiveMatch.cs
- A Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/FinishLiveMatchHandlerTests.cs

**What Will Be Done**: Add the `FinishLiveMatch` slice (`POST .../live-match/finish`, same version and conflict handling as the action slice): validate the phase and the `players` list, build the `SaveMatchParticipationRequest` from the stored state plus the finish payload, and inside `CreateExecutionStrategy().ExecuteAsync` open one transaction that calls `MatchParticipationWriter` and closes the state; roll back everything on failure and leave the state open (D5). Broadcast only after the commit. Specs: `specs/live-match-server-state/spec.md` (finish requirements) and the modified `specs/coach-live-match-tracking/spec.md`.

**Testing Strategy**: Real-Postgres tests: finish creates participation rows with the final score and closes the state; a forced writer failure leaves no participation and an open unchanged state; automatic sanction still created for a red card; a closed state rejects further actions; one `MatchUpdated` after commit. Reviewed `SaveMatchParticipationAutomaticSanctionTests.cs` as the sanction assertion pattern.

**Existing Tests Broken**: None

## Step 9: Delete live match and API version bump

- [x] Step 9: Delete live match and API version bump

**Routing**: category=backend · context=small · difficulty=medium

**Files Affected**:
- A Back/ExtractionApi/src/RFFM.Api/Features/Coaches/LiveMatch/DeleteLiveMatch.cs
- A Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/DeleteLiveMatchHandlerTests.cs
- M Back/ExtractionApi/Directory.Build.props

**What Will Be Done**: Slice for `DELETE /api/events/{eventId}/live-match`: access check, remove the live state and the event's `MatchParticipation` rows in one save, then `MatchDeleted` through the broadcaster (D8). Leave `DeleteMatchParticipation` untouched. Bump `<Version>` from 1.46.1 to 1.47.0, because the backend `feat` is complete with this step. Spec: `specs/live-match-server-state/spec.md` (deletion).

**Testing Strategy**: Handler tests: removes both records, 403 for an outsider, idempotent when no live state exists, broadcast once. Reviewed `DeleteSportEventHandlerTests.cs` as the pattern; the legacy delete endpoint is not changed.

**Existing Tests Broken**: None

## Step 10: Frontend types, server clock helper and REST wrappers

- [x] Step 10: Frontend types, server clock helper and REST wrappers

**Routing**: category=frontend-code · context=small · difficulty=low

**Files Affected**:
- M Front/src/apps/coach/pages/convocations/components/simulation/liveMatch.types.ts
- A Front/src/apps/coach/pages/convocations/utils/liveMatchClock.ts
- M Front/src/apps/coach/services/liveMatchService.ts
- A Front/src/apps/coach/pages/convocations/utils/__tests__/liveMatchClock.test.ts
- A Front/src/apps/coach/services/__tests__/liveMatchService.test.ts

**What Will Be Done**: Add the server state, action and 409 response types as `type` aliases next to `LiveMatchPhase`, a pure `computeElapsedSeconds(clock, serverOffsetMs, nowMs)` helper (D4), and the REST wrappers `getLiveMatch` (404 returns `null`), `createLiveMatch`, `sendLiveMatchAction` and `finishLiveMatch` (409 returns the conflict state) and `deleteLiveMatch` using the single Axios client. Purely additive; the backup helpers stay until Step 13. Spec: `specs/live-match-realtime-sync/spec.md` (clock offset, rejected action).

**Testing Strategy**: Vitest: clock running, frozen and skewed-device cases with fixed dates; service tests mocking the shared client for 200, 404 and 409. Reviewed `useLiveMatch.timerPersistence.test.tsx`, which mocks the service module partially, and it stays compatible because no export is removed.

**Existing Tests Broken**: None

## Step 11: SignalR client service, dependency and dev proxy

- [x] Step 11: SignalR client service, dependency and dev proxy

**Routing**: category=frontend-code · context=small · difficulty=medium

**Files Affected**:
- A Front/src/apps/coach/services/liveMatchRealtimeService.ts
- M Front/package.json
- M Front/package-lock.json
- M Front/vite.config.ts
- A Front/src/apps/coach/services/__tests__/liveMatchRealtimeService.test.ts

**What Will Be Done**: Add `@microsoft/signalr` and a `liveMatchRealtimeService` that builds one `HubConnection` to `/hubs/live-match` with `accessTokenFactory` reading `coachAuthToken`, automatic reconnect, and typed callbacks for `MatchUpdated`, `MatchDeleted`, reconnected and disconnected, plus `joinMatch` and `leaveMatch`. Add a `/hubs` proxy with `ws: true` beside the `/api` entry in `vite.config.ts`. Spec: `specs/live-match-realtime-sync/spec.md` (hub, token, reconnection).

**Testing Strategy**: Vitest with `vi.mock('@microsoft/signalr')`: handlers are registered, join is sent on connect and after reconnection, the token factory returns the stored token. The proxy change is covered by the manual smoke test.

**Existing Tests Broken**: None

## Step 12: Server state hook

- [x] Step 12: Server state hook

**Routing**: category=frontend-code · context=medium · difficulty=high

**Files Affected**:
- A Front/src/apps/coach/pages/convocations/hooks/useLiveMatchServerState.ts
- A Front/src/apps/coach/pages/convocations/hooks/__tests__/useLiveMatchServerState.test.tsx

**What Will Be Done**: A hook owning state, version, connection status and clock offset: load on open (create lazily on the first interaction when `GET` returns 404), join the hub, request the full state on reconnect and on a version gap, apply `MatchUpdated`, reset on `MatchDeleted`, and expose `send(action)` that attaches the base version, applies the response, and on 409 applies the returned state and dispatches `rffm.show_snackbar`. When offline, `send` refuses and dispatches the no-connection notice. Spec: `specs/live-match-realtime-sync/spec.md`.

**Testing Strategy**: Vitest with mocked `liveMatchService` and `liveMatchRealtimeService`: open, reconnection, version gap (5 then 8), another device's update, 409 handling, offline block and clock offset. Reviewed `useLiveMatch.autoSave.test.tsx` mock style as the pattern.

**Existing Tests Broken**: None

## Step 13: Switch useLiveMatch and PartidoEnDirectoTab to server state

- [ ] Step 13: Switch useLiveMatch and PartidoEnDirectoTab to server state

**Routing**: category=frontend-code · context=large · difficulty=high

**Files Affected**:
- M Front/src/apps/coach/pages/convocations/hooks/useLiveMatch.ts
- M Front/src/apps/coach/pages/convocations/components/PartidoEnDirectoTab.tsx
- D Front/src/apps/coach/pages/convocations/components/simulation/LiveMatchRecoveryDialog.tsx
- M Front/src/apps/coach/services/liveMatchService.ts
- M Front/src/apps/coach/pages/convocations/components/simulation/liveMatch.types.ts
- M Front/package.json
- A Front/src/apps/coach/pages/convocations/hooks/__tests__/fakeLiveMatchServer.ts
- M Front/src/apps/coach/pages/convocations/hooks/__tests__/useLiveMatch.autoSave.test.tsx
- M Front/src/apps/coach/pages/convocations/hooks/__tests__/useLiveMatch.adjustClock.test.tsx
- M Front/src/apps/coach/pages/convocations/hooks/__tests__/useLiveMatch.deleteReset.test.tsx
- M Front/src/apps/coach/pages/convocations/hooks/__tests__/useLiveMatch.setScore.test.tsx
- M Front/src/apps/coach/pages/convocations/hooks/__tests__/useLiveMatch.minuteLimitSanctions.test.tsx
- M Front/src/apps/coach/pages/convocations/hooks/__tests__/useLiveMatch.timerPersistence.test.tsx
- M Front/src/apps/coach/pages/convocations/hooks/__tests__/useLiveMatch.goalsOrdering.test.tsx
- M Front/src/apps/coach/pages/convocations/hooks/__tests__/useLiveMatch.expulsion.test.tsx
- M Front/src/apps/coach/pages/convocations/hooks/__tests__/useLiveMatch.startingLineup.test.tsx
- M Front/src/apps/coach/pages/convocations/hooks/__tests__/useLiveMatch.matchDuration.test.tsx
- D Front/src/apps/coach/pages/convocations/components/__tests__/PartidoEnDirectoTab.backupRecovery.test.tsx
- A Front/src/apps/coach/pages/convocations/components/__tests__/PartidoEnDirectoTab.serverState.test.tsx

**What Will Be Done**: Rewire `useLiveMatch` so every user action calls `send(...)` from `useLiveMatchServerState` and the displayed state, clock and phase derive from the received server state through `computeElapsedSeconds`; the football computations (formations, expulsion relocation, minutes played) stay in the hook and feed the action payloads (D1, D9). Remove the `localStorage` backup writes, the `beforeunload` backup, the final save and, per D10, clear a legacy backup when no server state exists. `PartidoEnDirectoTab` stops rendering the recovery dialog and its props, uses `deleteLiveMatch` for server-backed deletes, and keeps the manual edit flow calling `saveMatchParticipation`. Delete `LiveMatchRecoveryDialog.tsx`, the backup helpers and the `LiveMatchBackup` type, and bump the web version 1.110.0 to 1.111.0 as the frontend `feat` completes. The hook return keeps its existing shape except for the removed backup members, so the other `PartidoEnDirectoTab.*` tests that mock it stay compatible. Specs: `specs/live-match-realtime-sync/spec.md` and the modified `specs/coach-live-match-tracking/spec.md`.

**Testing Strategy**: A shared `fakeLiveMatchServer` test fixture simulates the server (version, 409, clock) so the hook tests keep exercising the same behaviors through the new path. Reviewed paths: the ten `useLiveMatch.*` tests listed below assert on local state or on `localStorage` and need adaptation; `PartidoEnDirectoTab.backupRecovery.test.tsx` covers the removed flow and is replaced by `PartidoEnDirectoTab.serverState.test.tsx` (no recovery dialog, restore from server, offline notice); the remaining `PartidoEnDirectoTab.*.test.tsx` files mock `useLiveMatch` and are checked for `backup`, `acceptBackup` and `discardBackup` references, adapted if present and otherwise compatible.

**Existing Tests Broken**:
- `Front/src/apps/coach/pages/convocations/hooks/__tests__/useLiveMatch.autoSave.test.tsx` — runtime
- `Front/src/apps/coach/pages/convocations/hooks/__tests__/useLiveMatch.adjustClock.test.tsx` — runtime
- `Front/src/apps/coach/pages/convocations/hooks/__tests__/useLiveMatch.deleteReset.test.tsx` — runtime
- `Front/src/apps/coach/pages/convocations/hooks/__tests__/useLiveMatch.setScore.test.tsx` — runtime
- `Front/src/apps/coach/pages/convocations/hooks/__tests__/useLiveMatch.minuteLimitSanctions.test.tsx` — runtime
- `Front/src/apps/coach/pages/convocations/hooks/__tests__/useLiveMatch.timerPersistence.test.tsx` — runtime
- `Front/src/apps/coach/pages/convocations/hooks/__tests__/useLiveMatch.goalsOrdering.test.tsx` — runtime
- `Front/src/apps/coach/pages/convocations/hooks/__tests__/useLiveMatch.expulsion.test.tsx` — runtime
- `Front/src/apps/coach/pages/convocations/hooks/__tests__/useLiveMatch.startingLineup.test.tsx` — runtime
- `Front/src/apps/coach/pages/convocations/hooks/__tests__/useLiveMatch.matchDuration.test.tsx` — runtime
- `Front/src/apps/coach/pages/convocations/components/__tests__/PartidoEnDirectoTab.backupRecovery.test.tsx` — compile

## Required Documentation

### Spec files
- openspec/changes/live-match-server-sync/specs/live-match-server-state/spec.md
- openspec/changes/live-match-server-sync/specs/live-match-realtime-sync/spec.md
- openspec/changes/live-match-server-sync/specs/live-match-team-access/spec.md
- openspec/changes/live-match-server-sync/specs/coach-live-match-tracking/spec.md

### Local files
- openspec/changes/live-match-server-sync/proposal.md — motivation, scope and the research list the design builds on.
- Front/src/apps/coach/pages/convocations/hooks/useLiveMatch.ts — local source of truth to rewire; clock anchor, payload builder, backup and delete flows.
- Front/src/apps/coach/pages/convocations/components/simulation/liveMatch.types.ts — phases, event types, backup and participation payload types.
- Front/src/apps/coach/pages/convocations/components/simulation/simulation.types.ts — substitution window and player state shapes carried in the stored documents.
- Front/src/apps/coach/pages/convocations/components/simulation/LiveMatchTimer.tsx — receives the clock by props; no change needed, consumers keep their props.
- Front/src/apps/coach/pages/convocations/components/PartidoEnDirectoTab.tsx — only consumer of the hook; renders the recovery dialog and calls the manual save.
- Front/src/apps/coach/services/liveMatchService.ts — REST wrappers to extend and backup helpers to retire.
- Front/src/core/api/client.ts — single Axios instance and token source reused by the new service and hub.
- Front/vite.config.ts — dev proxy needing the `/hubs` entry.
- Front/package.json — web version and dependencies; `@microsoft/signalr` absent.
- Front/src/apps/coach/pages/trainings/new-session/hooks/useSessionForm.ts — pattern for dispatching `rffm.show_snackbar`.
- Front/src/apps/coach/types/formation.ts — formation catalog that stays in the front.
- Front/src/apps/coach/pages/convocations/utils/expulsions.ts — expulsion relocation that stays in the front.
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Convocations/SaveMatchParticipation.cs — conversion and sanction logic to extract; request shape for finish.
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Convocations/DeleteMatchParticipation.cs — legacy delete left unchanged; pattern for the new delete slice.
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Convocations/UpdateMatchParticipationReason.cs — manual flow that must keep bypassing live state.
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Teams/TeamEditAuthorization.cs — `CoachTeamIdsAsync` reused for the membership check.
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/ClubJoinRequests/Queries/GetClubJoinRequests.cs — example of reading the current user id from claims.
- Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/Assistances/SportEvent.cs — event to team link through `TeamId`.
- Back/ExtractionApi/src/RFFM.Api/Domain/Entities/TeamPlayers/MatchParticipation.cs — factory and update methods used by the writer.
- Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/AppDbContext.cs — `DbSet` list and reflection-based configuration discovery.
- Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/Configuration/Entities/MatchParticipationEntityConfiguration.cs — plain-text JSON column and index conventions to imitate.
- Back/ExtractionApi/src/RFFM.Api/DependencyInjection/ServiceCollectionExtensions.cs — `AddDbContext` with `EnableRetryOnFailure`, which forces the execution-strategy transaction.
- Back/ExtractionApi/src/RFFM.Api/RFFM.Api.csproj — `FrameworkReference Microsoft.AspNetCore.App` supplies SignalR server types.
- Back/ExtractionApi/src/RFFM.Host/Startup.cs — JwtBearer `OnMessageReceived`, CORS and endpoint mapping to extend.
- Back/ExtractionApi/Directory.Build.props — API `<Version>` to bump.
- Back/ExtractionApi/manage-migrations.ps1 — migration creation script.
- Back/ExtractionApi/tests/RFFM.Api.Tests/Fixtures/PostgresContainerFixture.cs — real-Postgres fixture for handler tests.
- Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/SaveMatchParticipationHandlerTests.cs — seeding pattern and finished-phase assertions to keep green.
- Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/SaveMatchParticipationAutomaticSanctionTests.cs — sanction coverage that must pass after the extraction.

### External URLs
None

## Implementation Context

**Stack**: .NET 9 and ASP.NET Core Minimal API with Mediator v3, EF Core 9 on PostgreSQL (Npgsql, retrying execution strategy), FluentValidation 12, SignalR from the `Microsoft.AspNetCore.App` framework; xUnit tests on a real PostgreSQL container. Frontend React 19, TypeScript 5.5 strict, Vite 7, MUI v5, Axios, Vitest with Testing Library, and the new `@microsoft/signalr` client.

**Conventions**:
- One feature is one `.cs` file under `Features/<Area>/`, holding the `IFeatureModule` endpoint, request, handler and validator; handlers call `SaveChangesAsync` themselves and every error is RFC 7807 ProblemDetails.
- EF configurations are `IEntityTypeConfiguration<T>` classes under `Infrastructure/Persistence/Configuration/Entities/`, found by reflection; JSON payloads are stored as plain text columns, not `jsonb`.
- Backend tests live in `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/` and use `PostgresContainerFixture` with the `PostgresCollection` for anything touching the database.
- Frontend tests are co-located in `__tests__/` folders, mock services with `vi.mock` before importing the component, and user feedback goes through the `rffm.show_snackbar` window event; API types are `type` aliases in the `*Service.ts` or types file.
- Migrations are generated with `manage-migrations.ps1` and are never edited after being pushed; `feat` commits bump the minor version of the affected component.

**Avoid**: a second Axios instance or direct `axios` calls in components; `any`; `localStorage` writes for server-backed matches; `jsonb` or a new row-version column style; opening a database transaction outside the execution strategy; reimplementing football rules in C#; tables for lists in UI.

**Test Command**: `dotnet test Back/ExtractionApi/tests/RFFM.Api.Tests` (scoped: `dotnet test Back/ExtractionApi/tests/RFFM.Api.Tests --filter FullyQualifiedName~<TestName>`) for the backend; `cd Front && npx vitest run` (scoped: `cd Front && npx vitest run <test-file-path>`) for the frontend.
