## Context

`Convocation` (`Domain/Aggregates/Assistances/Convocation.cs`) already has `ExcuseTypeId`,
a fixed `ExcuseTypes` enum used exclusively when `AssistanceTypeId` marks the player as
**not attending** (`UpdateConvocationAssistance.cs`) or when a convocation is set to
`Deconvoke` (`UpdateConvocationStatus.cs`, defaults to id 7 "Decisión técnica"). Neither
of those cover the case this change targets: a player who **is** convocated/participates,
but plays fewer minutes than peers by the coach's decision. That case has no field at all
today, on either `Convocation` (pre-match plan) or `MatchParticipation` (post-match/live
record, `Domain/Entities/TeamPlayers/MatchParticipation.cs`).

The closest sibling for "small, dedicated field-level write endpoint on an existing
aggregate" is `UpdateConvocationAssistance.cs`/`UpdateConvocationStatus.cs` — each is a
one-file `IFeatureModule` with a `PUT` route scoped under `/api/events/{eventId}/convocations/{convocationId}/...`,
`[Authorize(Roles = "Coach,Administrator")]`, no `IRequireTeamMembership` (writes rely on
the route-level role check only, same as every other convocation write). The closest
sibling for "field-level write independent of the payload of a bigger upsert" is the gap
`SaveMatchParticipation.cs` currently has: `MatchParticipation.Update(...)` fully
overwrites the row on every call (it's a per-match upsert keyed by `EventId`+`TeamPlayerId`),
so any field not in scope of "the whole match state" (stats, cards, substitutions) needs
its own mutation path that `Update(...)` never touches, or a live-match re-save would
silently wipe a reason a coach just typed in a different screen.

## Goals / Non-Goals

**Goals:**
- Optional (never required), free-text, editable, deletable reason field on both
  `Convocation` and `MatchParticipation`.
- Editable/deletable at any time after creation, independently of every other field on
  the owning entity.
- Surfaced in every existing response DTO that already exposes minutes played or a
  convocation list, so the coach frontend can render it without a second round-trip.
- Coach-app only (existing `CoachFeatureRoutes.Convocations` / role gating patterns).

**Non-Goals:**
- No change to `ExcuseTypeId`/`ExcuseTypes` — that enum stays reserved for absence
  justification and is not touched.
- No auto-copy of the pre-match `Convocation.MinutesReason` into the post-match
  `MatchParticipation.MinutesReason` (or vice versa) — they are two independent
  decision points the coach may fill in independently, at different times, possibly
  with different text (e.g. plan says "vacation catch-up", post-match note adds "went
  well, ready for full minutes next week").
- No changes to aggregated/season-level endpoints (`GetSeasonPlayerMinutes`,
  `GetSeasonPlayerStats`, `GetTeamPlayerStatistics`) — these sum `MinutesPlayed` across
  many matches into a single number per player per season, so a single free-text reason
  has no natural slot there. Only genuinely per-match/per-convocation listings are
  extended.
- No Mobile, no Federation, no frontend changes.

## Decisions

### 1. Same field name on both entities: `MinutesReason`
Both `Convocation` and `MatchParticipation` get a field named `MinutesReason` (string?,
max 500). Using the identical name on both entities (rather than e.g.
`PlannedMinutesReason` / `ActualMinutesReason`) keeps the frontend contract simple — one
field name to render in both the pre-match convocation UI and the post-match match
detail UI — while the *entity* the field lives on already disambiguates "planned" vs
"actual" (a `ConvocationResponse.MinutesReason` is inherently pre-match; a
`PlayerParticipationRecord.MinutesReason` is inherently post-match/live). No enum, no
shared value object — a plain nullable string on each entity, mirroring `TeamNote.Text`'s
simplicity.

### 2. Two new dedicated single-field endpoints, not reuse of existing write endpoints
- `PUT /api/events/{eventId}/convocations/{convocationId}/minutes-reason` — new file
  `Features/Coaches/Convocations/UpdateConvocationMinutesReason.cs`. Not folded into
  `UpdateConvocationAssistance.cs` because assistance/excuse and minutes-reason are
  edited from different UI moments and have no validation coupling — keeping them
  separate avoids forcing the frontend to resend `AssistanceTypeId`/`ExcuseTypeId` just
  to edit a note, and mirrors this codebase's existing pattern of one file per
  field-level convocation write (status vs. assistance are already split this way).
- `PUT /api/events/{eventId}/match-participation/{teamPlayerId}/reason` — new file
  `Features/Coaches/Convocations/UpdateMatchParticipationReason.cs`. Deliberately not
  routed through `SaveMatchParticipationRequest`/`SaveMatchParticipation.Handler`: that
  endpoint's payload is the entire live-match state (scores, JSON blobs for cards,
  substitutions, formation changes, every convocated player's minutes) rebuilt and
  resent by the frontend on every save during a live match. Requiring that whole payload
  just to edit one player's reason text would be wasteful and risk clobbering
  concurrent live-match edits. The dedicated endpoint instead loads the single existing
  `MatchParticipation` row by `(EventId, TeamPlayerId)` and calls a new
  `SetMinutesReason(string?)` mutation — a 404 (`NotFoundException`,
  `MatchParticipationNotFound`) is returned if no participation row exists yet for that
  player/event (the coach must record minutes for the player at least once, via the
  normal live/post-match flow, before a reason can be attached).
- Both endpoints accept `{ "reason": "<text or null/empty>" }` and PUT-ing an
  empty/null value **clears** the field — this is how "editar y borrar" is satisfied
  without a separate `DELETE`, consistent with a single scalar field (unlike
  `TeamNote`, which is a list item and needs `DELETE` to remove the whole row).
- Role gate: `[Authorize(Roles = "Coach,Administrator")]` on both routes, matching
  `UpdateConvocationAssistance`/`SaveMatchParticipation`'s existing write gate (not
  `Coach`-only like `TeamNote`, since these two entities' other writes already allow
  `Administrator` too — no reason to narrow just for this field).

### 3. `MatchParticipation.Update(...)` never touches `MinutesReason`
`SaveMatchParticipation.Handler` continues to call the existing `Update(...)` signature
unchanged — `MinutesReason` is deliberately **not** one of its parameters, and
`Update(...)`'s body does not assign it. This guarantees a live-match re-save (which
happens repeatedly as the match progresses) can never silently wipe a reason set via the
dedicated endpoint. `MatchParticipation.Create(...)` also leaves `MinutesReason` unset
(null) — a freshly created participation row has no reason until the coach explicitly
adds one.

### 4. Domain mutation methods
```csharp
// Convocation.cs
public void SetMinutesReason(string? minutesReason)
{
    if (minutesReason != null && minutesReason.Length > 500)
        throw new ArgumentException("El motivo no puede superar los 500 caracteres");
    MinutesReason = string.IsNullOrWhiteSpace(minutesReason) ? null : minutesReason.Trim();
}
```
```csharp
// MatchParticipation.cs
public void SetMinutesReason(string? minutesReason)
{
    if (minutesReason != null && minutesReason.Length > 500)
        throw new ArgumentException("El motivo no puede superar los 500 caracteres");
    MinutesReason = string.IsNullOrWhiteSpace(minutesReason) ? null : minutesReason.Trim();
    UpdatedAt = DateTime.UtcNow;
}
```
Both normalize blank input to `null` (so "cleared" is always represented the same way,
never as an empty string) — mirrors `TeamNote.UpdateText`'s trim behavior but allows
null/empty as a valid "no reason" state instead of throwing.

### 5. Validation (FluentValidation)
`UpdateConvocationMinutesReasonCommand.Reason` / `UpdateMatchParticipationReasonCommand.Reason`:
`RuleFor(x => x.Reason).MaximumLength(500)` only — no `NotEmpty()`, since the field is
optional and clearing it (empty/null) is a valid, expected request.

### 6. Read-side changes — four DTOs get one new field each
- `GetEventConvocations.ConvocationResponse` → append `string? MinutesReason` (positional
  record, added as the last parameter to avoid reordering existing positional call sites).
- `GetMatchParticipation.PlayerParticipationRecord` → append `string? MinutesReason`.
- `GetPlayerMatchHistory.PlayerMatchRecordDto` → append `string? MinutesReason`.
- `GetTeamMatchMinutes.MatchMinutesRow` → append `string? MinutesReason`.
Each handler's existing `Select`/projection gains the corresponding `.MinutesReason`
read from the entity — no new joins needed since the field lives directly on the
entity already being queried.

### 7. Migration
Single EF Core migration `AddMinutesReasonToConvocationAndMatchParticipation` adding:
- `Convocations.MinutesReason` — `text`/`nvarchar`, `HasMaxLength(500)`, nullable.
- `MatchParticipations.MinutesReason` — same shape, nullable.
Generated via `.\manage-migrations.ps1` against `AppDbContext` (both tables already live
in the `app` schema).

### 8. Errors
- Unknown `convocationId` (scoped to `eventId`) → `ArgumentException`("Convocation not
  found"), same as every other convocation write in this folder (they don't use
  `NotFoundException`/`DomainException` consistently — matching the immediate sibling
  files' existing convention rather than introducing a new error type here).
- Unknown `(eventId, teamPlayerId)` `MatchParticipation` row → `RFFM.Api.Domain.NotFoundException`
  with code `MatchParticipationNotFound` (this slice is new, so it follows the newer
  `NotFoundException` convention used by `Features/Coaches/Notes/*`, rather than the
  older `ArgumentException` convention of the pre-existing convocation-write files).
- Validation failure (>500 chars) → `400` via `ValidationBehavior`/FluentValidation.
- Role not `Coach`/`Administrator` → `403 Forbidden` via `RequireAuthorization`.

## Risks / Trade-offs

- [Two independent fields, no auto-copy] → Accepted per Non-Goals; documented so a
  future change doesn't "fix" this as a bug.
- [Older convocation-write files use `ArgumentException`, new match-participation file
  uses `NotFoundException`] → Accepted; matches each area's existing local convention
  rather than retrofitting error handling across unrelated files in the same change.
- [PUT-with-null-clears instead of a separate DELETE] → Accepted; the field is a single
  scalar per entity, not a collection item, so there is nothing to "remove" beyond
  setting it back to absent.

## Open Questions

None — field name, endpoint shape, error handling, and DTO placement are all resolved
above.
