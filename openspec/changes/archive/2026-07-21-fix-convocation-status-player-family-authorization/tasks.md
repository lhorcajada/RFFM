## 1. Red — write failing tests first

- [x] 1.1 Create `Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/UpdateConvocationStatusAuthorizationTests.cs` (or a Handler-level unit test file, mirroring `RatingEndpointAuthorizationTests.cs`/`InjuryEndpointAuthorizationTests.cs` conventions — xUnit + Moq, Arrange-Act-Assert).
- [x] 1.2 Test: Player whose `UserProfile.PlayerId` equals the convocation's `TeamPlayerId` calls status endpoint with "Accepted" → expect success (200 / no exception), convocation status updated. (Will currently fail with `UnauthorizedAccessException` due to the ID-space bug.)
- [x] 1.3 Test: same Player rejects (Deconvoke/Rejected status) their own convocation → expect success.
- [x] 1.4 Test: FamilyMember whose `UserProfile.PlayerId` equals the convocation's `TeamPlayerId` accepts and rejects → expect success (2 tests, mirror 1.2/1.3).
- [x] 1.5 Test: Player whose `UserProfile.PlayerId` does NOT match the convocation's `TeamPlayerId` → expect `ForbiddenAccessException` (maps to 403), not `UnauthorizedAccessException`.
- [x] 1.6 Test: FamilyMember with mismatched `PlayerId` → expect `ForbiddenAccessException`.
- [x] 1.7 Test: Player/FamilyMember role with no `UserProfile` row at all → expect `ForbiddenAccessException` (covers the closed "gap" from design.md decision 3).
- [x] 1.8 Test: Coach updates any convocation status (unrelated player) → expect success, unchanged from current behavior (regression guard).
- [x] 1.9 Test: Administrator updates any convocation status → expect success (regression guard).
- [x] 1.10 Run `dotnet test --filter UpdateConvocationStatus` from `Back/ExtractionApi` and confirm the new tests fail for the right reason (ownership tests 1.2-1.4 currently throw `UnauthorizedAccessException` instead of succeeding; 1.5-1.7 currently throw `UnauthorizedAccessException` instead of `ForbiddenAccessException`).

## 2. Green — fix the handler

- [x] 2.1 In `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Convocations/UpdateConvocationStatus.cs`, change the ownership comparison from `conv.Player.PlayerId` to `conv.TeamPlayerId` compared against `profile.PlayerId`. Drop the now-unnecessary `.Include(c => c.Player)` if nothing else in the handler needs the `TeamPlayer` navigation (verify: check whether `SetExcuseTypeId`/other logic further down uses `conv.Player`; keep the include only if still needed).
- [x] 2.2 Replace the role source: use `_currentUser.Roles` (or equivalent `ICurrentUserService` member holding the JWT `"roles"` claim array) to decide `isPlayerOrFamilyRole`, instead of `profile.RoleName`. Confirm `ICurrentUserService` already exposes `Roles` (added in commit `f6160bc`); if the interface only exposes it as `IEnumerable<string>`, adapt accordingly.
- [x] 2.3 Restructure the check so it defaults to forbidden for Player/FamilyMember roles: if `isPlayerOrFamilyRole` is true and (`profile is null` OR `string.IsNullOrWhiteSpace(profile.PlayerId)` OR `profile.PlayerId != conv.TeamPlayerId`), throw `RFFM.Api.Domain.ForbiddenAccessException` (not `UnauthorizedAccessException`) with a clear message (e.g. "No autorizado para responder esta convocatoria de otro jugador.").
- [x] 2.4 Keep `UnauthorizedAccessException` only for the true "not authenticated" branch (`_currentUser.UserId` is null) — no change there.
- [x] 2.5 Remove the dead `"FamilyPlayer"` role string from both the `[Authorize(Roles = "...")]` attribute on the route and the handler's role-name comparison list (real role is `FamilyMember`).
- [x] 2.6 Run `dotnet test --filter UpdateConvocationStatus` and confirm all tests from section 1 now pass (green).

## 3. Refactor

- [x] 3.1 Review the final handler for clarity — extract the ownership check into a small private method (e.g. `EnsurePlayerOwnsConvocationAsync` or an inline well-commented block) if it improves readability, without changing behavior.
- [x] 3.2 Double check `.Produces(StatusCodes.Status403Forbidden)` remains declared on the route (already present) and add `.Produces(StatusCodes.Status401Unauthorized)` if not already implied, to keep endpoint metadata accurate.
- [x] 3.3 Re-run the full test suite (`dotnet test` from `Back/ExtractionApi`) to confirm no regressions elsewhere (e.g. other tests referencing `UpdateConvocationStatus` or `ConfigurationCoach`'s `ForbiddenAccessException` pattern).

## 4. Verification

- [x] 4.1 Run `dotnet build` from `Back/ExtractionApi` — confirm zero errors/warnings introduced.
- [x] 4.2 Run `dotnet test` from `Back/ExtractionApi` — confirm 100% pass rate, no skipped tests.
- [x] 4.3 Manually trace through the acceptance criteria from the bug report: (a) Player accepts own convocation → 200; (b) Player rejects own convocation → 200; (c) Player/FamilyMember on another player's convocation → 403 with ProblemDetails, not 401; (d) Coach flow unchanged.
- [x] 4.4 Confirm no frontend changes were made (out of scope) and no DB migration was generated (`Back/ExtractionApi/manage-migrations.ps1` not run — none needed).
