# Design: Enforcement and payment tracking for player sanctions

## Context (verified in code)

- `TeamPlayerSanction` (`Back/ExtractionApi/src/RFFM.Api/Domain/Entities/TeamPlayers/
  TeamPlayerSanction.cs`) has `Category` (`SanctionCategory` SmartEnum: `Competition` /
  `InternalDiscipline`), `StartDate`, `SanctionType` (free text), `Description`,
  `EstimatedEnd` (free text), `EndDate` (nullable — currently doubles as "lifted" marker),
  `IsAutomatic`, `Fine`, `SourceEventId`.
- `SetPlayerSanction.cs` is a deliberately non-Mediator, non-Mandator-validated
  `IFeatureModule` (its own comment cites `SetPlayerInjury.cs` as the precedent) exposing
  `GET`/`POST`/`PUT`/`DELETE` under `/api/catalog/teamplayer/{id}/sanctions`. `GET` requires only
  `RequireAuthorization()` (any role); writes require `[Authorize(Roles = "Coach,Administrator")]`.
  This change follows that same inline-Minimal-API pattern for its edits — it is the nearest
  sibling and the existing spec (`openspec/specs/player-sanctions/spec.md`) already documents it.
- `AddConvocations.cs` blocks convocation to a `TeamPlayer` with an active automatic sanction
  (`IsAutomatic && EndDate == null`) for events dated after the sanction's `StartDate`
  (design decision from the archived `player-card-tracking-and-suspensions` change). This
  behavior must keep working unmodified.
- `UpdateConvocationStatus.cs` is a Mediator `ICommand`-style handler (`IRequestHandler`, no
  FluentValidation — same "no validator" precedent) that sets `Convocation.ConvocationStatusId`
  and, only when transitioning to `Deconvoke`, `Convocation.ExcuseTypeId` (defaulting to
  `TechnicalDecision`, id 7, when none supplied).
- `SaveMatchParticipation.cs` (Mediator handler) upserts `MatchParticipation` rows and, only for
  `MatchPhase == "finished"` events of type `"Partido"`, runs
  `DetectAndCreateAutomaticSanctionsAsync` after the initial `SaveChangesAsync`. This is the
  natural hook point for minute-limit fulfillment detection too.
- `ExcuseTypes` (`Domain/Aggregates/Assistances/ExcusesType.cs`) is a plain class with static
  instances (ids 1–7), **not** a `SmartEnum` despite `.claude/rules/dotnet.md`'s general
  preference — it predates that convention and nothing in this change should silently migrate it
  (would touch every existing consumer: `UpdateConvocationStatus`, mobile, frontend). We extend it
  in place, matching its existing pattern.
- `Convocation` (`Domain/Aggregates/Assistances/Convocation.cs`) exposes `SetConvocationStatusId`,
  `SetExcuseTypeId` and a `Create(ConvocationModel)` factory that require no other mandatory state
  beyond `EventId`/`TeamPlayerId` — confirmed a new `Convocation` can be constructed directly
  already in `Deconvoke` status via `ConvocationModel { ConvocationStatusId = 5, ExcuseTypeId = 8,
  ... }`, with no dependency on `AddConvocationHandler`'s own validation/blocking logic (that logic
  lives in the handler, not the entity).
- The live-match screen (`Front/src/apps/coach/pages/convocations/hooks/useLiveMatch.ts`,
  `.../simulation/LiveMatchTimer.tsx`, `Front/src/apps/coach/services/liveMatchService.ts`) runs
  entirely client-side on a local timer with periodic explicit `saveMatchParticipation` calls and
  a `localStorage` backup — there is no polling loop reading server state during a live match, and
  no SignalR/WebSocket dependency anywhere in the repo (confirmed: no `signalr`/`socket` packages
  in `Back/ExtractionApi` or `Front/package.json`).

## Goals / Non-Goals

**Goals:**
- Let a sportive punishment (deconvocation from, or capped minutes in, a specific `SportEvent`)
  be declared on a sanction and auto-detected as fulfilled.
- Let an economic punishment track partial payment.
- Expose a single derived `status` so both frontend and any future consumer stop re-deriving
  "is this sanction active" ad hoc.
- Prevent deleting a sanction that has already been served.
- Give the live-match screen the data it needs to warn the coach — without inventing a
  server-push mechanism this repo doesn't have.

**Non-Goals:**
- No change to the existing automatic red-card/5-yellow-cards detection logic
  (`DetectAndCreateAutomaticSanctionsAsync`) beyond adding a sibling method for minute-limit
  fulfillment.
- No retroactive backfill of `status`/payment data for existing rows beyond nullable defaults
  (existing sanctions get `AmountPaid = null`, `SportivePunishmentType = null`, i.e. `Pending` or
  `Fulfilled` purely from their current `EndDate`, same as today).
- No change to how the coach lifts a purely economic or `InternalDiscipline` sanction — that
  stays a manual `PUT` exactly as today.
- No forcing behavior for `MinutesLimit` sportive sanctions — only `Deconvocation` sanctions force
  a convocation-side effect (Decisión 4); a minute cap cannot be enforced live against a running
  match in this repo, only detected after the fact via `SaveMatchParticipation`.
- No change to `AddConvocations.cs`/`BulkAddConvocationHandler`'s existing active-automatic-
  sanction block — the new forced-`Deconvoke` path is a separate creation route that does not go
  through those handlers, so nothing there needs editing (Decisión 4).

## Decisions

### Decisión 1 — "Nature" (deportiva / comportamiento) reuses `SanctionCategory`, no new enum

The user's requirement #2 asks for a deportiva/comportamiento distinction. `SanctionCategory`
already models exactly this axis, but **the axis is about origin, not about the resulting
punishment**: `Competition` (deportiva) means the sanction originates in the competition
regulations — a card, a sanctioning-committee decision — and always applies to the existing
automatic card sanctions (`Category = Competition`, `IsAutomatic = true`). `InternalDiscipline`
(comportamiento) means the sanction originates in an internal club/coach decision — lateness,
misconduct, anything not dictated by an external regulation. **Confirmed by the user: this
distinction is independent of whether the resulting punishment is economic and/or sportive
(deconvocation/minutes cap).** A `Competition`-category sanction can carry a fine and no sportive
punishment; an `InternalDiscipline`-category sanction can carry a `Deconvocation` and no fine;
either can carry both, or neither. `SportivePunishmentType`/`Fine` are decided per punishment,
`Category` is decided per origin — the two axes are deliberately orthogonal. Adding a second enum
for "nature" would create a duplicate, unowned axis. **Decision: reuse `SanctionCategory`
unchanged.** The frontend already renders `category` (`Sanctions.tsx`); front-specialist only
needs to relabel it as "Naturaleza: Deportiva (reglamento de competición) / Comportamiento
(decisión interna)" in the UI — no backend change.

Alternative considered: a new `SanctionNature` enum decoupled from `Category`, allowing e.g. a
`Competition`-category sanction with `InternalDiscipline`-nature. Rejected — no requirement or
existing data suggests these need to vary independently, and it would let `IsAutomatic` sanctions
(always `Competition`) end up with a mismatched "comportamiento" nature, which is nonsensical.

### Decisión 2 — Sportive punishment: new nullable `SportivePunishmentType` + `TargetEventId` + `MinutesLimit`

New SmartEnum `Domain/Entities/TeamPlayers/SanctionSportivePunishmentType.cs`:

```csharp
public sealed class SanctionSportivePunishmentType : SmartEnum<SanctionSportivePunishmentType>
{
    public static readonly SanctionSportivePunishmentType Deconvocation = new(nameof(Deconvocation), 1);
    public static readonly SanctionSportivePunishmentType MinutesLimit = new(nameof(MinutesLimit), 2);
    private SanctionSportivePunishmentType(string name, int value) : base(name, value) { }
    public static bool TryParseName(string? name, out SanctionSportivePunishmentType? type) { /* mirrors SanctionCategory.TryParseName */ }
}
```

New `TeamPlayerSanction` fields (all nullable — a sanction may have no sportive punishment at
all, e.g. a purely economic fine, or a behavioral warning with neither money nor sport
consequence):

```csharp
public SanctionSportivePunishmentType? SportivePunishmentType { get; private set; }
public string? TargetEventId { get; private set; }   // FK -> SportEvent.Id
public int? MinutesLimit { get; private set; }        // required iff SportivePunishmentType == MinutesLimit
public decimal? AmountPaid { get; private set; }       // economic, independent of the above
public SportEvent? TargetEvent { get; private set; }   // navigation, mirrors TeamPlayer
```

Entity invariants added to `Create`/`Update` (`ArgumentException`, matching this entity's
existing validation style — no FluentValidation here, per Contexto):
- `SportivePunishmentType == MinutesLimit` ⇒ `TargetEventId` non-empty and `MinutesLimit > 0`.
- `SportivePunishmentType == Deconvocation` ⇒ `TargetEventId` non-empty; `MinutesLimit` must be
  `null` (a deconvoked player has no minute cap — mutually exclusive within one sanction's
  sportive side, since a sanction only ever has *one* `SportivePunishmentType`).
- `SportivePunishmentType == null` ⇒ `TargetEventId` and `MinutesLimit` must both be `null`.
- `AmountPaid`, when set, must be `>= 0`. `AmountPaid` is accepted whether or not `Fine` is set,
  but the feature handler validates `AmountPaid <= Fine` when both are present (see Decisión 4 —
  this business rule lives in the inline handler next to the existing category/type checks, not
  in the entity, to match the file's existing split between "entity throws for structural
  invariants" and "handler returns `ValidationProblem` for request-shape checks").

`Update(...)` gains the four new parameters (all optional, default `null`), same additive
pattern as the existing `fine` parameter.

Alternative considered: separate `SanctionEnforcement` child entity/table instead of flat columns
on `TeamPlayerSanction`. Rejected — a sanction has at most one sportive enforcement record ever
(1:0..1, not 1:N), so a child table adds a join and a second aggregate root for no benefit; flat
nullable columns match how `IsAutomatic`/`Fine`/`SourceEventId` were already added.

### Decisión 3 — `status` is derived from `EndDate`, not a new persisted column

Requirement #5 asks for explicit `Pendiente`/`Cumplida` states. Two options:

(a) New persisted `SanctionStatus` enum column, kept in sync with `EndDate` by application code.
(b) Derive `status` purely from `EndDate` (`null` → `Pending`, non-null → `Fulfilled`) and expose
    it as a computed DTO field, never persisted.

**Decision: (b).** `EndDate` is already the field `AddConvocations` reads to decide whether an
automatic sanction still blocks convocation (`IsAutomatic && EndDate == null`), and it is already
the field the coach sets via `PUT` to "lift" a sanction. Introducing a second, independently
settable status column would let the two fall out of sync (e.g. `Status = Fulfilled` but
`EndDate = null`, which would silently keep blocking convocations while the UI claims the
sanction is served) — a real risk given `AddConvocations` is not part of this change's edit
surface and must keep working. Deriving `status` from `EndDate` makes "served" mean exactly one
thing everywhere. `SanctionRecordResponse` gains a computed `Status` string (`"Pending"` |
`"Fulfilled"`); nothing new is written to the database for it.

This also directly satisfies requirement #5's economic case ("el estado se cambia manualmente,
solo por el coach") for free: it's exactly today's `PUT ... endDate` behavior, just now surfaced
as a `status` label instead of the caller having to infer it from a raw date.

### Decisión 4 — `Deconvocation` sanctions force enforcement (not just intent); auto-fulfillment wiring

**User decision (supersedes the original Decisión 5 "record intent only" proposal):** creating a
sanction with `SportivePunishmentType = Deconvocation` and a `TargetEventId` — or editing an
existing sanction so it newly has that combination, or changes its `TargetEventId` — MUST force
the player's `Convocation` for `TargetEventId` to `Deconvoke` as a side effect, not merely allow
the coach to do it later by hand. This is a real cross-entity coupling (sanction → convocation)
and is the main change in this revision of the design.

**Shared enforcement service.** Extract the transition logic that already lives inline in
`UpdateConvocationStatus.Handler.Handle` into
`Domain/Services/SanctionConvocationEnforcementService.cs` (registered scoped, alongside
`ICurrentUserService`, matching that folder's existing convention), so both the manual endpoint
and the new sanction-triggered path use exactly one code path:

```csharp
public interface ISanctionConvocationEnforcementService
{
    // Transitions the existing convocation to Deconvoke with the given excuse, or creates a new
    // Deconvoke convocation for teamPlayerId/targetEventId if none exists yet. Does not call
    // SaveChangesAsync — caller controls the transaction boundary. Returns the (now-persisted-
    // in-context) Convocation so callers needing it can act further.
    Task<Convocation> ForceDeconvocationAsync(string teamPlayerId, string targetEventId,
        int excuseTypeId, CancellationToken cancellationToken);

    // Reverts a convocation this service previously forced back to Pending/no-excuse. No-ops
    // (and returns false) if the convocation's current state doesn't look like this service's
    // own handiwork (see the "signature guard" below) — never clobbers an unrelated manual change.
    Task<bool> TryRevertForcedDeconvocationAsync(string teamPlayerId, string targetEventId,
        CancellationToken cancellationToken);
}
```

`ForceDeconvocationAsync`:
1. `var conv = await _db.Convocations.FirstOrDefaultAsync(c => c.TeamPlayerId == teamPlayerId && c.SportEventId == targetEventId, ct);`
2. If found: `conv.SetConvocationStatusId(ConvocationStatus.FromName("Deconvoke").Id); conv.SetExcuseTypeId(excuseTypeId);` — reuses the exact two calls `UpdateConvocationStatus.Handler` already makes for a manual `Deconvoke` transition.
3. If not found (the event is future and convocations haven't been generated/sent yet — see below): create one directly in the final state, bypassing `AddConvocationHandler`/`BulkAddConvocationHandler` entirely (this is a distinct creation path, not a call to those handlers):
   ```csharp
   var model = new ConvocationModel {
       EventId = targetEventId, TeamPlayerId = teamPlayerId,
       AssistanceTypeId = null, ConvocationStatusId = ConvocationStatus.FromName("Deconvoke").Id,
       ExcuseTypeId = excuseTypeId
   };
   conv = Convocation.Create(model);
   _db.Convocations.Add(conv);
   ```

**Why bypassing `AddConvocations`'s block is safe (user's explicit concern):** `AddConvocations.cs`
blocks *normal* (`Pending`) convocation creation for a player with an active automatic sanction —
its entire purpose is to keep such a player out of the match. Forcing a convocation straight into
`Deconvoke` is the same outcome that block exists to achieve, just via a different, sanction-aware
path; the two mechanisms are aligned, not competing, and `AddConvocations.cs` needs **no changes**.
A later normal bulk/single convocation attempt for that same event will see the player already has
a `Convocations` row (now `Deconvoke`) and skip them via the existing "already convocated" check —
also already correct, no change needed.

**Convocation-doesn't-exist-yet case — decision.** Checked `AddConvocations.cs`/
`BulkAddConvocationHandler`: convocations are generated per event, either one at a time
(`AddConvocationHandler`, explicit per-player POST) or in bulk (`BulkAddConvocationHandler`, one
call seeding every team player as `Pending`) — there is no guarantee a `Convocation` row exists for
a given player/event pair before the coach (or a bulk job) creates it, especially for a future
event. **Decision: create the convocation immediately in `Deconvoke` state** (option chosen over a
"pending sanction to apply later" flag) — this is the simplest option that keeps the invariant
"a `Deconvocation` sanction with a `TargetEventId` always has a matching `Deconvoke` convocation"
true at all times, with no second flag, no background reconciliation step, and no new code path
needed when convocations are later bulk-generated (the bulk handler already skips existing rows).
A deferred-flag alternative was rejected: it would need a trigger to resolve later (this repo has
no background job/scheduler), and would let the invariant be false for an unbounded window.

**`TryRevertForcedDeconvocationAsync`'s signature guard.** To avoid ever clobbering a change the
coach made through the normal convocation UI after the forced transition, revert only applies
when the convocation's current state still matches exactly what forcing would have produced:
`ConvocationStatusId == Deconvoke.Id && ExcuseTypeId == ExcuseTypes.SportiveSanction.Id`. If the
coach has since manually changed the status or excuse, reversion is skipped (returns `false`) and
the sanction-side caller (Decisión 7) surfaces this as "no se puede revertir automáticamente la
desconvocatoria: contacta con el estado actual de la convocatoria" rather than silently no-op'ing.

**Sanction-side auto-fulfillment.** Both call sites mark the sanction `Fulfilled` in the same
request that forces the transition:
- `SetPlayerSanction.cs` (create/update handler, Decisión 7 below): after saving the new/edited
  `TeamPlayerSanction` row with `SportivePunishmentType = Deconvocation`, call
  `ForceDeconvocationAsync(...)` then `sanction.MarkFulfilled(DateTime.UtcNow)` directly — no
  lookup needed, the handler already holds the sanction reference.
- `UpdateConvocationStatus.Handler.Handle` keeps its own, narrower auto-fulfillment lookup for the
  case where the coach manually sets a convocation to `Deconvoke` through the ordinary endpoint
  and it happens to match a still-`Pending` `Deconvocation` sanction the coach created *without*
  yet having a matching event (should not normally happen now that creation force-creates the
  convocation, but stays as a defensive/legacy-data path — e.g. sanctions created before this
  migration, or a sanction whose forced convocation was later manually reverted by hand outside
  this service):
  ```csharp
  var pendingSportiveSanction = await _db.TeamPlayerSanctions.FirstOrDefaultAsync(s =>
      s.TeamPlayerId == conv.TeamPlayerId &&
      s.TargetEventId == conv.SportEventId &&
      s.SportivePunishmentType == SanctionSportivePunishmentType.Deconvocation &&
      s.EndDate == null, cancellationToken);
  if (pendingSportiveSanction is not null)
  {
      pendingSportiveSanction.MarkFulfilled(DateTime.UtcNow);
      conv.SetExcuseTypeId(ExcuseTypes.SportiveSanction.Id); // overrides the request's/default ExcuseTypeId
  }
  ```
`MarkFulfilled(DateTime at)` is a new, narrow entity method (`EndDate = at`) — preferred over
reusing the general `Update(...)` overload here because callers don't have (and shouldn't need)
the sanction's other current field values just to flip one date.

**MinutesLimit type — unchanged from the original design.** No forcing: in
`SaveMatchParticipation.Handler.Handle`, inside the existing `if (request.MatchPhase ==
"finished")` branch, add a sibling call `DetectAndFulfillMinutesLimitSanctionsAsync(request,
cancellationToken)` alongside `DetectAndCreateAutomaticSanctionsAsync`:

```csharp
foreach (var dto in request.Players)
{
    var pending = await _db.TeamPlayerSanctions.FirstOrDefaultAsync(s =>
        s.TeamPlayerId == dto.TeamPlayerId &&
        s.TargetEventId == request.EventId &&
        s.SportivePunishmentType == SanctionSportivePunishmentType.MinutesLimit &&
        s.EndDate == null, cancellationToken);
    if (pending is not null && dto.MinutesPlayed <= pending.MinutesLimit)
        pending.MarkFulfilled(DateTime.UtcNow);
}
```
Runs even if the player wasn't convocated through the sanction-aware flow (any saved
participation for that exact event/player pair counts) — matches the requirement's wording
("juega los minutos permitidos o menos"). If the player is never convocated to the target event
at all, the sanction simply stays `Pending` forever unless the coach manually sets `EndDate` via
`PUT` — same manual-override escape hatch as any other sanction. The user's requirement #3
rediscussion (this revision) only concerned `Deconvocation`; `MinutesLimit` intentionally still
does not force anything at creation time, since "cap the minutes" cannot be enforced against a
live match programmatically in this repo (no server-side control of the coach's substitutions) —
only *detected* after the fact, which is what this mechanism already does.

### Decisión 5 — Deconvocation is forced, not merely recorded (supersedes original scope cut)

*(Superseded — see Decisión 4. Kept here, struck through in spirit, so the change history is
traceable for reviewers who read the first version of this design.)* The original proposal
recorded intent only and explicitly flagged this as an open question. The user's answer: force it.
The rest of this section is retained only as a pointer — all actual content moved into Decisión 4
above (service, convocation-doesn't-exist-yet handling, and the `AddConvocations` compatibility
argument).

### Decisión 6 — New `ExcuseTypes` entry, in place (no `SmartEnum` migration)

Add `SportiveSanction = new ExcuseTypes(8, "Sanción deportiva", justified: true)` to the existing
static list in `ExcusesType.cs`. `justified: true` because the absence is institutionally
mandated, not a personal excuse the coach is choosing to accept — this matters wherever
`Justified` feeds attendance statistics (kept consistent with `Injury`/`Study`/`Ill`/
`FamilyProblem`, all `true`). `UpdateConvocationStatus.Handler` sets this id automatically only
when auto-fulfilling a `Deconvocation` sanction (Decisión 4); the coach may also select it
manually from the existing excuse dropdown for any `Deconvoke` transition, sanction-linked or not
— it is just another value in the list, no special-casing needed in the request shape.

### Decisión 7 — Delete blocked when `status == Fulfilled`, with a time-boxed exception for forced deconvocations

Base rule unchanged: `DELETE /api/catalog/teamplayer/{id}/sanctions/{sanctionId}` gains, right
after the existing `NotFound` check:

```csharp
if (sanction.EndDate is not null && !CanStillReverseDeconvocation(sanction))
    return Results.Problem(
        detail: "No se puede eliminar una sanción ya cumplida.",
        statusCode: StatusCodes.Status409Conflict);
```
`409 Conflict` (not `400`) — the request is well-formed, it conflicts with the resource's current
state, matching `.claude/rules/architecture.md`'s status-code table (`409` is already used
elsewhere in this codebase's `ProblemDetails` conventions for state conflicts).

**New exception — the coach's correction margin (user's requirement #3, third bullet).** Because
Decisión 4 now auto-fulfills a `Deconvocation` sanction in the very same request that creates it,
the base rule above would make it un-deletable essentially instantly, leaving the coach no way to
undo a mistaken sanction. This is deliberately relaxed for exactly this case:

```csharp
bool CanStillReverseDeconvocation(TeamPlayerSanction s) =>
    s.SportivePunishmentType == SanctionSportivePunishmentType.Deconvocation &&
    s.TargetEvent is not null &&
    s.TargetEvent.EveDateTime > DateTime.UtcNow;
```
When this is `true`, `DELETE` proceeds: it removes the `TeamPlayerSanction` row **and** calls
`ISanctionConvocationEnforcementService.TryRevertForcedDeconvocationAsync(...)` for the sanction's
`TeamPlayerId`/`TargetEventId` before `SaveChangesAsync`. If the revert is skipped by the
signature guard (Decisión 4 — the convocation no longer looks like this service's own doing), the
sanction is still deleted (the coach explicitly asked to remove it), but the response includes a
warning-level `detail` telling the coach the convocation itself must be corrected by hand, since it
was no longer safe to assume what to revert it to.

**Once the target event's date has passed, the exception no longer applies** — `Fulfilled` +
`Deconvocation` + past event behaves exactly like any other `Fulfilled` sanction: `409 Conflict`,
no deletion, no reversal. Rationale: a deconvocation for a match that has already happened is a
historical fact, not a pending correction; letting a coach delete it (and silently revert a past
match's convocation) would corrupt already-consumed attendance/history data. This is the answer to
the user's "¿se revierte la desconvocatoria?" question: **yes, but only while the target event is
still in the future.**

**Editing (`PUT`) applies the same time-boxed rule**, extended to cover a *changed* `TargetEventId`
(explicitly asked about by the user):
- If the edited sanction still targets the same event and the event is still future: the handler
  may freely change other fields (fine, description, `minutesLimit` doesn't apply here); if the
  edit removes the `Deconvocation` punishment entirely (e.g., converts to a plain fine), the
  handler calls `TryRevertForcedDeconvocationAsync` for the old target before saving, same as
  delete.
- If the edit changes `TargetEventId` **and the old target event is still future**: revert the old
  convocation (`TryRevertForcedDeconvocationAsync` for the old pair), then force the new one
  (`ForceDeconvocationAsync` for the new pair), then keep/refresh `EndDate` (still `Fulfilled`,
  now against the new event).
- If the edit changes `TargetEventId` **and the old target event has already passed**: rejected —
  `409 Conflict`, same rationale as delete-after-the-fact above. The coach cannot retroactively
  move an already-consumed sportive punishment to a different match.
- Editing a field that has no bearing on the forced convocation (e.g. only `fine`/`description`)
  on an already-`Fulfilled`, past-event `Deconvocation` sanction is still allowed — the delete/edit
  block only guards the punishment-defining fields (`sportivePunishmentType`, `targetEventId`,
  `minutesLimit`), matching how a `Fulfilled` sanction today can still have its `fine` edited via
  `PUT` (see "Update a sanction" requirement, unchanged).

### Decisión 8 — Payment fields: `AmountPaid` persisted, `PendingAmount` computed only

`AmountPaid` (decimal?) is persisted. `PendingAmount` is **not** persisted — it's
`Fine - AmountPaid` (or `null` if `Fine` is `null`), computed in `ToResponse(...)` at read time.
Persisting it would require re-deriving it on every `Fine`/`AmountPaid` edit and risks drifting;
computing it is one line and always correct. `SanctionCreateRequest`/`SanctionUpdateRequest` gain
optional `AmountPaid`; the inline handler validates `AmountPaid is null || AmountPaid <= (Fine ??
0)` and `AmountPaid is null || AmountPaid >= 0`, returning `Results.ValidationProblem` on failure
(same pattern as the existing `category` check in this file).

### Decisión 9 — New read endpoint for the live-match minute-limit banner

`GET /api/events/{eventId}/sanctions/minute-limits` (new file
`Features/Coaches/Convocations/GetEventMinuteLimitSanctions.cs`, inline Minimal API — same
rationale as `SetPlayerSanction.cs`, this is a simple read projection with no command semantics),
`RequireAuthorization()` open to any role (consistent with requirement #6 — everyone can *view*
sanction data): returns `[{ teamPlayerId, sanctionId, minutesLimit }]` for sanctions with
`TargetEventId == eventId && SportivePunishmentType == MinutesLimit && EndDate == null`. Scoped
to one event (not the whole team) because that's exactly what the live-match screen needs at
load time and keeps the payload tiny.

**Frontend wiring (recommendation for front-specialist, not implemented here):** fetch this once
when the live-match screen mounts (same place `getSeasonPlayerMinutes` is already fetched in
`liveMatchService.ts`), keep it in `useLiveMatch.ts` state, and compare against each player's
live `MinutesPlayed` on every timer tick (the hook already recomputes minutes every tick for the
scoreboard) — when a sanctioned player's live minutes reach their cap, emit the existing
`rffm.show_snackbar` browser event (severity `"warning"`), same bus every other cross-cutting
frontend notification in this repo already uses. **Recommended over a polling `GET` to the new
backend endpoint during the match** because the cap list doesn't change mid-match (no other actor
edits sanctions concurrently while a coach is running a live match) and the minutes themselves
are already tracked client-side with zero server round-trip — introducing polling here would be
the first polling loop in this codebase and buys nothing a one-time fetch + local comparison
doesn't already give.

### Decisión 10 — Visual distinction for a sanction-forced `Deconvoke` in the convocation listing: reuse `ExcuseTypeId == 8`, no new field

**User decision (requirement #2, second confirmation round):** the convocation listing must
distinguish, visually, a `Deconvoke` convocation that exists because a `Deconvocation` sanction
forced it (Decisión 4) from one the coach deconvoked by hand for an ordinary reason. Two designs
were considered:

(a) Reuse the existing `ExcuseTypeId` field: the frontend renders a distinct icon/label whenever
    `excuseTypeId == 8` ("Sanción deportiva"), with no backend change at all —
    `GetEventConvocations.cs`'s `ConvocationResponse` already exposes `ExcuseTypeId` today
    (confirmed in code, `Features/Coaches/Convocations/GetEventConvocations.cs:39`).
(b) Add an explicit `SanctionId` (nullable FK) to `Convocation`, populated by
    `ForceDeconvocationAsync` and cleared by `TryRevertForcedDeconvocationAsync`, so the frontend
    can both badge the row *and* deep-link to the originating sanction.

**Decision: (a).** Two reasons, beyond "simpler, no migration, no new column":

1. **Coherence with the backend's own definition of "forced."** `TryRevertForcedDeconvocationAsync`'s
   signature guard (Decisión 4) already treats *exactly* `ConvocationStatusId == Deconvoke.Id &&
   ExcuseTypeId == ExcuseTypes.SportiveSanction.Id` as "this looks like this service's own doing."
   The backend has no stronger notion of "forced by a sanction" than that signature — there is no
   persisted back-reference anywhere in the design that would make option (b) more *correct*, only
   more *explicit*. Badging the frontend on the same signal the backend itself uses to decide
   revertability keeps the two perfectly in sync by construction: whenever the backend would treat a
   convocation as sanction-forced (for revert purposes), the frontend badge agrees, and vice versa.
2. **No new schema, no new write path.** Option (b) would require `ForceDeconvocationAsync` and
   `TryRevertForcedDeconvocationAsync` to additionally read/write a new column, and the migration in
   this change (already adding four columns to `TeamPlayerSanction`) would need a fifth on
   `Convocation` too — for a capability (deep-linking to the sanction) nobody asked for.

**Accepted imprecision (documented, not fixed):** a coach who manually deconvokes a player through
the ordinary convocation UI and happens to pick "Sanción deportiva" from the excuse dropdown for an
unrelated reason will also see the badge, even though no `TeamPlayerSanction` exists for that
event/player. This is accepted: "Sanción deportiva" is presented in the excuse dropdown precisely to
mean "this absence is an enforced sportive sanction" (Decisión 6), so a coach choosing it manually is
asserting the same fact the badge communicates — there is no case where picking that excuse and *not*
wanting the badge is a coherent coach intent. If this ever needs to be pixel-precise (e.g. "link to
the exact sanction"), option (b) is the natural upgrade path and does not conflict with anything
built here.

**Frontend task (tasks.md §8):** in the convocation listing, render a distinct icon/label (e.g. a
gavel/shield icon with tooltip "Desconvocado por sanción deportiva") for any row where
`excuseTypeId === 8`, instead of the default excuse text/icon used for other `Deconvoke` rows.

### Decisión 11 — Manually reverting a forced convocation reopens the sanction (reverse coupling)

**User decision (requirement #3, second confirmation round):** if a convocation that is `Deconvoke`
because it was forced by a `Fulfilled` `Deconvocation` sanction (Decisión 4) is later transitioned to
a different status (`Pending`, `Accepted`, `Justified`, etc.) through the **normal** convocation flow
— `PUT /api/events/{eventId}/convocations/{convocationId}/status`
(`UpdateConvocationStatus.Handler`) — the linked sanction SHALL automatically reopen back to
`Pending` (`EndDate = null`). This reflects reality: the punishment (missing the match) was not
actually served, since the player ended up convocated normally after all.

**Where this is distinct from the already-designed revert path (Decisión 4/7).** There are now two,
deliberately separate, directions of coupling:

| Direction | Trigger | Code path | Guard |
|---|---|---|---|
| Sanction → Convocation (Decisión 4) | Sanction created/edited/deleted (`SetPlayerSanction.cs`) | `ForceDeconvocationAsync` / `TryRevertForcedDeconvocationAsync` (`ISanctionConvocationEnforcementService`), called directly from the sanction handler, **no `IMediator.Send`** | Signature guard: only reverts if convocation still looks like this service's own doing |
| Convocation → Sanction (this decision) | Convocation status changed away from `Deconvoke` (`UpdateConvocationStatus.Handler`) | New inline lookup + `TeamPlayerSanction.Reopen()`, inside `UpdateConvocationStatus.Handler.Handle` | Only reopens a sanction whose `EndDate` is currently non-null (`Fulfilled`) and whose `TargetEventId`/`TeamPlayerId` match the convocation being transitioned |

**No infinite loop, by construction, not by a guard flag.** `ISanctionConvocationEnforcementService`
mutates the `Convocation` entity directly via `SetConvocationStatusId`/`SetExcuseTypeId` on the
tracked `AppDbContext` — it never calls `IMediator.Send(UpdateStatusRequest)`. Conversely,
`UpdateConvocationStatus.Handler`'s new reopen step mutates the `TeamPlayerSanction` entity directly
(`sanction.Reopen()`) — it never calls `SetPlayerSanction.cs`'s handler logic or the enforcement
service. The two directions are two independent straight-line writes within the same
`SaveChangesAsync` unit of work; neither one re-enters the other's entry point, so there is no cycle
to break and no re-entrancy flag is needed.

**Implementation (`UpdateConvocationStatus.Handler.Handle`):** capture whether the convocation's
*current* status is `Deconvoke` before overwriting it, and whether the *new* status is not
`Deconvoke`; when both hold, look up a `Fulfilled` `Deconvocation` sanction for the same
`TeamPlayerId`/event and reopen it:

```csharp
var wasDeconvoke = conv.ConvocationStatusId == ConvocationStatus.FromName("Deconvoke").Id;

// ...existing conv.SetConvocationStatusId(...) / SetExcuseTypeId(...) block unchanged...

var isNowDeconvoke = status.Name.Equals("Deconvoke", StringComparison.OrdinalIgnoreCase);
if (wasDeconvoke && !isNowDeconvoke)
{
    var fulfilledSanction = await _db.TeamPlayerSanctions.FirstOrDefaultAsync(s =>
        s.TeamPlayerId == conv.TeamPlayerId &&
        s.TargetEventId == conv.SportEventId &&
        s.SportivePunishmentType == SanctionSportivePunishmentType.Deconvocation &&
        s.EndDate != null, cancellationToken);
    fulfilledSanction?.Reopen();
}
```
`TeamPlayerSanction.Reopen()` is a new, narrow entity method symmetric with `MarkFulfilled(DateTime
at)`: it sets `EndDate = null` and nothing else. No signature guard is needed on this side (unlike
Decisión 4's revert) because there is nothing ambiguous to protect against here: the only way a
`Fulfilled` `Deconvocation` sanction exists for that exact `TeamPlayerId`/`TargetEventId` pair is
via the forcing flow or the defensive auto-fulfillment path — both of which mean "this sanction's
fulfillment is entirely defined by this convocation's `Deconvoke` state," so un-`Deconvoke`-ing it
un-fulfills it, unconditionally.

**Past-event exception — deliberately allowed here, unlike Decisión 7's sanction-edit lock.**
Decisión 7 locks a `Fulfilled` `Deconvocation` sanction from being deleted/edited (on its
punishment-defining fields) once the target event's date has passed, reasoning that a served
sportive punishment for a match that already happened is historical fact. This decision
**intentionally does not add that same lock** to the reopen triggered here, for a different reason:
this path is not the coach editing the *sanction* — it is the coach (or a Player/FamilyMember,
within `UpdateConvocationStatus.Handler`'s existing role rules) directly changing the *convocation's*
status through the endpoint that already owns convocation-state changes regardless of the event's
date (nothing in `UpdateConvocationStatus.Handler` today blocks status changes for past events; that
endpoint is also used to record what actually happened after a match, e.g. marking attendance
`Justified` retroactively). If the coach uses that existing, unrestricted authority to declare "this
player was not actually absent from this past match," the sanction reopening is the correct
reflection of that correction, even though the event has passed — refusing to reopen would leave a
`Fulfilled` sanction contradicting the convocation record the coach just corrected, which is a worse
inconsistency than allowing the reopen. This does not weaken Decisión 7's lock: a coach still cannot
edit/delete the *sanction itself* for a past event through `SetPlayerSanction.cs`; they can only
achieve this reopening indirectly, by using `UpdateConvocationStatus`'s already-existing, unrestricted
authority over convocation state — which is not new authority granted by this change.

## Risks / Trade-offs

- [Deriving `status` from `EndDate` conflates "sanction was lifted for the automatic-sanction
  convocation block" with "sanction's own punishment was served"] → Acceptable because, by
  Decisión 4, `EndDate` is now set at exactly the moment the punishment *is* served (auto-detected
  for sportive, manual for economic) — the two concepts are made to coincide by design, not by
  accident.
- [`MarkFulfilled` running inside `UpdateConvocationStatus`/`SaveMatchParticipation` adds a
  cross-feature write these handlers didn't have before] → Both already share `AppDbContext`
  within the same request and already write to unrelated tables in the sanction case
  (`SaveMatchParticipation` already writes `TeamPlayerSanction` rows for automatic sanctions); this
  follows the exact same established precedent.
- [`SetPlayerSanction.cs` now writes `Convocation` rows, a table it never touched before] →
  Accepted, and is the entire point of the user's requirement #3; scoped tightly through
  `ISanctionConvocationEnforcementService` so the coupling is explicit and in one place, not
  inlined ad hoc in the sanction handler.
- [A coach could create a `Deconvocation` sanction for an event, have it auto-fulfill and force
  the convocation, then separately use the normal convocation UI to change that convocation's
  status again (e.g. back to `Pending`)] → **Resolved in this revision, not merely accepted**: see
  Decisión 11 — `UpdateConvocationStatus.Handler` now reopens (`EndDate = null`) a `Fulfilled`
  `Deconvocation` sanction whenever the convocation it forced is transitioned away from `Deconvoke`
  through the normal endpoint, keeping the sanction's status and the convocation's state from
  drifting apart. The remaining, much narrower risk is a sanction and convocation pair edited
  concurrently by two different requests racing each other — not addressed here, same as any other
  unguarded concurrent write in this codebase (no optimistic concurrency tokens on either entity
  today).
- [Forcing convocation creation from `SetPlayerSanction.cs` bypasses `AddConvocationHandler`'s
  validation, notably "event exists"] → Mitigated: the handler must independently validate
  `TargetEventId` refers to an existing `SportEvent` before calling `ForceDeconvocationAsync` —
  same `404`-shaped check the entity invariants in Decisión 2 already require for a non-empty
  `TargetEventId`, extended to an existence check at the handler level (mirrors `AddConvocations`'s
  own `sportEvent == null` guard).
- [A `MinutesLimit` sanction never fulfilled because the player is simply never convocated again
  to the target event] → By design (Non-Goals); the coach's existing manual `PUT` remains the
  override. Flagged, not fixed, in this change.
- [`SportEvent.Id` referenced by `TargetEventId` could later be deleted] → Out of scope: no
  `SportEvent` delete/cascade behavior is changed here; `TargetEventId` is a plain string FK with
  no navigation-required `Include`, consistent with `SourceEventId`'s existing treatment.

## Migration Plan

1. New EF Core migration `AddSanctionEnforcementAndPaymentFields` on `AppDbContext` (schema
   `app`, `manage-migrations.ps1`), adding `SportivePunishmentType` (int?), `TargetEventId`
   (text, nullable, FK to `SportEvents.Id`), `MinutesLimit` (int?), `AmountPaid` (numeric,
   nullable) to `TeamPlayerSanctions`. All nullable — existing rows need no backfill.
2. Register `ISanctionConvocationEnforcementService`/`SanctionConvocationEnforcementService`
   scoped in DI (`Program.cs`, alongside `ICurrentUserService`). Deploy backend; existing frontend
   keeps working unchanged against the additive API (new response fields are additive,
   `PendingAmount`/`Status` are new keys, nothing removed/renamed) — the only behavior-visible
   change for the existing frontend is that creating/editing a `Deconvocation`-type sanction now
   also moves a `Convocation` row, which the existing convocation-listing UI will simply reflect.
3. Frontend work (tasks.md) ships in a follow-up PR/session by front-specialist.
4. Rollback: drop the migration; no data loss for pre-existing columns since new columns are
   purely additive and unused by any code prior to this change.

## Open Questions

All ambiguities raised across both refinement rounds are now resolved. Kept here as a record of
what was asked and confirmed, not as pending items:

- `409 Conflict` (vs. `400`) for the delete-blocked-when-`Fulfilled` case. **Confirmed** — no
  objection raised; matches `.claude/rules/architecture.md`'s status-code table for state conflicts.
- "Sanción deportiva" as the new excuse label (id 8, `justified: true`). **Confirmed by the user.**
- The "convocation doesn't exist yet → create it directly in `Deconvoke`" choice (Decisión 4).
  **Confirmed** — accepted as opposed to a deferred flag, since this repo has no background
  job/scheduler to resolve such a flag later.
- The correction-margin design (Decisión 7 — delete/edit of a `Deconvocation` sanction remains
  possible, and reverts the forced convocation, only while the target event is still in the
  future, as opposed to a fixed grace period in minutes/hours after creation). **Confirmed by the
  user as the intended meaning of "margen para corregir un error"** — no separate grace-period
  mechanism or scheduler is needed.
- Whether a coach manually reverting the forced convocation through the ordinary convocation UI
  should leave the sanction `Fulfilled` (stale) or reopen it. **Confirmed: reopen it.** Resolved by
  Decisión 11 (reverse coupling in `UpdateConvocationStatus.Handler`), including the deliberate
  choice to allow the reopen even when the target event has already passed (see Decisión 11's
  "Past-event exception" for the justification, which is distinct from — and does not weaken —
  Decisión 7's past-event lock on editing the sanction directly).
- Whether the convocation-listing badge for a sanction-forced `Deconvoke` needs an explicit
  `SanctionId` back-reference or can reuse the existing `ExcuseTypeId == 8` signal. **Confirmed:
  reuse `ExcuseTypeId == 8`**, no new field — see Decisión 10 for the coherence argument (this is
  the same signal `TryRevertForcedDeconvocationAsync`'s own signature guard already relies on) and
  the accepted imprecision (a manually-chosen "Sanción deportiva" excuse with no underlying
  sanction also shows the badge, which is judged a coherent coach intent, not a bug).
