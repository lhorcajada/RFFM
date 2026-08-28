## Context

`PUT /api/events/{eventId}/convocations/{convocationId}/status` (feature file
`Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Convocations/UpdateConvocationStatus.cs`) is
the single existing endpoint that changes a `Convocation`'s status. It is already shared by
Coach/Administrator (unrestricted) and Player/FamilyMember (restricted to their own player's
convocation, via a `UserProfile.PlayerId == Convocation.TeamPlayerId` check introduced to fix a
prior 401-vs-403 bug — see the doc comment at the top of
`UpdateConvocationStatusHandlerTests.cs`). It has no `IFeatureModule`-adjacent
FluentValidation validator today (this file predates that convention and uses inline
`ArgumentException`/`ForbiddenAccessException` throws instead) and is not wired to
`IRequireFeaturePermission`/`IRequireTeamMembership` — it does its own authorization inline.

Domain model recap (all under `RFFM.Api.Domain.Aggregates.Assistances`):
- `ConvocationStatus` (SmartEnum-style, not `SmartEnum.EFCore`-backed): `Pending=1`,
  `Accepted=2`, `Justified=4`, `Deconvoke=5`.
- `SportEventType` (same style): `Match=1` ("Partido"), `Training=2` ("Entrenamiento"),
  `Meeting=3` ("Reunión"), `FriendlyMatch=4` ("Amistoso"), `AccessTrials=5` ("Pruebas de
  acceso"). **Resolved (was an Open Question in the initial design): this change adds a sixth
  member, `Tournament=6` ("Torneo")**, closing the gap between the functional requirement's
  wording ("partido, amistoso o torneo") and the domain model.
- `SportEventType` is not just an in-memory list: `SportEventTypeEntityConfiguration` seeds a
  `SportEventTypes` table via `builder.HasData(SportEventType.List()...)`, and the
  `GET /api/sport-event-types` endpoint (`GetSportEventTypes`, feature
  `Features/Coaches/SportEventTypes/Queries/SportEventTypes.cs`) reads that table — the dropdown
  data the frontend uses when creating/editing an event comes from the DB, not the enum directly.
  Adding `Tournament` to the enum therefore requires a companion EF Core migration to seed the new
  row; without it, the enum and the DB table would disagree (`SportEventType.From(6)` would work
  in-memory but `/api/sport-event-types` would not list it and `SportEventTypeId = 6` would fail
  the DB's implicit FK-like consistency expectation, though there is no actual FK constraint
  enforcing this — `SportEvent.EventTypeId` is a plain `int`, validated only by
  `SportEventType.ValidateEventType` in `SportEvent.SetEventTypeId`).
- `CreateSportEvent`/`UpdateSportEvent`'s FluentValidation validators only assert
  `EventTypeId > 0` — they delegate the "is this a real type" check to
  `SportEvent.SetEventTypeId` → `SportEventType.ValidateEventType(id)` inside the domain entity.
  This means **no validator changes are needed** for `Tournament` to become a legal
  `EventTypeId` on event creation/update; adding the enum member (and its DB seed row) is
  sufficient.
- `Convocation.SportEvent` navigation gives the handler `EventTypeId` directly (already
  `.Include(c => c.SportEvent)` in the handler).

Frontend recap (informational, not part of this change's implementation): `AttendanceTabs.tsx`
already knows the caller's role (`coachAuthService.getRoles()`) and the event's type
(`sportEventTypeService.getSportEventTypes()` + `eventTypeId`), and `EventCard.tsx` already
derives `isTraining` from the event type name. No new data needs to reach the frontend for it to
decide whether to show a reactivation control — the missing piece is purely the backend
enforcing the rule so the frontend restriction is not just cosmetic.

## Goals / Non-Goals

**Goals:**
- Add a formal `Tournament` ("Torneo") `SportEventType` member (`Id = 6`) so the domain model
  matches the functional requirement's wording, including the DB seed migration for it and
  domain-level tests proving it behaves like every other `SportEventType` member.
- Make `UpdateConvocationStatus` reject (403) a Player/FamilyMember request that would move
  their own player's convocation out of `Deconvoke` (to `Pending` or `Accepted`) on any event
  whose type is not `Training` — including the new `Tournament` type, with no special-casing
  required thanks to the allow-list design (Decision 2).
- Keep the change additive and minimally invasive: same route, same request/response shape, same
  file (vertical slice), same exception-based authorization style already used in this handler.
- Leave Coach/Administrator behavior, and every other Player/FamilyMember transition (e.g.
  Pending → Deconvoke "self-excuse", which is unrelated to this rule), completely unchanged.
- Give the frontend a documented, testable contract (403 + existing `ProblemDetails` shape) to
  build the button-visibility logic on.

**Non-Goals:**
- No new endpoint, no new request/response DTO for `UpdateConvocationStatus`.
- No change to how Coach/Administrator authorization works (still unrestricted).
- No change to `CreateSportEvent`/`UpdateSportEvent` validators — `Tournament` becomes a legal
  `EventTypeId` automatically via the existing `SportEventType.ValidateEventType` check (see
  Context); no validator edit is needed for that to work.
- No frontend implementation — only a contract note for the front-specialist to pick up
  separately (fixing `renderDeconvokedCard`'s missing prop wiring, adding the reactivation
  control itself, and checking whether any frontend event-type dropdown/filter needs explicit
  handling for the new `Tournament` option — it should already flow through automatically via
  `GET /api/sport-event-types` if the frontend renders that list generically).
- No change to `AddConvocations`, `DeleteConvocation`, or `UpdateConvocationAssistance` — this
  change touches only the status-transition endpoint named in the proposal.

## Decisions

### 1. Extend the existing handler rather than add a new endpoint
**Decision**: Add the new rule inside `UpdateConvocationStatus.Handler.Handle`, in the same
`if (isPlayerOrFamilyRole)` block that already exists for the ownership check.
**Why**: The endpoint is already role-aware and already scoped to "this player's own
convocation"; the new rule is a further narrowing of the same authorization decision, not a new
capability. Splitting it into a second endpoint would duplicate the ownership-resolution logic
(`UserProfile` lookup) and give the frontend two URLs to reason about for what is conceptually
one action ("change my convocation status"). This also matches `.claude/rules/dotnet.md` /
`architecture.md`: one feature = one file; shared logic between call paths of the *same* feature
stays in that feature's handler, not split out.
**Alternative considered**: A new `POST /api/events/{eventId}/convocations/{convocationId}/reactivate`
endpoint restricted to Player/FamilyMember + Training. Rejected — it would need to duplicate the
ownership check, and the frontend would need to choose between two endpoints for what is a single
status dropdown/button today.

### 2. Rule shape: allow-list `Training`, not a deny-list of {Match, FriendlyMatch, Tournament}
**Decision**: The rule is expressed positively — reactivation from `Deconvoke` by
Player/FamilyMember is allowed **only if** `EventTypeId == SportEventType.TrainingId` — rather
than negatively enumerating `{Match, FriendlyMatch, Tournament}` as the blocked set.
**Why**: Even now that `Tournament` is a formal `SportEventType` member (this change adds it —
see Context), an allow-list keeps the rule correct and safe by construction against `Meeting` and
`AccessTrials` (event types the user didn't explicitly mention but that are clearly not "the
player can self-manage their call-up" scenarios either) and against any new `SportEventType`
added later — a new type is blocked by default until someone deliberately extends the allow-list,
which is the safer default for an authorization rule. Concretely: adding `Tournament` to
`SportEventType.List()` requires zero change to `UpdateConvocationStatus.Handler` — it is
excluded from reactivation purely because it isn't `Training`, the same as `Meeting` or
`AccessTrials` already are.
**Alternative considered**: Deny-list `{Match, FriendlyMatch, Tournament}` (explicitly enumerating
every type the functional requirement names). Rejected — silently permissive for
`Meeting`/`AccessTrials`, and requires editing `UpdateConvocationStatus.Handler` every time a new
`SportEventType` is added in the future, which is exactly the maintenance burden the allow-list
avoids.

### 3. Named accessor instead of a raw `2` in the new check
**Decision**: Add `public static int TrainingId => Training.Id;` to `SportEventType` and use
`SportEventType.TrainingId` in the new check, instead of comparing `EventTypeId == 2` inline.
**Why**: The class already exposes `.From(id)`/`.FromName(name)` but no direct way to reference
"the Training type's id" without a string lookup (`FromName("Entrenamiento")`, fragile to typos)
or a magic number. A one-line additive property is the smallest change that avoids introducing a
new magic number into a security-relevant condition, without refactoring the existing raw-int
usages elsewhere in this codebase (e.g. `AddConvocations.cs`'s `ConvocationStatusId = 1 //
Pending`), which are out of scope here.
**Alternative considered**: Leave `EventTypeId == 2` inline with a comment. Rejected as
marginally worse for a rule specifically about *this* type, given the fix is one line.

### 4. Exception type and status code: reuse `ForbiddenAccessException` (403)
**Decision**: Throw the existing `RFFM.Api.Domain.ForbiddenAccessException` (already mapped to
`403 Forbidden` / `ProblemDetails{Title: "Acceso denegado"}` in
`ServiceCollectionExtensions.AddCustomProblemDetails`) when the new rule is violated — the exact
same exception type already thrown two lines above for the ownership violation.
**Why**: Consistency — from the frontend's point of view, "you can't touch this convocation"
(ownership) and "you can't do this transition on this event type" (the new rule) are both
authorization failures on the same action, and should produce the same HTTP semantics. No new
error code/`ProblemDetails` field is introduced; the `Detail` message text differs so the two
cases remain distinguishable in logs/network tab if needed.
**Alternative considered**: A new `DomainException` subtype (400) carrying a specific
`ErrorCodes` value the frontend could branch on. Rejected for this change — nothing in the
functional requirement asks the frontend to show a different message per reason, and 403 is the
semantically correct code for "you're allowed to touch this resource in general, but not this
particular operation on it."

### 5. Where the check sits relative to the existing ownership check
**Decision**: Run the new check immediately after the existing ownership check succeeds, still
inside `if (isPlayerOrFamilyRole)`, and before `ConvocationStatus.From(request.NewStatusId)` /
`conv.SetConvocationStatusId(...)` mutate anything. Order: (1) load convocation, (2) resolve
role, (3) if Player/FamilyMember → ownership check (existing, unchanged), (4) if
Player/FamilyMember → **new**: reactivation-from-Deconvoke-requires-Training check, (5) apply the
status change (existing, unchanged).
**Why**: Fails fast, before any write; keeps a single linear early-return flow matching
`.claude/rules/dotnet.md §3.3` (early return over nested conditionals); ownership is checked
first because "wrong player" is a more fundamental violation than "wrong event type for this
transition," and the tests already assert 403 for ownership violations independent of status.

## API Contract (for the frontend)

No shape change. For completeness/reference:

```
PUT /api/events/{eventId}/convocations/{convocationId}/status
Authorization: Bearer <jwt>              # roles: Coach, Administrator, Player, FamilyMember
Body: { "newStatusId": number, "excuseTypeId": number | null }

200 OK                — status updated (no body)
400 Bad Request        — convocation/event not found, or invalid newStatusId (unchanged, existing behavior)
401 Unauthorized        — not authenticated (unchanged)
403 Forbidden           — EITHER:
                            (a) caller is Player/FamilyMember and the convocation belongs to a
                                different player (existing, unchanged), OR
                            (b) NEW: caller is Player/FamilyMember, the convocation's current
                                status is Deconvoke, the requested newStatusId is Pending or
                                Accepted, and the event's type is not Training (this includes the
                                new Tournament type, and any future SportEventType, by
                                construction of the allow-list — see Decision 2)
                          ProblemDetails: { title: "Acceso denegado", detail: "<reason text>", status: 403 }
```

The frontend cannot statically know from the request alone whether case (b) will trigger without
also knowing the event's type and the convocation's current status — both of which it already
fetches today (`GetEventConvocations` returns `StatusId` per convocation; the event's
`eventTypeId` comes from the events list/detail call). **Recommendation for the frontend change
that will consume this**: compute the same allow condition client-side
(`isPlayerOrFamily && currentStatus === 'Deconvoke' && event.eventTypeId === TRAINING_EVENT_TYPE_ID`)
to decide whether to render the reactivation control at all, and additionally handle a `403` on
this call defensively (in case the two checks ever drift) by surfacing the `ProblemDetails.detail`
message rather than the generic "sesión expirada" 401 handling. The "Lista de espera" button
visibility (requirement #3) is a separate, purely role-based condition
(`!isPlayerOrFamily`) that does not depend on this endpoint at all — it needs no backend change,
only fixing the prop wiring gap already identified in `renderDeconvokedCard`
(`AttendanceTabs.tsx`) so it's consistent with how `renderCard` already hides it.

## Risks / Trade-offs

- **[Risk]** A future new `SportEventType` beyond `Tournament` (added by this change) is
  introduced without anyone revisiting this rule. → **Mitigation**: the allow-list design
  (Decision 2) means a new type is blocked by default for this transition, which is the safe
  failure direction (over-restrictive, not under-restrictive); a product decision to allow it can
  extend the allow-list explicitly.
- **[Risk]** The `SportEventTypes` table seed (`HasData`) and the in-memory
  `SportEventType.List()` drift if a future change edits one without the other (e.g. someone adds
  a domain member but forgets the migration, or vice versa). → **Mitigation**: this change's
  tasks explicitly pair the enum addition with its migration in the same unit of work (see
  `tasks.md` §1), and the domain tests added for `Tournament` (Task 2) would also motivate adding
  an integration/consistency test if this drift becomes a recurring problem — flagged here, not
  solved by this change beyond doing it correctly once.
- **[Risk]** Existing frontend code (or a yet-unwritten button) calls this endpoint today for a
  Player/FamilyMember on a non-training event and currently succeeds (200); after this change it
  will start receiving 403 where it previously didn't. → **Mitigation**: per the research in this
  change, the current `ConvocationCard.tsx` deconvoked branch does not expose any
  Accept/Pending buttons at all (only "Lista de espera", already coach-only via
  `canEdit`/`hideWaitingListButton` in the `renderCard` path, though not in
  `renderDeconvokedCard` — see proposal). No current UI path is known to trigger this exact
  transition for Player/FamilyMember on a non-training event, so this is expected to be a
  behavior-only tightening with no observed regression, but the front-specialist should confirm
  before/while wiring the new UI control.
- **[Trade-off]** Keeping the authorization logic inline (no FluentValidation validator, no
  `IRequireFeaturePermission`) is inconsistent with the "validator required per ICommand"
  convention documented in `CLAUDE.md`/`.claude/rules/dotnet.md`. → Accepted as-is: this file
  already predates and diverges from that convention (plain `IRequest<Unit>`, not `ICommand`),
  and retrofitting it to the newer convention is a larger, separate refactor with its own risk
  profile — out of scope for this change, which intentionally keeps the diff minimal and
  consistent with the file's *existing* pattern rather than mixing two conventions in one PR.

## Migration Plan

One additive EF Core migration (for the `Tournament` seed row) plus a standard backend release —
no destructive schema change, no data backfill:
1. Add the `Tournament` member to `SportEventType.List()` (Task 1) and generate the EF Core
   migration for it (`dotnet ef migrations add AddTournamentSportEventType --startup-project
   ../RFFM.Host`, run from `Back/ExtractionApi/src/RFFM.Api`, or via `.\manage-migrations.ps1`
   per repo convention) so `SportEventTypeEntityConfiguration`'s `HasData` picks up the new row.
   Verify the generated migration only inserts the one new `SportEventTypes` row and touches
   nothing else.
2. Merge the `Tournament` addition + its migration, the `SportEventType.TrainingId` addition, and
   the `UpdateConvocationStatus.Handler` change together (single PR/commit — they're only
   meaningful combined for this change's purpose, though they are technically separable).
3. Run `dotnet test` (new domain tests for `Tournament` + new/existing
   `UpdateConvocationStatusHandlerTests` must pass).
4. Deploy backend, applying the new migration. No frontend deploy is required for the backend
   change to be safe/correct in isolation (the reactivation rule only ever narrows
   previously-allowed behavior for Player/FamilyMember; the new `Tournament` row is purely
   additive and ignored by any frontend that doesn't yet render it).
5. Frontend change (separate, front-specialist-owned) lands whenever ready; no coordination
   ordering constraint beyond "backend first is fine, frontend first would just mean the new UI
   control briefly surfaces a 403 the UI doesn't yet special-case." The front-specialist should
   separately confirm whether any frontend event-type list is hardcoded (rather than sourced from
   `GET /api/sport-event-types`) and would need an explicit update to surface `Tournament`.

## Open Questions

All open questions from the initial design are now resolved:
1. ~~"Torneo" (Tournament) is not a modeled `SportEventType` today.~~ **Resolved**: the user
   confirmed this change should add a formal `Tournament` `SportEventType` member (`Id = 6`) now,
   rather than treating "torneo" as loosely covered by `Match`/`FriendlyMatch`. See Context and
   `tasks.md` §1–2.
2. Should the same training-only restriction eventually apply to `AddConvocations`
   (Player/FamilyMember re-adding themselves after being fully removed, i.e. the "Lista de
   espera" → convocated path)? Today `AddConvocations` is Coach/Administrator-only
   (`[Authorize(Roles = "Coach,Administrator")]`), so this scenario is already impossible for
   Player/FamilyMember and needs no change — flagged here only for completeness/confirmation;
   still open, not blocking this change.
