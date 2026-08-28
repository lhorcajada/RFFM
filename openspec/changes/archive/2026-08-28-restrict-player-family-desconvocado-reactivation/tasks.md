## 1. Domain tests (Red) — introduce `Tournament` SportEventType

- [ ] 1.1 Create `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/SportEventTypeTests.cs` (new
      file — no domain test for `SportEventType` exists today). Add failing tests:
      - `List_IncludesTournament_WithIdSix`: `SportEventType.List()` contains an entry with
        `Id == 6` and `Name == "Torneo"`.
      - `FromName_Torneo_ReturnsTournamentType`: `SportEventType.FromName("Torneo").Id == 6`
        (and case-insensitively, `FromName("torneo")` also resolves, matching the existing
        `StringComparison.CurrentCultureIgnoreCase` behavior).
      - `From_Six_ReturnsTournamentType`: `SportEventType.From(6).Name == "Torneo"`.
      - `ValidateEventType_Six_DoesNotThrow`: `SportEventType.ValidateEventType(6)` does not
        throw (mirrors how `SportEvent.SetEventTypeId` will accept it).
      - `List_StillContainsAllPreviousFiveTypes`: regression assertion that `Match`, `Training`,
        `Meeting`, `FriendlyMatch`, `AccessTrials` (ids 1–5) are all still present and unchanged —
        guards against accidentally renumbering an existing member while adding `Tournament`.
- [ ] 1.2 Run `dotnet test --filter SportEventTypeTests` from `Back/ExtractionApi` and confirm
      every new test in 1.1 fails (compiles against the current 5-member `List()`, so `Tournament`
      lookups fail/throw). Do not write production code before observing these failures.
- [ ] 1.3 Add a failing test to
      `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/GetSportEventTypesHandlerTests.cs` (new
      file if one does not already exist — check first) asserting that once the DB is seeded
      (via the `SportEventTypeEntityConfiguration.HasData` the test's `AppDbContext` fixture
      applies), the `GetSportEventTypesRequestHandler.Handle` result includes
      `{ Id: 6, Name: "Torneo" }` alongside the five existing entries. This is the test that
      exercises the "dropdown data comes from the DB, not the enum" path described in
      `design.md`'s Context section — it must fail until both the enum member and its migration
      exist.

## 2. Domain implementation (Green) — introduce `Tournament` SportEventType and expose `TrainingId`

- [ ] 2.1 In `Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/Assistances/SportEventType.cs`,
      add `private static readonly SportEventType Tournament = new SportEventType(6, "Torneo");`
      immediately after the existing `AccessTrials` field, and add it to the array returned by
      `List()` (`new[] { Match, Training, Meeting, FriendlyMatch, AccessTrials, Tournament }`).
      Do not renumber or otherwise touch the existing five members.
- [ ] 2.2 In the same file, add `public static int TrainingId => Training.Id;` (no other change
      to the class — keep `Training` as the private static field it already is).
- [ ] 2.3 Confirm no existing usage relies on `SportEventType` having exactly five members or no
      public members beyond `Id`/`Name`/`List()`/`FromName()`/`From()`/`ValidateEventType()`
      (quick `grep` for `SportEventType\.` and `SportEventType\.List\(\)` across
      `Back/ExtractionApi/src`) — this is purely additive so no breakage is expected, but verify
      before moving on.
- [ ] 2.4 Run `dotnet test --filter SportEventTypeTests` — all tests from Task 1.1 must now pass
      (Green).

## 3. Database migration for the `Tournament` seed row

- [ ] 3.1 From `Back/ExtractionApi/src/RFFM.Api`, generate the migration:
      `dotnet ef migrations add AddTournamentSportEventType --startup-project ../RFFM.Host`
      (or via `Back/ExtractionApi/manage-migrations.ps1` per repo convention — check its usage
      first). Confirm the generated migration's `Up()` only inserts one new row into
      `SportEventTypes` (`Id = 6, Name = "Torneo"`) and the `Down()` only deletes it — no other
      table or column should be touched.
- [ ] 3.2 Review the migration's `.Designer.cs` snapshot diff and
      `AppDbContextModelSnapshot.cs` — confirm the only model change is the additional
      `SportEventTypes` seed row.
- [ ] 3.3 Run `dotnet test --filter GetSportEventTypesHandlerTests` — the test from Task 1.3 must
      now pass (Green), proving the enum, the migration, and the `/api/sport-event-types` read
      path all agree.
- [ ] 3.4 Do not apply the migration to any shared/deployed database as part of this task —
      applying migrations is a deployment step (see `design.md` Migration Plan), not part of the
      local TDD loop.

## 4. Backend tests (Red) — new authorization rule

- [ ] 4.1 In `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/UpdateConvocationStatusHandlerTests.cs`,
      extend `SeedConvocationAsync` (or add a sibling seed helper/parameter) so the test can seed
      a convocation whose `Convocation.ConvocationStatusId` starts at `Deconvoke` (5) and whose
      `SportEvent.EventTypeId` is parameterizable (Training=2 by default, plus Match=1,
      FriendlyMatch=4, and the new Tournament=6 for the negative cases). Reuse the existing
      club/season/team/player/teamPlayer/event/convocation creation pattern already in that file
      — do not introduce a new fixture class.
- [ ] 4.2 Add failing test `PlayerReactivatesDeconvokedConvocation_OnTrainingEvent_Succeeds`:
      Player role, own `TeamPlayer`, convocation seeded at `Deconvoke` on a `Training` event,
      `NewStatusId = 2` (Accepted) → assert `200`-equivalent (handler completes) and
      `ConvocationStatusId == 2`.
- [ ] 4.3 Add failing test `FamilyMemberReactivatesDeconvokedConvocation_OnTrainingEvent_Succeeds`
      mirroring 4.2 for `FamilyMember` role and `NewStatusId = 1` (Pending).
- [ ] 4.4 Add failing test `PlayerReactivatesDeconvokedConvocation_OnMatchEvent_ThrowsForbiddenAccessException`:
      Player role, own `TeamPlayer`, convocation seeded at `Deconvoke` on a `Match` event,
      `NewStatusId = 2` → assert `ForbiddenAccessException` is thrown AND
      `ConvocationStatusId` remains `5` (unchanged) afterward.
- [ ] 4.5 Add failing test `FamilyMemberReactivatesDeconvokedConvocation_OnFriendlyMatchEvent_ThrowsForbiddenAccessException`
      mirroring 4.4 for `FamilyMember` role, `FriendlyMatch` event type, `NewStatusId = 1`.
- [ ] 4.6 Add failing test `PlayerReactivatesDeconvokedConvocation_OnTournamentEvent_ThrowsForbiddenAccessException`:
      Player role, own `TeamPlayer`, convocation seeded at `Deconvoke` on the new `Tournament`
      event type (`EventTypeId = 6`), `NewStatusId = 2` → assert `ForbiddenAccessException` is
      thrown AND `ConvocationStatusId` remains `5` (unchanged). This is the test that directly
      covers the functional requirement's explicit mention of "torneo".
- [ ] 4.7 Add regression test `CoachReactivatesDeconvokedConvocation_OnMatchEvent_Succeeds` and
      `AdministratorReactivatesDeconvokedConvocation_OnMatchEvent_Succeeds` proving the new rule
      does NOT apply to Coach/Administrator (extends the existing
      `CoachUpdatesAnyConvocation_Succeeds`/`AdministratorUpdatesAnyConvocation_Succeeds`
      coverage with a `Deconvoke`-start, non-training event specifically).
- [ ] 4.8 Add regression test
      `PlayerDeclinesOwnPendingConvocation_OnMatchEvent_Succeeds` proving the new rule does NOT
      block the *unrelated* Pending→Deconvoke self-decline transition on a non-training event
      (guards against an overly broad implementation of the rule).
- [ ] 4.9 Run `dotnet test --filter UpdateConvocationStatusHandlerTests` from
      `Back/ExtractionApi` and confirm the new tests in 4.2–4.8 fail for the right reason (4.2,
      4.3, 4.7, 4.8 fail only because the seed helper change from 4.1 doesn't exist yet or
      compiles-but-not-yet-guarded; 4.4/4.5/4.6 fail because no `ForbiddenAccessException` is
      thrown yet). Do not write production code before observing these failures.

## 5. Backend implementation (Green)

- [ ] 5.1 In `UpdateConvocationStatus.Handler.Handle`
      (`Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Convocations/UpdateConvocationStatus.cs`),
      inside the existing `if (isPlayerOrFamilyRole)` block, after the current ownership check and
      before the `ConvocationStatus.From(request.NewStatusId)` line, add the new guard:
      compute `isReactivatingFromDeconvoke = conv.ConvocationStatusId == ConvocationStatus
      .FromName("Deconvoke").Id` (or cache the id once at the top for readability),
      `targetIsPendingOrAccepted = request.NewStatusId == ConvocationStatus.FromName("Pending").Id
      || request.NewStatusId == ConvocationStatus.FromName("Accepted").Id`, and
      `isTrainingEvent = conv.SportEvent.EventTypeId == SportEventType.TrainingId`; if
      `isReactivatingFromDeconvoke && targetIsPendingOrAccepted && !isTrainingEvent`, throw
      `new ForbiddenAccessException("Solo se puede reactivar una convocatoria desconvocada en eventos de tipo entrenamiento.")`.
      This is an allow-list check (`== TrainingId`), so it blocks `Tournament` (and any other
      non-training type) with no per-type branching.
- [ ] 5.2 Use descriptive local `bool` variables for the compound condition (per
      `.claude/rules/dotnet.md` §3.3 / early-return style) rather than one long inline `if`.
- [ ] 5.3 Run `dotnet build` from `Back/ExtractionApi` — must succeed with no new warnings
      introduced by this change.
- [ ] 5.4 Run `dotnet test --filter UpdateConvocationStatusHandlerTests` — all tests from Task 4
      (new and pre-existing) must now pass (Green), including the `Tournament` case from 4.6.

## 6. Full regression pass

- [ ] 6.1 Run the full backend suite: `dotnet test` from `Back/ExtractionApi` — confirm no
      unrelated test regresses (in particular anything touching `Convocations`, `Assistances`,
      `SportEventType`, or `SportEventTypes`/`GetSportEventTypes`).
- [ ] 6.2 Re-read the final diff of `UpdateConvocationStatus.cs`, `SportEventType.cs`, and the new
      migration against `.claude/rules/dotnet.md` and `.claude/rules/architecture.md` checklists
      (vertical slice preserved, no `SaveChangesAsync` added beyond the existing call, early-return
      style, `ForbiddenAccessException` used consistently, no raw magic number left for the
      training type id, migration is additive-only) before handing off for review.

## 7. Spec/proposal closeout (no production code)

- [ ] 7.1 Confirm with the user that the `Tournament` `SportEventType` addition (Id = 6,
      Name = "Torneo") matches what was agreed, and that no further event types are needed for
      this change before archiving.
- [ ] 7.2 Run `openspec validate restrict-player-family-desconvocado-reactivation --strict` and
      fix any structural issues it reports.
- [ ] 7.3 Hand off the frontend-facing contract (the "API Contract" section of `design.md`) to
      the front-specialist for a separate, frontend-scoped OpenSpec change covering: the new
      reactivation control in the `coach/attendance/` "Desconvocados" group, gated by role +
      event type as described; the `renderDeconvokedCard` prop-wiring fix for
      `hideWaitingListButton`/`canEditThisConvocation` noted in the proposal; and a check of
      whether any frontend event-type list/dropdown/filter hardcodes the five prior
      `SportEventType` options rather than sourcing them from `GET /api/sport-event-types` (in
      which case it would need an explicit update to include `Tournament`).
