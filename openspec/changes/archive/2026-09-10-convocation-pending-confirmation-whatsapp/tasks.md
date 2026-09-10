## 1. Shared registration-status helper

- [x] 1.1 Read `GetTeamPlayer.cs`'s current inline `RegistrationStatus` computation
      (`Approved`/`Pending`/`None` from `LinkedUserId` + open `FamilyMemberAccountRequest`) to
      capture its exact query shape before extracting it.
- [x] 1.2 Extract it into a small static helper (e.g.
      `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Players/Services/FamilyMemberRegistrationStatus.cs`,
      final placement decided against sibling `*Services/` conventions in that feature) that
      both `GetTeamPlayer.cs` and the new endpoint call — no behavior change to `GetTeamPlayer`.
- [x] 1.3 Update `GetTeamPlayer.cs`'s handler to call the extracted helper; run its existing
      tests unchanged to confirm no regression.

## 2. New endpoint — GetConvocationNotificationRecipients

- [x] 2.1 Create
      `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Convocations/GetConvocationNotificationRecipients.cs`
      as a single-file `IFeatureModule` vertical slice (mirrors `GetEventConvocations.cs`):
      `MapGet("/api/events/{eventId}/convocations/notification-recipients", ...)` binding
      `[FromQuery] string[] teamPlayerIds`.
- [x] 2.2 Define `ConvocationNotificationRecipientsQuery : IQueryApp<ConvocationNotificationRecipientsResponse>,
      IRequireFeaturePermission, IRequireTeamMembership` (`FeatureRoute =>
      CoachFeatureRoutes.Convocations`, `RequiredPermission => "Read"`), resolving `TeamId` from
      the `SportEvent` the same way `GetEventConvocations` does (404-equivalent `DomainException`
      if the event doesn't exist).
- [x] 2.3 Define response records: `ConvocationNotificationRecipientsResponse(PlayerRecipients[]
      Players)`, `PlayerRecipients(string TeamPlayerId, string PlayerAlias, FamilyRecipient[]
      FamilyMembers)`, `FamilyRecipient(string FamilyMemberId, string? Name, string? LastName,
      string Phone, string? FamilyMember)`.
- [x] 2.4 Implement the handler: `AsNoTracking()` query joining `Convocations` (filtered to
      `SportEventId == eventId && teamPlayerIds.Contains(TeamPlayerId)`) with
      `TeamPlayerFamilyMember`, using the Section 1 helper to filter to
      `RegistrationStatus == Approved && !string.IsNullOrWhiteSpace(Phone)`; requested ids with
      no matching convocation are simply absent from/empty in the result (no error) per
      `design.md` Decision 1 step 2/5. Implemented as: absent from the response (requested ids
      without a matching convocation are dropped, not returned with an empty array) — allowed by
      the spec's "absent from, or returned with an empty recipients list in" wording.
- [x] 2.5 Register route tags/`Produces<>` consistent with `GetEventConvocations.cs`
      (`.WithTags("Convocations")`).

## 3. Backend tests

- [x] 3.1 Unit test the extracted `FamilyMemberRegistrationStatus` helper: `Approved` (has
      `LinkedUserId`), `Pending` (open `FamilyMemberAccountRequest`, no `LinkedUserId`), `None`
      (neither).
- [x] 3.2 Handler tests for `GetConvocationNotificationRecipients` covering each spec scenario
      in `specs/convocation-pending-notification-recipients/spec.md`:
      - player with ≥1 approved+phone family member → included with correct recipients
      - player with only `None`/`Pending` family members, or none at all → included with empty
        `FamilyMembers`
      - approved family member with empty/null phone → excluded from recipients
      - requested `teamPlayerId` with no convocation for the event → does not error the batch
      - caller without `Convocations` `Read` permission on the team → covered by the query
        declaring `IRequireFeaturePermission`/`IRequireTeamMembership` correctly (asserted by
        test), enforced generically by `FeaturePermissionBehavior`/`TeamMembershipBehavior`
        (already covered by their own dedicated behavior tests, same pattern as
        `GetEventConvocations` which has no separate integration-level auth test either).
- [x] 3.3 `dotnet build` — zero errors.
- [x] 3.4 `dotnet test` — full suite green except 2 pre-existing, unrelated failures
      (`AdnLegibleImporterFullDocumentSpotCheckTests`, `GameModelSeederRealDocumentTests` — both
      in the game-model import pipeline, untouched by this change; confirmed via
      `git status --porcelain` that this change's diff never touches
      `AdnLegibleImporter.cs`/game-model files).

## 4. Coordination handoff

- [x] 4.1 Confirm the endpoint contract (route, query param name `teamPlayerIds`, response
      shape) matches what `design.md` §1 documents before frontend work (§5-8 below) starts, so
      `convocationNotificationService.ts` can be written against a stable contract — the two
      sides can still be implemented in either order since the frontend service layer only needs
      the documented contract to write its tests against a mocked `client` (`design.md` Open
      Questions). Implemented exactly as documented: same route, query param name, and response
      shape.
- [x] 4.2 `returnUrl`/redirect-after-login support is explicitly **not** part of this change —
      confirmed and reasoned in `design.md` §F0 (two separate redirect sites in
      `SharedLogin`/`CoachAuthContext`, cross-cutting to every login path in the app). No task
      here implements it; flagged only as a candidate follow-up change.

## 5. Frontend — message/link util and service

- [x] 5.1 Write failing tests (Red) for
      `Front/src/apps/coach/pages/attendance/utils/__tests__/pendingConfirmationWhatsApp.test.ts`
      covering `buildPendingConfirmationMessage` (event type, rival, date, time, location,
      deep-link line — with/without rival, with/without location) and `buildWaMeLink` (strips
      non-digit characters from phone, URL-encodes the message, builds `https://wa.me/<digits>?text=...`).
- [x] 5.2 Implement
      `Front/src/apps/coach/pages/attendance/utils/pendingConfirmationWhatsApp.ts`
      (`PendingConfirmationEventSummary` type, `buildPendingConfirmationMessage`,
      `buildWaMeLink`) per `design.md` §F3 — minimal code to turn 5.1 green.
- [x] 5.3 Write failing tests (Red) for
      `Front/src/apps/coach/services/__tests__/convocationNotificationService.test.ts`
      (`vi.mock` the shared `client`) asserting `getConvocationNotificationRecipients(eventId,
      teamPlayerIds)` calls `GET /api/events/{eventId}/convocations/notification-recipients` with
      a repeated `teamPlayerIds=a&teamPlayerIds=b` query string (not bracket notation) and
      returns `resp.data.players` (empty array when the response has no `players`).
- [x] 5.4 Implement `Front/src/apps/coach/services/convocationNotificationService.ts` per
      `design.md` §F4 — minimal code to turn 5.3 green.

## 6. Frontend — `ConvocationCard` selection support

- [x] 6.1 Write failing tests (Red) in a new
      `Front/src/apps/coach/pages/attendance/components/__tests__/ConvocationCard.selection.test.tsx`:
      no checkbox rendered when `selectable` is omitted/false (regression guard for the 4
      existing call sites); checkbox rendered and reflects `selected` when `selectable` is true;
      clicking the checkbox calls `onToggleSelect` with the card's `teamPlayerId`
      (`conv.player.id`), not the convocation id (`conv.id`).
- [x] 6.2 Add the optional `selectable`/`selected`/`onToggleSelect` props to
      `ConvocationCard.tsx` per `design.md` §F1 — minimal change to turn 6.1 green; run
      `ConvocationCard.test.tsx` (existing) unchanged to confirm no regression on the
      non-selectable call sites. Implemented with the checkbox as a sibling of the `<Link>`
      inside `cromoPhotoArea` (not nested inside it) to avoid the checkbox click bubbling into
      the player-detail navigation.

## 7. Frontend — bulk selection + notify action in `AttendanceTabs.tsx`

- [x] 7.1 Write failing tests (Red) for the "Pendientes de aceptar" group extended with
      selection: selecting individual pending cards updates `selectedPendingIds`; "Seleccionar
      todos" selects/deselects every pending `teamPlayerId` and shows indeterminate state when
      partially selected; "Notificar por WhatsApp" is disabled with an empty selection and
      enabled otherwise; selection resets when `eventId` changes. Extend the existing
      `AttendanceTabsGroupsDefaultState.test.tsx`/`AttendanceTabsAttendanceAllButtonRole.test.tsx`
      suite style (same file or a new sibling `AttendanceTabs.pendingSelection.test.tsx`, matching
      the codebase's existing pattern of splitting test files per facet — `frontend-testing.md`
      §2.1) rather than growing one already-large test file further.
- [x] 7.2 Implement the `selectedPendingIds` state, the `headerExtra` "Seleccionar todos"
      checkbox + "Notificar por WhatsApp" button, and wiring `ConvocationCard`'s new selection
      props for pending-group cards only, per `design.md` §F1 — minimal change to turn 7.1 green.
- [x] 7.3 Write failing tests (Red) verifying `AttendanceTabs` derives and passes `eventSummary`
      correctly when provided by `AttendanceEvent`, and degrades (no crash, no message-building
      attempt) when `eventSummary` is undefined (existing tests that don't pass it).
- [x] 7.4 Add the optional `eventSummary` prop to `AttendanceTabs`'s `Props` and thread it to
      `NotifyPendingConvocationDialog` per `design.md` §F5 — minimal change to turn 7.3 green.
- [x] 7.5 Write failing tests (Red) in `AttendanceEvent.tsx`'s existing test suite (or a new
      sibling test file, same convention as 7.1) asserting `AttendanceEvent` derives
      `PendingConfirmationEventSummary` from its `event` state (`name`/`rivalName`/`location`/
      `startTime`/`eveDateTime`) and passes it to `AttendanceTabs` as `eventSummary`.
- [x] 7.6 Implement the derivation in `AttendanceEvent.tsx` per `design.md` §F5 — minimal change
      to turn 7.5 green.

## 8. Frontend — `NotifyPendingConvocationDialog`

- [x] 8.1 Write failing tests (Red) in
      `Front/src/apps/coach/pages/attendance/components/__tests__/NotifyPendingConvocationDialog.test.tsx`
      (`vi.mock` `convocationNotificationService`) covering, per `design.md` §F2 and the backend
      spec scenarios it must surface:
      - loading state while the recipients fetch is in flight
      - a player with ≥1 recipient renders one clickable WhatsApp button per family member,
        labeled with the relationship + name
      - a player with zero recipients renders the muted warning row, no button
      - the dialog-level summary line appears only when at least one selected player has zero
        recipients (and is absent when every selected player has ≥1)
      - clicking a family-member button calls `window.open` (mocked) with a `https://wa.me/...`
        URL built from `buildWaMeLink`/`buildPendingConfirmationMessage`, and does **not**
        auto-open any other recipient's link
      - a clicked button flips to the "Abierto" visual state; re-opening the dialog resets it
      - a fetch error renders an inline error state, not a crash
- [x] 8.2 Implement `NotifyPendingConvocationDialog.tsx` per `design.md` §F2 — minimal code to
      turn 8.1 green, reusing `pendingConfirmationWhatsApp.ts` (§5) and
      `convocationNotificationService.ts` (§5).

## 9. Frontend build/test verification

- [ ] 9.1 `npm run test` (Vitest) — full suite green, including every new/extended test file
      from §5-8 and the untouched existing `ConvocationCard.test.tsx`,
      `AttendanceTabs*.test.tsx` files (regression guard for the additive-only props change,
      `design.md` Risks).
- [ ] 9.2 `npm run build` — TypeScript strict, zero errors.
- [ ] 9.3 Manual smoke check (per `run` skill or dev server): open an event with ≥1 pending
      convocation as Coach, select players, open the notify dialog, confirm the built `wa.me`
      URL opens WhatsApp Web/app with the expected pre-filled message for a real phone number in
      dev data.
