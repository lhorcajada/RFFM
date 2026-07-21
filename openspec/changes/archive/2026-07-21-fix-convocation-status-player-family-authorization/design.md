## Context

`PUT /api/events/{eventId}/convocations/{convocationId}/status` is implemented in the single-file feature `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Convocations/UpdateConvocationStatus.cs`. Today:

```csharp
app.MapPut("/api/events/{eventId}/convocations/{convocationId}/status",
        [Authorize(Roles = "Coach,Administrator,Player,FamilyPlayer,FamilyMember")] async (...) => { ... })
```

The role gate already lists `Player` and `FamilyMember` (plus a dead `FamilyPlayer`, which does not exist in `AppRoles` — `Back/ExtractionApi/src/RFFM.Api/Domain/Entities/AppRoles.cs` only defines `Administrator, Federation, Coach, ClubDirector, Player, FamilyMember, Fan, ClubMember`), so the `[Authorize(Roles=...)]` attribute is **not** the cause of the reported 401. The real bug is inside `Handler.Handle`:

```csharp
var profile = await _db.UserProfiles.AsNoTracking()
    .FirstOrDefaultAsync(p => p.ApplicationUserId == userId, cancellationToken);

if (profile is not null)
{
    var isPlayerOrFamilyRole = /* profile.RoleName is Player/FamilyPlayer/FamilyMember */;
    if (isPlayerOrFamilyRole)
    {
        if (string.IsNullOrWhiteSpace(profile.PlayerId) ||
            !string.Equals(profile.PlayerId, conv.Player.PlayerId, StringComparison.OrdinalIgnoreCase))
        {
            throw new UnauthorizedAccessException("No autorizado para responder esta convocatoria");
        }
    }
}
```

`conv.Player` is the `TeamPlayer` navigation on `Convocation` (`Include(c => c.Player)`), so `conv.Player.PlayerId` is the **master `Player.Id`** (`TeamPlayer.PlayerId`, set from `teamPlayerModel.PlayerId` — see `Domain/Entities/TeamPlayers/TeamPlayer.cs`).

`UserProfile.PlayerId`, however, is populated in `Features/Coaches/Teams/Queries/VerifyPlayerIdentity.cs`:

```csharp
var teamPlayerId = (string)teamPlayerRecord.TeamPlayerId; // TeamPlayer.Id, not master Player.Id
...
await SaveUserProfileAsync(request.UserId, AppRoles.Player.Name, teamPlayerId, team.Id, cancellationToken);
```

i.e. `UserProfile.PlayerId` actually stores a **`TeamPlayer.Id`**, not a master `Player.Id`. Comparing it against `conv.Player.PlayerId` (master `Player.Id`) compares two different ID spaces, so the check fails for every legitimate owner, throwing `UnauthorizedAccessException`. `Back/ExtractionApi/src/RFFM.Api/DependencyInjection/ServiceCollectionExtensions.cs` maps `UnauthorizedAccessException → 401` and `ForbiddenAccessException → 403`:

```csharp
setup.Map<UnauthorizedAccessException>(exception => new StatusCodeProblemDetails(StatusCodes.Status401Unauthorized) { ... });
setup.Map<RFFM.Api.Domain.ForbiddenAccessException>(exception => new StatusCodeProblemDetails(StatusCodes.Status403Forbidden) { ... });
```

The frontend treats any 401 globally as an expired session (`rffm.auth_expired` event, redirect to login) — so this ID mismatch fully explains the reported symptom for Player/Familiar users on their **own** convocations, not just cross-player attempts.

The correct field to compare against is already on `Convocation` itself: `TeamPlayerId` (`Domain/Aggregates/Assistances/Convocation.cs`, `public string TeamPlayerId { get; private set; }`), set from `convocationModel.TeamPlayerId`. This is the same `TeamPlayer.Id` space `UserProfile.PlayerId` stores, so `conv.TeamPlayerId == profile.PlayerId` is the correct comparison and needs no `.Include(c => c.Player)` join for this check.

## Goals / Non-Goals

**Goals:**
- Fix the ID-space mismatch so Player/FamilyMember users can accept/reject their own convocation (200, not 401).
- Return `403 Forbidden` (never 401) for an authenticated user attempting to manage another player's convocation, or a Player/FamilyMember user with no valid player association.
- Determine "is this caller Player/FamilyMember" from the authenticated JWT roles (`ICurrentUserService.Roles`), not the self-reported `UserProfile.RoleName`, for consistency with the multi-role authorization pattern introduced in commit `f6160bc` (`FeaturePermissionBehavior` now checks `ICurrentUserService.Roles`, not a single `.Role`).
- Preserve unrestricted Coach/Administrator behavior exactly as today.
- Remove the dead `"FamilyPlayer"` role string (route attribute + handler condition) since it does not exist in `AppRoles` and is confusing dead code.

**Non-Goals:**
- No change to how a Coach's own authorization to a *team*/*event* is scoped (Coach can already touch any convocation; restricting Coach to "their own team's events" is out of scope for this fix).
- No change to `UserProfile`/onboarding flow (`VerifyPlayerIdentity.cs`) itself — it already stores the right value (`TeamPlayer.Id`); only the *consumer* comparison in `UpdateConvocationStatus` was wrong.
- No frontend changes. The frontend's "401 → logout" behavior is correct in general; this fix ensures the backend stops emitting spurious 401s for this endpoint.
- No new `IRequireFeaturePermission`/`FeaturePermissionBehavior` integration — this endpoint's authorization is player-instance-scoped (per-convocation ownership), which is a different shape than the route-level `FeaturePermissions` table used for coach dashboard features; wiring it in is unnecessary scope creep for a bug fix.

## Decisions

1. **Compare `conv.TeamPlayerId` to `profile.PlayerId`, drop the `conv.Player.PlayerId` comparison.** This is the minimal fix that addresses the root cause directly, using a field already present on `Convocation` without introducing a new association concept. Alternative considered: change `UserProfile.PlayerId` to store the master `Player.Id` instead and update `VerifyPlayerIdentity.cs` — rejected because it touches more call sites and DB rows already saved with the current (TeamPlayer.Id) semantics, unnecessarily widening the blast radius of a targeted bug fix.

2. **Throw `ForbiddenAccessException` instead of `UnauthorizedAccessException` for ownership violations.** This aligns with the existing exception-to-status-code mapping (`ForbiddenAccessException → 403`) and the pattern already used in `Features/Coaches/Settings/ConfigurationCoach.cs` (`if (entity.CoachId != userId) throw new ForbiddenAccessException(...)`). Keep `UnauthorizedAccessException` only for the true "not authenticated" case (`_currentUser.UserId` is null), which stays a 401 as intended.

3. **Default to forbidden when no ownership can be established.** Today, `if (profile is not null)` skips the check entirely when there's no `UserProfile` row — meaning a Player/FamilyMember-role JWT holder with no profile bypasses ownership entirely. Flip the logic: for a caller whose roles include `Player` or `FamilyMember` (and not `Coach`/`Administrator`), require a match; missing profile or missing/mismatched `PlayerId` → `ForbiddenAccessException`. Coach/Administrator keep the existing unrestricted path.

4. **Use `ICurrentUserService.Roles` for the role check, not `UserProfile.RoleName`.** `ICurrentUserService.Roles` already exists (added in commit `f6160bc`, backed by the JWT `"roles"` claim array, `RoleClaimType = "roles"` in `Startup.cs`) and reflects the actual authenticated identity, not a self-declared onboarding field a user could theoretically have stale/mismatched. This makes the ownership gate resilient even if `UserProfile.RoleName` drifts from the real Identity roles.

5. **Remove `"FamilyPlayer"` from the `[Authorize(Roles=...)]` list and the handler's role-name comparison.** It doesn't exist in `AppRoles`, so it's inert dead code; removing it doesn't change behavior for existing users (no user actually has that role name) and prevents future confusion.

## Risks / Trade-offs

- **[Risk] Behavior change for any Player/FamilyMember user currently silently succeeding on convocations that weren't theirs due to Gap 3 (no profile → check skipped).** No such caller could exist today for the *success* path, because the current (buggy) comparison makes the check fail 100% of the time whenever `profile is not null` and role matches — i.e., today no Player/FamilyMember has ever successfully passed this branch in production. The only realistic prior "successes" were Player/FamilyMember-role JWT holders with `profile == null`, silently passing through unrestricted (the actual security hole). Closing that gap is intended and correct, not a regression.
- **[Risk] A Player/FamilyMember whose `UserProfile.PlayerId` was saved before this fix already stores the correct `TeamPlayer.Id`** (per `VerifyPlayerIdentity.cs`, unchanged) → **Mitigation**: no data migration needed; existing `UserProfile` rows work correctly once the comparison field changes.
- **[Trade-off] Ownership check still relies on a single `UserProfile` row per user (`ApplicationUserId` unique index assumption)** — if a FamilyMember is later modeled as linked to multiple children/players, this single-`PlayerId` model won't support it. Out of scope for this fix; flagged as a known limitation of the existing `UserProfile` design, not introduced by this change.

## Migration Plan

- Single backend deploy; no DB migration. No default toggle needed — deploy fixes the endpoint in place.
- Rollback: revert the single-file change if unexpected regressions appear; no schema/data changes to unwind.

## Open Questions

None — investigation confirmed the root cause and fix directly in code; no ambiguity remains for the fix scope described above.
