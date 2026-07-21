## Why

`PUT /api/events/{eventId}/convocations/{convocationId}/status` returns **401 Unauthorized** for legitimate Player/FamilyMember users accepting or rejecting their own convocation, and the frontend's global 401 handler misreads this as an expired session, redirecting to login. Root cause (confirmed by code inspection): the ownership check in `UpdateConvocationStatus.Handler` (`Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Convocations/UpdateConvocationStatus.cs`) compares `UserProfile.PlayerId` against `conv.Player.PlayerId` (the master `Player.Id`), but `UserProfile.PlayerId` is actually populated with a **`TeamPlayer.Id`** (see `VerifyPlayerIdentity.cs`, `SaveUserProfileAsync(..., teamPlayerId, ...)`). These are different ID spaces, so the check **always fails**, even for the true owner, and throws `UnauthorizedAccessException`, which the global `ProblemDetails` mapping turns into HTTP 401 (not 403). This blocks every Player/FamilyMember convocation response, not just cross-player attempts.

## What Changes

- Fix the ownership comparison in `UpdateConvocationStatus.Handler` to compare `UserProfile.PlayerId` (a `TeamPlayer.Id`) against `conv.TeamPlayerId` (already present on `Convocation`, no extra join needed) instead of the mismatched `conv.Player.PlayerId`.
- Replace `throw new UnauthorizedAccessException(...)` for ownership violations with `throw new ForbiddenAccessException(...)` so genuine cross-player attempts return **403 Forbidden**, not 401, and the frontend no longer treats it as a session expiry.
- Close the gap where a Player/FamilyMember-role user with no `UserProfile` row (or role mismatch) bypasses the ownership check entirely — default to forbidden unless ownership is proven.
- Base the "is this a Player/FamilyMember caller" decision on the authenticated JWT roles (`ICurrentUserService.Roles`, consistent with the multi-role pattern from commit f6160bc) rather than the self-reported `UserProfile.RoleName`.
- Remove the dead `"FamilyPlayer"` role reference (attribute + handler) — `AppRoles` has no such role; the real role is `FamilyMember`.
- Add xUnit tests covering: Player/FamilyMember accepts/rejects own convocation (200), Player/FamilyMember attempts another player's convocation (403), Coach/Administrator unaffected (200).

## Capabilities

### New Capabilities
- `convocation-status-authorization`: Authorization rules for who may change a convocation's status (Coach/Administrator unrestricted; Player/FamilyMember restricted to their own associated player's convocation, enforced via correct ID comparison and 403 on violation).

### Modified Capabilities
(none — no existing spec covers this endpoint)

## Impact

- `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Convocations/UpdateConvocationStatus.cs` (route + handler)
- New/updated tests under `Back/ExtractionApi` test project (e.g. `UpdateConvocationStatusAuthorizationTests.cs`)
- No frontend code changes required — the frontend's existing 401-triggers-logout behavior is correct and stays as is; only the backend status code for this scenario changes from 401 to 200 (valid) or 403 (invalid), never 401 for an authenticated user.
- No migrations required (uses existing `UserProfile`/`Convocation`/`TeamPlayer` schema).
