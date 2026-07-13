## Why

Coaches were blocked from creating clubs by commit f3e776b, which restricted the `/coach/clubs` feature route to `ClubDirector` only, leaving `Coach` without a `FeaturePermission` row (403 Forbidden). Product now wants Coach-role users to be able to create clubs again (self-service, paid quota), but capped: a Coach may create at most 3 clubs under their current plan. There is currently no quota enforcement in the domain, and the 403 makes the whole "create club" flow inaccessible to the Coach role that most needs it.

## What Changes

- Grant the `Coach` role `Write` permission on the `/coach/clubs` `FeaturePermission` route (seed-only addition, additive, non-breaking) so `CreateClub`, `UpdateClub`, `DeleteClub` become reachable again for Coach, matching the existing `RequiredPermission => "Write"` already declared on those three commands.
- Add a domain-level quota check in `CreateClubHandler`: a user who already has 3 clubs where `UserClub.IsCreator == true` cannot create a 4th. Counting is by **creator**, not total membership, because the quota tracks the paid "club creation" allowance, not clubs the user merely belongs to.
- On quota breach, `CreateClub` returns **HTTP 400** `ProblemDetails` with a stable machine-readable `code` extension (`club_quota_exceeded`), following the existing `DomainException` → `ProblemDetails` mapping convention (see `ErrorCodes.cs`, `PlayerService.cs` `ClubNotExist` pattern) so the frontend can map it to an i18n key.
- Add `ErrorCodes.ClubQuotaExceeded` constant to the shared catalog.

## Capabilities

### New Capabilities
(none — extends existing `Clubs` feature slice)

### Modified Capabilities
- `clubs`: Coach role gains Write access to club management; `CreateClub` gains a 3-club-per-creator quota rule enforced as a domain error.

## Impact

- `Back/ExtractionApi/src/RFFM.Host/DependencyInjection/WebApplicationExtensions.cs` (feature permission seed data)
- `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Clubs/Commands/CreateClub.cs` (quota check in handler)
- `Back/ExtractionApi/src/RFFM.Api/Domain/ErrorCodes.cs` (new error code constant)
- Tests under `Back/ExtractionApi/tests/RFFM.Api.Tests/` (new + updated unit tests)
- No frontend changes in this backend-scoped change; the 400 contract is documented in `design.md` for the frontend team to consume.
