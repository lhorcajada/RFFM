## 1. Domain model

- [ ] 1.1 Confirm table-naming convention (snake_case vs PascalCase) by inspecting the most recent migration (e.g. `20260912190800_AddTeamInjuryProtocol`) before naming new tables/columns.
- [ ] 1.2 Create `PlayerDocumentStatus` SmartEnum (`Domain/Entities/PlayerDocuments/PlayerDocumentStatus.cs`) — `Pending` (DTO-only, never persisted), `Delivered`, `Approved`, `Rejected`.
- [ ] 1.3 Create `DocumentType` entity (`Domain/Entities/PlayerDocuments/DocumentType.cs`) with `Create`, `Rename`, `Activate`, `Deactivate`.
- [ ] 1.4 Create `PlayerDocument` entity (`Domain/Entities/PlayerDocuments/PlayerDocument.cs`) keyed by `TeamPlayerId` + `DocumentTypeId` (no separate `SeasonId` column — season comes from `TeamPlayer`), with `Upload`/`ReplaceFile` (always sets `Delivered`, clears `ReviewedAt`/`ReviewNote`) and `Approve`/`Reject` (only valid from `Delivered`).
- [ ] 1.5 Add `Domain/ErrorCodes.cs` constants: `DocumentTypeNotFound`, `PlayerDocumentAccessForbidden`, `PlayerDocumentInvalidFile`, `PlayerDocumentFileTooLarge`, `PlayerDocumentNotFound`, `PlayerDocumentNotDelivered` (reuse existing `TeamPlayerNotFound`).

## 2. Persistence

- [ ] 2.1 Add `DocumentTypeEntityConfiguration.cs` and `PlayerDocumentEntityConfiguration.cs` under `Infrastructure/Persistence/Configuration/Entities/`, including the unique index on `(TeamPlayerId, DocumentTypeId)` and FK to `TeamPlayer` (season is implicit via `TeamPlayer.SeasonId`, no direct FK to `Season` on `PlayerDocument`).
- [ ] 2.2 Add `DbSet<DocumentType> DocumentTypes` and `DbSet<PlayerDocument> PlayerDocuments` to `AppDbContext`.
- [ ] 2.3 Generate EF migration `AddPlayerDocumentAuthorizations` (`.\manage-migrations.ps1` from `Back/ExtractionApi`), including `HasData` seed for the single "Autorización para realizar físico fuera de las instalaciones" document type.
- [ ] 2.4 Verify migration applies cleanly against a local dev DB.

## 3. Storage plumbing

- [ ] 3.1 Add storage bucket constant `"player-documents"` and stored-path convention `{teamPlayerId}/{documentTypeId}/{guid}{ext}` (mirrors `injury-protocol-attachments/{teamId}/{guid}{ext}`).
- [ ] 3.2 Ensure `ReplaceFile`'s handler calls `IStorageService.DeleteAsync` on the previous `StorageUrl` before/around writing the new one (best-effort delete, upload not blocked by delete failure — same posture as `SetTeamInjuryProtocol.cs`).

## 4. Catalog feature

- [ ] 4.1 `Features/Coaches/PlayerDocuments/PlayerDocumentTypesQueries.cs` — `IFeatureModule` + `IQueryApp<List<DocumentTypeResponse>>`, `GET /api/catalog/document-types`, open to every authenticated role, returns only active types, cached (`ICacheRequest`).

## 5. Self-service + on-behalf features (shared endpoints, role-branching handlers)

- [ ] 5.1 `Features/Coaches/PlayerDocuments/GetPlayerDocuments.cs` — `GET /api/catalog/teamplayer/{teamPlayerId}/documents`, `[Authorize(Roles = "Coach,Administrator,Player,FamilyMember")]`; Player/FamilyMember callers checked against `UserTeam.LinkedTeamPlayerId` (403 `PlayerDocumentAccessForbidden` on mismatch, mirroring `UpdateTeamPlayer.cs`); synthesizes `Pending` for every active `DocumentType` with no row.
- [ ] 5.2 `Features/Coaches/PlayerDocuments/UploadPlayerDocument.cs` — `POST /api/catalog/teamplayer/{teamPlayerId}/documents/{documentTypeId}` (multipart, field `file`), same role/ownership check as 5.1, FluentValidation validator for file presence/type/size (`PlayerDocumentInvalidFile`, `PlayerDocumentFileTooLarge`), `DisableAntiforgery()`; creates or replaces via `Upload`/`ReplaceFile`; response includes `uploadedOnBehalf: true` when the caller is Coach/Administrator.
- [ ] 5.3 `Features/Coaches/PlayerDocuments/ReviewPlayerDocument.cs` — `PATCH /api/catalog/teamplayer/{teamPlayerId}/documents/{documentTypeId}/review` (body `{ approve, note }`), `[Authorize(Roles = "Coach,Administrator")]`; 404 `PlayerDocumentNotFound` if no row, 409 `PlayerDocumentNotDelivered` if status isn't `Delivered`.

## 6. Team-wide + report features

- [ ] 6.1 `Features/Coaches/PlayerDocuments/GetTeamPlayerDocumentsStatus.cs` — `GET /api/catalog/team/{teamId}/documents?documentTypeId={id}`, `[Authorize(Roles = "Coach,Administrator")]`, one row per `TeamPlayer` on that team (`Where(tp => tp.TeamId == teamId)`, exactly mirroring `GetPlayersByTeam.cs` — **no `seasonId` param**, since `Team` is itself season-scoped and `teamId` already fixes the season; see design.md Decision 7), `Pending` synthesized for players with no matching `PlayerDocument` row.
- [ ] 6.2 `Services/Export/PlayerDocumentsReportPdfGenerator.cs` — QuestPDF generator following `SeasonPrepPdfGenerator`'s pattern (team name, document type, the team's own `Season.Name`, generated-at header + player/status rows); DI-register it.
- [ ] 6.3 `Features/Coaches/PlayerDocuments/ExportPlayerDocumentsReport.cs` — `GET /api/catalog/team/{teamId}/documents/report?documentTypeId={id}` (no `seasonId`, same as 6.1), `[Authorize(Roles = "Coach,Administrator")]`, `Results.File(bytes, "application/pdf", fileName)`. Factor the shared "resolve team + roster + document statuses" query into a small internal helper reused by 6.1 and this handler, to avoid duplicating the join logic.

## 7. FeaturePermission seeding for the frontend's two new routes

- [ ] 7.1 Add `MyDocuments = "/coach/my-documents"` and `PlayerDocuments = "/coach/player-documents"` constants to `Domain/Entities/CoachFeatureRoutes.cs`.
- [ ] 7.2 Add four entries to the `entries` array in `SeedFeaturePermissionsAsync` (`Back/ExtractionApi/src/RFFM.Host/DependencyInjection/WebApplicationExtensions.cs`): `("MyDocuments", CoachFeatureRoutes.MyDocuments, "Player", 3, false)`, `("MyDocuments", CoachFeatureRoutes.MyDocuments, "FamilyMember", 3, false)`, `("PlayerDocuments", CoachFeatureRoutes.PlayerDocuments, "Coach", 3, false)`, `("PlayerDocuments", CoachFeatureRoutes.PlayerDocuments, "ClubDirector", 3, false)`. Do **not** add rows for `MyDocuments` under Coach/ClubDirector, or for `PlayerDocuments` under Player/FamilyMember.
- [ ] 7.3 Extend `FeaturePermissionsSeedParityTests.cs` (or add a sibling test) asserting: `Player` and `FamilyMember` both have a `/coach/my-documents` row; `Coach` and `ClubDirector` both have a `/coach/player-documents` row; `Player`/`FamilyMember` do NOT have a `/coach/player-documents` row.
- [ ] 7.4 Manual check: start the app (`dotnet run --project src/RFFM.Host`), call `GET /api/permissions/me` as each of the four roles above, confirm the new entries appear/don't appear as expected (seeding is startup-time, not migration-time — a plain `dotnet ef database update` will NOT apply it).

## 8. Expose TeamPlayerId on MyProfile

- [ ] 8.1 Update `MyProfileResponse` in `Features/Coaches/Users/Queries/GetMyProfile.cs` to add `string? TeamPlayerId`.
- [ ] 8.2 Update `GetMyProfileHandler.Handle` to resolve it via `db.Set<UserTeam>().AsNoTracking().FirstOrDefaultAsync(ut => ut.ApplicationUserId == request.UserId && ut.TeamId == profile.TeamId)?.LinkedTeamPlayerId`, returning `null` when `profile.TeamId` is `null` or no matching `UserTeam` row exists.
- [ ] 8.3 Unit/handler test: a `Player`/`FamilyMember` with a `LinkedTeamPlayerId` set gets it back verbatim in `teamPlayerId`; a `Coach` (no link) gets `null`; a user with a `UserProfile.TeamId` but no matching `UserTeam` row gets `null` (no exception).
- [ ] 8.4 Confirm no existing consumer of `MyProfileResponse` breaks from the additive field (`dotnet build` catches any exhaustive positional-record construction elsewhere, if any).

## 9. Verification

- [ ] 9.1 `dotnet build` from `Back/ExtractionApi` — must be clean.
- [ ] 9.2 Unit tests for `PlayerDocument` domain methods: `Upload` creates in `Delivered`; `ReplaceFile` resets `Delivered` and clears review fields regardless of prior status; `Approve`/`Reject` only valid from `Delivered`, throw/guard otherwise.
- [ ] 9.3 Handler tests (Moq) for: `Pending` synthesis (both single-player and team-wide list), on-behalf upload sets `uploadedOnBehalf: true`, self-service ownership 403, review 404/409 guards, file-validation 400s, report generation happy path.
- [ ] 9.4 `dotnet test` — full pass, no skipped tests, coverage ≥80% on new handlers/commands and ≥85% on new domain logic (`PlayerDocument`/`DocumentType`), per repo TDD targets.
- [ ] 9.5 Manual smoke test via `dotnet run --project src/RFFM.Host`: `GET /api/catalog/document-types` returns the seeded type; one self-service upload → coach approve round trip; one coach-on-behalf upload → reject → re-upload → approve round trip; one PDF report download; the two `GET /api/permissions/me` and `GET /api/users/me/profile` checks from tasks 7.4/8.3.

## 10. OpenSpec closeout

- [ ] 10.1 `openspec validate player-document-authorizations --strict` passes with no errors.
- [ ] 10.2 All Open Questions in `design.md` are resolved (confirmed by the user on 2026-09-16, including the two scope additions in tasks 7-8); no further sign-off needed before `implement.md` generation.
