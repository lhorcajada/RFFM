## Context

`Back/ExtractionApi` enforces a custom, DB-backed feature permission model (`FeaturePermission` entity, `FeaturePermissionBehavior<TRequest,TResponse>` pipeline behavior) separate from ASP.NET Core `[Authorize(Roles=...)]`. Every command marked `IRequireFeaturePermission` declares a `FeatureRoute` + `RequiredPermission`; the behavior looks up a matching `FeaturePermission` row for the caller's role and rejects (`ForbiddenAccessException` → 403) if none exists or the stored `PermissionTypeId` doesn't satisfy the requirement.

`CreateClub`, `UpdateClub`, `DeleteClub` (`Features/Coaches/Clubs/Commands/*.cs`) already declare `FeatureRoute => "/coach/clubs"` and `RequiredPermission => "Write"`. Commit f3e776b added only a `ClubDirector` seed row (`PermissionTypeId = 3`, ReadWrite) for `/coach/clubs`; there is no `Coach` row, so `Coach` callers 403 today. Permission rows are seeded idempotently in `SeedFeaturePermissionsAsync` (`WebApplication.SeedPermissionsAsync`), guarded by an `Any()` existence check, so this is purely additive — no migration needed, no risk to existing rows.

Club creation has no quota concept today. `UserClub` (Domain/Aggregates/UserClubs) links a user to a club with `IsCreator` and `Membership`. `CreateClubHandler` currently creates the `Club` + a `UserClub` row with `IsCreator = true` unconditionally.

400-with-code is an established pattern in this codebase: `DomainException(title, description, code)` is mapped by `ServiceCollectionExtensions.AddCustomProblemDetails()` to `StatusCodeProblemDetails(400)` with `Extensions["code"] = exception.Code` — no per-endpoint try/catch needed (unlike `DeleteSeason`/`DeleteTeam`, which additionally catch `DomainException` in the endpoint to *downgrade* to 409; `CreateClub`'s endpoint does not catch anything, so a thrown `DomainException` flows straight to the global 400 mapping, which is what we want here). `ErrorCodes.cs` is the single source of truth for `code` string constants (see its own doc comment referencing the `unified-error-codes-i18n` change), consumed by the frontend i18n dictionary.

## Goals / Non-Goals

**Goals:**
- Coach role can call `CreateClub` (and, since the route is shared, `UpdateClub`/`DeleteClub`) again.
- A user cannot end up as creator of more than 3 clubs.
- The 400 response for quota breach is structurally identical to other domain-error 400s already returned by this API (frontend needs no new parsing branch).

**Non-Goals:**
- No admin UI / runtime editing of the quota number in this change (hardcoded constant, not `IsEditable` config).
- No changes to `UpdateClub`/`DeleteClub` business rules beyond regaining accessibility (they already require "Write", which Coach now has).
- No frontend implementation — this change only fixes the contract and documents it for the frontend team.
- No retroactive cleanup of existing over-quota users (none can exist yet since Coach was blocked from creating clubs).

## Decisions

**1. Grant Coach `Write` (not `ReadWrite`) on `/coach/clubs`, mirroring the existing per-command `RequiredPermission => "Write"` declarations.**
Alternative considered: `ReadWrite`. Rejected — nothing in the Clubs slice currently declares a `Read`-only requirement guarded by this route (club listing/detail use different, unguarded or differently-scoped queries), so `ReadWrite` would grant unused surface. `Write` is the minimal grant that unblocks `CreateClub`/`UpdateClub`/`DeleteClub`, all of which require exactly `"Write"`. Seed row: `("ClubManagement", "/coach/clubs", "Coach", 2 /* PermissionType.Write */, false)`, `isEditable: false` to match the other Coach-role rows in the same seed block (Coach rows are all `false`; only `ClubDirector` rows are `true` in this table today).

**2. Count quota by `UserClub.IsCreator == true`, not total club membership.**
The business requirement is "how many clubs has this (paying) user created", i.e. a creation allowance tied to a subscription tier — not how many clubs they belong to as a joined member/coach of someone else's club. `IsCreator` is exactly this flag and is already set by `CreateClubHandler` (`userClub.IsCreator = true`). Counting total `UserClub` rows would incorrectly block a coach who is a heavy joiner of other clubs' rosters but has created zero clubs of their own.

**3. Quota = 3, hardcoded as a constant in the Clubs feature file (`ClubConstants.MaxClubsPerCreator = 3` or inline in `CreateClub.cs`), not a DB-configurable value.**
"De momento" ("for now") in the business ask signals this is intentionally simple; no `IsEditable`/admin-configurable path exists for quotas elsewhere in the codebase to reuse, and building one is out of scope. If/when quota tiers are needed, a follow-up change can move this into `PaymentPlansSeeder`/subscription data (which already exists per `SeedPaymentsAsync`).

**4. Enforce the quota with a `DomainException` thrown inside `CreateClubHandler`, not FluentValidation.**
FluentValidation validators in this codebase validate the shape/values of a single command (`Name`, `CountryCode` non-empty, etc.) — see `CreateValidator` in the same file. Cross-aggregate checks that require a DB query against a *different* table (`UserClubs`, keyed by the authenticated user, not by any field of the request DTO) already follow the `DomainException`-in-handler pattern elsewhere (`DeleteSeason` → `SeasonHasRelatedData`, `DeleteTeam` → `TeamHasPlayers`, `PlayerService` → `ClubNotExist`). Keeping the quota check in the handler is consistent and keeps the validator focused on request-shape rules only.

**5. Error code contract.**
New constant `ErrorCodes.ClubQuotaExceeded = "club_quota_exceeded"` (snake_case, matching the sibling "already exists"/limit-style codes `TeamHasPlayers = "team_has_players"`, `SeasonHasRelatedData = "season_has_related_data"`, rather than the PascalCase style used for FluentValidation-adjacent codes). Thrown as:
```csharp
throw new DomainException(
    "Clubes",
    "Has alcanzado el número máximo de clubes que puedes crear (3).",
    ErrorCodes.ClubQuotaExceeded);
```
This flows through the existing global `DomainException` → 400 `ProblemDetails` mapping. No new middleware/mapping code required.

**Final 400 response contract** (for the frontend team — `POST api/catalog/club`, quota exceeded):
```
HTTP/1.1 400 Bad Request
Content-Type: application/problem+json

{
  "type": "https://httpstatuses.com/400",
  "title": "Clubes",
  "status": 400,
  "detail": "Has alcanzado el número máximo de clubes que puedes crear (3).",
  "code": "club_quota_exceeded"
}
```
(Exact envelope shape — `type`/`status` fields, `code` placed top-level via `Extensions` — matches every other `DomainException`-derived 400 already emitted by this API, e.g. `ClubNotExist`, `TeamHasPlayers`; the frontend's existing 400+`code` handling path requires no changes, only a new i18n key for `club_quota_exceeded`.)

The existing FluentValidation-driven 400 (`Name`/`CountryCode` empty) is unaffected and keeps its own shape (`code: "ValidationFailed"`, `errors: {...}` array) — the quota check runs inside the handler, after validation passes, so both remain distinguishable by `code`.

## Risks / Trade-offs

- [Risk] Granting Coach `Write` on `/coach/clubs` also re-enables `UpdateClub`/`DeleteClub` for Coach, not just create → Mitigation: this matches the pre-f3e776b behavior for Coach (the restriction commit was scoped to "club management" as a whole, and the business ask here is to restore Coach's ability to manage the clubs they create; explicit narrower per-action gating would require splitting `UpdateClub`/`DeleteClub` onto a different `FeatureRoute`, which is a larger change out of scope here — flagged as an Open Question below).
- [Risk] Quota is enforced only in `CreateClubHandler`, not in a DB constraint → a race between two concurrent `CreateClub` calls from the same user could both pass the count check before either commits → Mitigation: acceptable for a "for now" soft quota (matches existing patterns like `TeamHasPlayers`, which have the same TOCTOU characteristic); not addressed by this change.
- [Risk] Hardcoded `3` will need to move to configuration once paid tiers vary the quota → Mitigation: isolated as a single named constant so the follow-up is a one-line change plus a data source swap.

## Migration Plan

- Seed data change only (`SeedFeaturePermissionsAsync`); runs idempotently on next app startup, no EF migration.
- No rollback complexity: removing the Coach seed row (or shipping a revert) restores the 403 behavior; no data migration to undo.

## Open Questions

- Should `UpdateClub`/`DeleteClub` eventually be split onto separate, more granular `FeatureRoute`s (e.g. `/coach/clubs/manage` vs `/coach/clubs/create`) so Coach can be limited to create-only while ClubDirector keeps full management rights? Out of scope for this change; flagged for product/back-specialist follow-up if a stricter Coach permission boundary is later required.
