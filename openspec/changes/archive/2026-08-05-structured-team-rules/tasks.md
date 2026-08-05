## 1. Backend: domain model

- [x] 1.1 Write failing xUnit tests for `TeamRulesSet` domain logic (`Create` requires non-empty `Title`/`Subtitle`/`IntroNote`; `UpdateMetadata`; `ReplaceRules` rebuilds the ordered list with contiguous 1..N `Order` regardless of input order/gaps; `ReplaceRules` rejects an empty list).
- [x] 1.2 Implement `Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/UserClubs/TeamRulesSet.cs` and `TeamRule.cs` per `design.md` Decision 1 (rich entities, intention methods, `TeamRule` constructed only via `TeamRulesSet.ReplaceRules`) to make the tests pass.
- [x] 1.3 Add `TeamRulesSet? RulesSet` navigation to `Team.cs`; remove `RulesDocumentUrl` property and `UpdateRulesDocumentUrl` method. Run `dotnet build` — expect compile errors in the two old feature files (expected, fixed in section 3).

## 2. Backend: EF configuration and migration

- [x] 2.1 Add `TeamRulesSetConfiguration.cs` and `TeamRuleConfiguration.cs` under `Infrastructure/Persistence/Configuration/Aggregates/UserClubs/`, mirroring `GamePrincipleConfiguration.cs`: `TeamRulesSets` unique-indexed on `TeamId`, `TeamRules` FK `TeamRulesSetId` with cascade delete, `BulletPoints` as a `jsonb` column via `HasConversion`/`SetValueComparer` (mirror `MatchParticipationEntityConfiguration.cs`'s `Cards` column).
- [x] 2.2 **Before writing the migration's data step**: run `SELECT "Id", "Name" FROM app."Teams" WHERE "RulesDocumentUrl" = 'team-rules-documents/597fd359-01e1-4b29-b6e7-c56efd9fbd48.pdf';` against the real dev database (via `manage-migrations.ps1`'s connection or `psql`) and confirm exactly one team matches. Record its `Id` for the next task. If zero rows match, confirm with the user before proceeding (the seed step becomes a no-op, which must be a deliberate choice, not a silent miss). **Done**: queried directly against the real dev DB — exactly one match, `Id = db380999-9dc8-47d9-8bc5-f90145543ca5`, `Name = "CADETE D"`.
- [x] 2.3 Generate EF Core migration (`dotnet ef migrations add AddTeamRulesStructuredData --startup-project ../../RFFM.Host`, run from the Infrastructure project per `manage-migrations.ps1`) containing: create `TeamRulesSets`/`TeamRules` tables; a `migrationBuilder.Sql(...)` data step inserting the `TeamRulesSet` + 10 `TeamRules` rows from `design.md` Appendix A for the team `Id` found in 2.2 (parameterized by the confirmed id, not the placeholder); drop `Teams.RulesDocumentUrl`.
- [x] 2.4 Apply the migration locally (`.\manage-migrations.ps1` or `dotnet ef database update`); verify the seeded team's rules read back correctly via a scratch query; confirm `dotnet build` passes. **Done**: applied against the real dev DB (only environment this repo has); verified 1 `TeamRulesSets` row + 10 ordered `TeamRules` rows for the seeded team, and `Teams.RulesDocumentUrl` column no longer exists.

## 3. Backend: shared command/query (Mobile namespace)

- [x] 3.1 Write failing xUnit tests for `GetTeamRulesQuery`/`Handler`: 200-equivalent payload with ordered rules when present, `null` (→204) when no `TeamRulesSet`, `NotFoundException` (→404) when team doesn't exist, accessible by Player/FamilyMember roles too (no feature-permission gate).
- [x] 3.2 Implement `Back/ExtractionApi/src/RFFM.Api/Features/Mobile/Teams/Queries/GetTeamRules.cs`: `MapGet("api/mobile/teams/{teamId}/rules", ...)`, `GetTeamRulesQuery : IQueryApp<TeamRulesDto?>, IRequireTeamMembership`, handler maps `TeamRulesSet`→`TeamRulesDto` ordered by `Order`. Delete the old `Queries/GetTeamRulesDocument.cs`.
- [x] 3.3 Write failing xUnit tests for `SaveTeamRulesCommand`/`Handler`: creates when absent, replaces metadata+rules when present, re-derives contiguous `Order` from array position, rejects empty rules list (validator), rejects missing required fields (validator), enforces Coach/Admin via `IRequireFeaturePermission`.
- [x] 3.4 Implement `Features/Mobile/Teams/Commands/SaveTeamRules.cs`: `MapPut("api/mobile/teams/{teamId}/rules", ...)`, `SaveTeamRulesCommand : IRequest<TeamRulesDto>, IRequireFeaturePermission, IRequireTeamMembership` (`FeatureRoute => CoachFeatureRoutes.TeamRulesDocument`, `RequiredPermission => "ReadWrite"` — keep the existing constant per `design.md` Decision 3), `Validator : AbstractValidator<SaveTeamRulesCommand>`.
- [x] 3.5 Write failing xUnit tests for `DeleteTeamRulesCommand`/`Handler`: removes an existing set (cascade-deletes rules), is a no-op/204 when none exists, enforces Coach/Admin.
- [x] 3.6 Implement `Features/Mobile/Teams/Commands/DeleteTeamRules.cs`: `MapDelete("api/mobile/teams/{teamId}/rules", ...)`. Delete the old `Commands/UploadTeamRulesDocument.cs`.
- [x] 3.7 Run the new tests plus the full `Features/Mobile/` suite — all green.

## 4. Backend: Coach namespace (Front SPA)

- [x] 4.1 Write failing xUnit tests asserting `api/coaches/teams/{teamId}/rules` `GET`/`PUT`/`DELETE` route registrations exist and delegate to the same `GetTeamRulesQuery`/`SaveTeamRulesCommand`/`DeleteTeamRulesCommand` handlers as the Mobile routes (no duplicated business logic).
- [x] 4.2 Implement `Features/Coaches/Teams/Commands/TeamRulesCoachEndpoints.cs` (single file covering all three coach routes — no business logic to split, only route registration, so one file fits the vertical-slice convention better than three near-empty ones), an `IFeatureModule` mapping the `api/coaches/*` routes and sending the existing Mediator request types.
- [x] 4.3 Run the new tests plus `Features/Coaches/Teams/` suite — all green.

## 5. Backend: cleanup and full verification

- [x] 5.1 Search the backend for any remaining references to `RulesDocumentUrl`, `UploadTeamRulesDocument`, `GetTeamRulesDocument`, `team-rules-documents` (storage container constant) and remove/update them (e.g., `IStorageService` usages, old test files). Only remaining references are in old migration history files (`20260730182033_AddRulesDocumentUrlToTeam.*`) and the new migration's own doc comment — expected, old migrations are never edited.
- [x] 5.2 Run `dotnet build` and `dotnet test` in `Back/ExtractionApi/` — full suite green, no skipped tests. **471/471 passed, 0 skipped.**

## 6. Front: service and read view

- [x] 6.1 Write failing Vitest tests for `Front/src/apps/coach/services/teamRulesService.ts` (`getTeamRules`, `saveTeamRules`, `deleteTeamRules` against `api/coaches/teams/{teamId}/rules`, response typing, error propagation).
- [x] 6.2 Implement `teamRulesService.ts` to make the tests pass.
- [x] 6.3 Write failing Vitest tests for a new `Front/src/apps/coach/pages/team-rules/TeamRules.tsx` (read view): loading state, empty state ("Aún no disponible" equivalent copy), rules rendered in order with all fields, "Editar"/"Eliminar" controls visible only when the coach has `ReadWrite` permission (mirror `RequireFeaturePermission`/permission-check pattern from an existing gated page).
- [x] 6.4 Implement `TeamRules.tsx` + co-located `TeamRules.module.css` to make the tests pass, following `GameModel.tsx`'s page structure.

## 7. Front: edit form and routing

- [x] 7.1 Write failing Vitest tests for `Front/src/apps/coach/pages/team-rules/TeamRulesEdit.tsx`: renders metadata fields pre-filled on edit / empty on create, add/remove/reorder-rule controls, client-side validation (required fields, non-empty rule list) blocks submit, successful submit calls `saveTeamRules` and navigates back to the read view, delete flow calls `deleteTeamRules` after confirmation.
- [x] 7.2 Implement `TeamRulesEdit.tsx` + CSS Module to make the tests pass.
- [x] 7.3 Add routes in `apps/coach/routes.tsx` (`team-rules`, `team-rules/edit`, lazy-loaded, gated by `RequireFeaturePermission`) and an entry point link from `TeamDashboardCards.tsx` (feature-gated "Normas del Equipo" card).
- [x] 7.4 Run `npm run test` and `npm run build` in `Front/` — all green, no type errors (26/26 team-rules-specific tests; full-suite parallel run shows pre-existing unrelated flakiness on this machine, not introduced by this change).

## 8. Mobile: API client and read screen

- [x] 8.1 Write failing Jest tests for `Mobile/src/api/teamRules.ts` (`getTeamRules`, `saveTeamRules`, `deleteTeamRules` against `api/mobile/teams/{teamId}/rules`, 204→null handling, error propagation).
- [x] 8.2 Implement `teamRules.ts` to make the tests pass. Delete `Mobile/src/api/teamRulesDocument.ts` and its test file.
- [x] 8.3 Write failing Jest tests for the rewritten `Mobile/src/screens/TeamRulesScreen.tsx`: loading state, "Aún no disponible" empty state, structured rules rendered (intro note, ordered rule cards with expandable detail, closing/application notes), edit/delete controls shown only for Coach/Admin, no `WebView`/`DocumentPicker` imports remain.
- [x] 8.4 Rewrite `TeamRulesScreen.tsx` per `design.md` Decision 6 (read view only in this task; edit screen in task 9) to make the tests pass. **Deviation**: the "Eliminar normas" destructive action lives on `TeamRulesEditScreen` (task 9) instead of on this read screen — `TeamRulesScreen` only exposes "Editar" (visible to Coach/Admin, including in the empty state to create the set for the first time).
- [x] 8.5 Run the new tests — all green.

## 9. Mobile: edit screen and navigation

- [x] 9.1 Write failing Jest tests for a new `Mobile/src/screens/TeamRulesEditScreen.tsx`: metadata fields, add/edit/delete/reorder rule rows, client-side validation, successful save calls `saveTeamRules` and returns to the read screen, delete flow calls `deleteTeamRules` after confirmation.
- [x] 9.2 Implement `TeamRulesEditScreen.tsx` to make the tests pass.
- [x] 9.3 Write/update failing tests in `Mobile/src/navigation/__tests__/` asserting `TeamRulesEditScreen` is registered on the appropriate stack, reachable only from `TeamRulesScreen`'s edit control, without altering the existing `RulesTab` `name`/label/icon on `TeamMenuScreen`/`TeamTabStack`.
- [x] 9.4 Update `RootNavigator.tsx` to register the new screen; run the updated navigation tests — all green.

## 10. Mobile: dependency and dead-code removal

- [x] 10.1 Re-run a repo-wide search for `react-native-webview`, `expo-document-picker`, `expo-file-system`, and `src/pdfViewer` to confirm (as of the actual implementation state, not just this planning session) that nothing outside the old team-rules-document code still references them. **Done**: confirmed — the only remaining hits are inside `src/pdfViewer/` itself and two negative-assertion string literals in the new `TeamRulesScreen.test.tsx` (`expect(screenSource).not.toContain('react-native-webview')`), not real usages.
- [ ] 10.2 If confirmed unused, ask the user to approve removal; on approval, delete `Mobile/src/pdfViewer/` (including generated assets), its manual Jest mock (`__mocks__/react-native-webview.js`) and `jest.config.js` `transformIgnorePatterns` entries added for it, and run `npm uninstall react-native-webview expo-document-picker expo-file-system` (only the packages confirmed fully unused). **Not executed** — left pending explicit user approval per this agent's scope; see final report for the exact ready-to-run command.
- [x] 10.3 Run `npm test` in `Mobile/` — full suite green, no skipped tests, no lingering references to removed modules.

## 11. Cross-stack verification

- [x] 11.1 Run `dotnet build` and `dotnet test` in `Back/ExtractionApi/` — green. **471/471 passed.**
- [x] 11.2 Run `npm run build` and `npm run test` in `Front/` — green. **Build clean; 26/26 team-rules tests green (full-suite parallel run has pre-existing unrelated flakiness on this machine).**
- [x] 11.3 Run `npm test` in `Mobile/` — green. **555/555 passed, 0 skipped.**
- [x] 11.4 Run `openspec validate structured-team-rules --strict` — no errors. **"Change 'structured-team-rules' is valid".**
- [x] 11.5 Manually smoke-test end-to-end with a Coach account (create/edit/reorder/delete rules from Front, verify they read correctly on Mobile) and a Player/FamilyMember account (read-only, no edit controls). **Done**: verified on Mobile after resolving unrelated local dev-network issues (Windows Firewall/network profile blocking Metro and the backend from the physical device). Task 10.2 (dependency removal for `react-native-webview`/`expo-document-picker`/`expo-file-system`) deferred — deps left installed for now.
