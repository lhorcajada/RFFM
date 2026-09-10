## 1. Domain (~1h)

- [x] 1.1 Add `MinutesReason` property + `SetMinutesReason(string?)` method to
      `Convocation.cs` (trims, normalizes blank to null, throws `ArgumentException` if
      >500 chars).
- [x] 1.2 Add `MinutesReason` property + `SetMinutesReason(string?)` method to
      `MatchParticipation.cs` (same rules, also bumps `UpdatedAt`). Confirm `Update(...)`
      and `Create(...)` are left untouched (no `minutesReason` parameter added to either).
- [x] 1.3 Domain unit tests: `Convocation` accepts/clears/trims a reason and rejects
      >500 chars (`ConvocationMinutesReasonTests.cs`); `MatchParticipation.SetMinutesReason`
      same coverage plus asserts `Update(...)` never resets a previously-set `MinutesReason`
      (`MatchParticipationMinutesReasonTests.cs`).
- Verify: `dotnet build` from `Back/ExtractionApi` — passed.

## 2. Infrastructure / migration (~1h)

- [x] 2.1 Update `ConvocationEntityConfiguration.cs` — `builder.Property(c =>
      c.MinutesReason).HasMaxLength(500);`.
- [x] 2.2 Update `MatchParticipationEntityConfiguration.cs` — `builder.Property(x =>
      x.MinutesReason).HasMaxLength(500);`.
- [x] 2.3 Generated migration `20260910054613_AddMinutesReasonToConvocationAndMatchParticipation`
      via `.\manage-migrations.ps1` (AppDbContext) — `Up()` only adds the two nullable
      `character varying(500)` columns (`Convocations.MinutesReason`,
      `MatchParticipations.MinutesReason`).
- Verify: `dotnet build` — passed; migration file inspected.

## 3. Backend — pre-match reason on `Convocation` (~2h)

- [x] 3.1 Wrote validator + handler tests in
      `UpdateConvocationMinutesReasonHandlerTests.cs` (Postgres-backed like
      `UpdateConvocationStatusHandlerTests.cs`): sets a reason, clears it with null,
      rejects >500 chars (validator test), 404s (`ArgumentException`) on unknown
      convocationId.
- [x] 3.2 Implemented `Features/Coaches/Convocations/UpdateConvocationMinutesReason.cs`
      (`PUT /api/events/{eventId}/convocations/{convocationId}/minutes-reason`,
      `[Authorize(Roles = "Coach,Administrator")]`).
- [x] 3.3 Added `MinutesReason` to `GetEventConvocations.ConvocationResponse` + handler
      projection; new `GetEventConvocationsHandlerTests.cs` asserts it round-trips through
      `GetEventConvocations` after being set via 3.2's endpoint, and is `null` when unset.
- Verify: `dotnet test` (targeted filter) — 34/34 passed.

## 4. Backend — post-match reason on `MatchParticipation` (~2h)

- [x] 4.1 Wrote handler tests in `UpdateMatchParticipationReasonHandlerTests.cs`
      (Postgres-backed like `GetMatchParticipationHandlerTests.cs`): sets a reason on an
      existing participation, clears it, rejects >500 chars, 404s
      (`NotFoundException`, code `MatchParticipationNotFound`) when no participation row
      exists yet for that `(eventId, teamPlayerId)`.
- [x] 4.2 Implemented `Features/Coaches/Convocations/UpdateMatchParticipationReason.cs`
      (`PUT /api/events/{eventId}/match-participation/{teamPlayerId}/reason`,
      `[Authorize(Roles = "Coach,Administrator")]`).
- [x] 4.3 Added a regression test
      (`UpdateMatchParticipationReasonHandlerTests.SaveMatchParticipation_ReSaving_DoesNotClearPreviouslySetReason`)
      proving `SaveMatchParticipation`'s upsert `Update(...)` path does **not** clear a
      previously-set `MinutesReason` when the match is re-saved.
- Verify: `dotnet test` (targeted filter) — passed.

## 5. Backend — expose `MinutesReason` in remaining listing endpoints (~1.5h)

- [x] 5.1 Added `MinutesReason` to `GetMatchParticipation.PlayerParticipationRecord` +
      handler projection; extended `GetMatchParticipationHandlerTests.cs`
      (`Handle_AfterSettingMinutesReason_ReturnsReasonInPlayerRecord`).
- [x] 5.2 Added `MinutesReason` to `GetPlayerMatchHistory.PlayerMatchRecordDto` + handler
      projection; extended `GetPlayerMatchHistoryHandlerTests.cs`
      (`Handle_ParticipationWithMinutesReason_ReturnsReasonInRecord`).
- [x] 5.3 Added `MinutesReason` to `GetTeamMatchMinutes.MatchMinutesRow` + handler
      projection; extended `GetTeamMatchMinutesHandlerTests.cs` (reason-set and
      reason-null cases).
- Verify: `dotnet build && dotnet test` — passed.

## 6. Verification (~0.5h)

- [x] 6.1 `dotnet build` from `Back/ExtractionApi` — zero errors.
- [x] 6.2 `dotnet test` from `Back/ExtractionApi` — 1121 passed, 2 pre-existing
      unrelated failures (`AdnLegibleImporterFullDocumentSpotCheckTests`,
      `GameModelSeederRealDocumentTests`, same baseline as the
      `add-team-convocation-notes` precedent), no new regressions.
- [x] 6.3 Grepped for every touched record's constructor call sites
      (`ConvocationResponse`, `PlayerParticipationRecord`, `PlayerMatchRecordDto`,
      `MatchMinutesRow`) — only the handler that builds each DTO constructs it; no other
      call site was missed.

## 7. Frontend (Coach) — consuming the new contract (~3h)

- [x] 7.1 Types: added `minutesReason?: string | null` to `ConvocationItem`
      (`Front/src/apps/coach/services/convocationService.ts`), `MatchMinutesRow`
      (`Front/src/apps/coach/services/liveMatchService.ts`), `PlayerParticipationDto` and
      `PlayerMatchRecord` (`.../convocations/components/simulation/liveMatch.types.ts`), and
      `MatchAttendanceCell` (`.../attendance/components/summary/types.ts`).
- [x] 7.2 Services: `updateConvocationMinutesReason(eventId, convocationId, reason)` (PUT
      `.../convocations/{id}/minutes-reason`) and `updateMatchParticipationReason(eventId,
      teamPlayerId, reason)` (PUT `.../match-participation/{teamPlayerId}/reason`), each with
      a service unit test mocking the shared Axios client.
- [x] 7.3 New shared component `Front/src/apps/coach/pages/convocations/components/MinutesReasonEditor.tsx`
      (+ `.module.css`) — inline edit/clear affordance for a single player's reason, used by
      both editing screens; unit-tested in isolation.
- [x] 7.4 `useConvocationManagement.ts`: added `mgmtMinutesReasonMap` (seeded from
      `ConvocationItem.minutesReason` alongside the existing excuse map) and
      `saveMinutesReason(playerId, reason)`, which resolves the player's `convocationId` from
      the existing `mgmtConvMap` and calls the new service — never part of `handleSave`
      (saving the lineup never requires a reason).
- [x] 7.5 `AlineacionTab.tsx` (pre-match): added an optional "Motivos de minutos" panel below
      the existing Pendientes/Desconvocados side panel, rendering one `MinutesReasonEditor`
      per called-up player (`lineupPlayers`) when `onSaveMinutesReason` is supplied. Wired
      from `ConvocationMatchDetail.tsx` via `minutesReasonMap={convocation.mgmtMinutesReasonMap}`
      / `onSaveMinutesReason={convocation.saveMinutesReason}`. Deliberately NOT integrated
      inside `IdealLineup`'s pitch/bench rendering (shared with the Squad page) — the panel
      is additive and never blocks saving the lineup.
- [x] 7.6 `PartidoEnDirectoTab.tsx` (post-match/live): added a "Motivos de minutos" section
      inside the existing read-only "saved data" banner (shown once
      `live.hasSavedData && live.savedParticipationData`), one `MinutesReasonEditor` per
      participation row, calling `updateMatchParticipationReason` with the player's
      `teamPlayerId`. Matches the backend constraint that a `MatchParticipation` row must
      already exist before a reason can be attached — the panel only appears after the match
      has been saved at least once.
- [x] 7.7 Read-only display: `AttendanceMatchesTab.tsx`'s expanded per-match detail row now
      shows an `InfoOutlinedIcon` + `Tooltip` with the reason text when
      `MatchAttendanceCell.minutesReason` is set (wired end-to-end from
      `liveMatchService.getMatchMinutes()` through `AttendanceSummaryContent.tsx`'s
      `minutesReasonByEventAndPlayer` map). No changes to the collapsed card summary or the
      "Otros eventos"/"Entrenamientos" tabs — this is match-only, matching the backend scope.
- [x] 7.8 Tests (TDD, Vitest + Testing Library, all passing): `MinutesReasonEditor.test.tsx`,
      `convocationService.minutesReason.test.ts`, `liveMatchService.minutesReason.test.ts`,
      `useConvocationManagement.minutesReason.test.tsx`, `AlineacionTab.minutesReason.test.tsx`,
      `PartidoEnDirectoTab.minutesReason.test.tsx`, `AttendanceMatchesTab.minutesReason.test.tsx`,
      `AttendanceSummaryContent.minutesReason.test.tsx`.
- Verify: `npm run build` from `Front/` — zero errors. `npm run test` — all new tests green;
      pre-existing failures in `AttendanceSummaryContent.trainingsPhotoAndOrder.test.tsx` and
      `AttendanceSummaryContent.dashboardPerEventBreakdown.test.tsx` confirmed unrelated
      (reproduced identically on the pre-change code).
