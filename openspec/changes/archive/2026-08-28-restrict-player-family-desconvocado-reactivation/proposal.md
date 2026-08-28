## Why

On the Coach web app's `coach/attendance/` page, a Player or FamilyMember can currently drive the
`PUT /api/events/{eventId}/convocations/{convocationId}/status` endpoint for their own player's
convocation with **any** target status and on **any** event type, because the existing
authorization check only verifies *ownership* (own player) — it does not look at the current
convocation status, the target status, or the event's type. This is both too permissive (a
family member could self-reactivate a "Desconvocado" match/friendly convocation, which should be
a coach-only decision) and inconsistently exposed on the frontend (the "Lista de espera" button
is not hidden for this role in every rendering path). We need the backend to enforce, at the
authorization layer, that Player/FamilyMember may only move their own player out of
"Desconvocado" (back to "Pendiente de aceptar" or "Aceptada") when the event is a **training**
session — never for a match, friendly, or tournament — so the frontend has a trustworthy contract
to build the UI restriction on, and the rule holds even if the frontend check is bypassed.

## What Changes

- **Add a formal `Tournament` ("Torneo") member to `SportEventType`** (`Id = 6`, `Name =
  "Torneo"`), following the exact same pattern as `Match`/`Training`/`Meeting`/`FriendlyMatch`/
  `AccessTrials`. This closes the pre-existing gap identified in the initial design (there was no
  distinct backend event type for "torneo" even though the functional requirement's wording
  names it explicitly). This requires a new EF Core migration seeding the extra
  `SportEventTypes` row (`SportEventTypeEntityConfiguration.HasData` derives from
  `SportEventType.List()`), since `GetSportEventTypes` (`/api/sport-event-types`, the dropdown
  the frontend uses when creating/editing an event) reads from that table, not from the static
  list directly.
- Extend the existing `UpdateConvocationStatus` feature (`PUT
  /api/events/{eventId}/convocations/{convocationId}/status`) with a new authorization rule,
  additive to the current ownership check: when the caller's role is `Player` or `FamilyMember`
  **and** the convocation's current status is `Deconvoke` **and** the requested target status is
  `Pending` or `Accepted`, the request is only allowed if the event's `EventTypeId` is
  `Training` (2). Any other event type — including the new `Tournament` (6), `Match` (1),
  `FriendlyMatch` (4), `Meeting` (3), or `AccessTrials` (5) — → `403 Forbidden`
  (`ForbiddenAccessException`, consistent with the existing ownership-violation handling in the
  same handler).
- Expose a small, named accessor for the "Training" event type id on `SportEventType` (instead of
  the raw magic number `2`) so the new authorization rule — and any future caller — reads clearly
  and stays consistent with the SmartEnum-style pattern already used by this class.
- The reactivation rule stays an **allow-list** (`EventTypeId == Training`), not a deny-list —
  adding `Tournament` requires no change to `UpdateConvocationStatus.Handler`; it is blocked by
  construction, the same as any future `SportEventType` value added later.
- No new endpoint, no new request/response DTO shape for `UpdateConvocationStatus` — this remains
  a pure authorization tightening of that existing command handler. The only schema change is the
  additive `SportEventTypes` seed row for `Tournament`.
- Add regression tests (xUnit, following the existing
  `UpdateConvocationStatusHandlerTests.cs` patterns) covering: Player/FamilyMember reactivating a
  Deconvoked convocation on a Training event (allowed, unchanged), and on Match/FriendlyMatch/
  Meeting/AccessTrials/**Tournament** events (forbidden, new/extended). Coach/Administrator
  behavior is explicitly unchanged (no event-type restriction) and covered by an explicit "still
  works" regression test.
- Add domain-level tests confirming `Tournament` is a valid, listed `SportEventType` (`List()`,
  `FromName("Torneo")`, `From(6)`, `ValidateEventType(6)`) before touching the reactivation rule
  itself (TDD ordering — see `tasks.md`).
- Frontend note (informational only — implementation is out of scope for this backend-only
  change and belongs to a separate front-specialist change): the `coach/attendance/` page's
  "Desconvocados" group currently renders via `renderDeconvokedCard` in `AttendanceTabs.tsx`,
  which does **not** pass `hideWaitingListButton`/`canEditThisConvocation` to `ConvocationCard`
  the way the other groups' `renderCard` does — meaning the "Lista de espera" button and any
  future reactivation control in that group need the same role/event-type gating the other
  groups already have, sourced from this same backend contract (event type + 403 response) plus
  the role already available client-side via `coachAuthService.getRoles()`.

## Capabilities

### New Capabilities
- `convocation-status-role-authorization` — authorization rules for
  `PUT /api/events/{eventId}/convocations/{convocationId}/status` that go beyond simple
  ownership, specifically the training-only reactivation rule for Player/FamilyMember.

### Modified Capabilities
- None. No existing `openspec/specs/<name>/spec.md` currently documents convocation status
  authorization; this introduces the first formal spec for it rather than modifying one.

## Impact

- **Affected code**: `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Convocations/UpdateConvocationStatus.cs`
  (handler only — no route/contract shape change), `Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/Assistances/SportEventType.cs`
  (add a named `TrainingId` accessor **and** the new `Tournament` member), plus a new EF Core
  migration under `Back/ExtractionApi/src/RFFM.Api/Infrastructure/Migrations/` seeding the
  `Tournament` row into `SportEventTypes`.
- **Affected tests**: `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/UpdateConvocationStatusHandlerTests.cs`
  (new cases added; existing cases are unaffected because all existing seeded events already use
  `EventTypeId = 2` / Training), plus a new domain test file for `SportEventType` covering the
  `Tournament` addition.
- **API contract**: unchanged request/response shape for `UpdateConvocationStatus`; the only
  observable change there is that a request that used to succeed (200 OK) for Player/FamilyMember
  reactivating a Deconvoked convocation on a non-training event will now return `403 Forbidden`
  with a `ProblemDetails` body (`Title: "Acceso denegado"`). Separately, `GET
  /api/sport-event-types` will now also return the new `{ Id: 6, Name: "Torneo" }` entry — purely
  additive, no existing entry changes shape or id.
- **Frontend dependency**: `Front/src/apps/coach/pages/attendance/` should treat `403` from this
  endpoint as the source of truth and hide/disable the corresponding reactivation control for
  Player/FamilyMember on non-training events (and fix the missing `hideWaitingListButton` /
  `canEditThisConvocation` wiring in `renderDeconvokedCard`). Any frontend surface that lists or
  hardcodes `SportEventType` options (e.g. an event-creation dropdown, filters) should be checked
  by the front-specialist for whether it needs to special-case or simply pass through the new
  `Tournament` option — that investigation and any UI work is tracked separately and coordinated
  with the front-specialist once this backend contract is approved.
- **Database migration required**: a new, additive-only EF Core migration is needed to seed the
  `Tournament` row (`Id = 6`) into the `SportEventTypes` table. No existing rows change; no
  destructive schema change.
