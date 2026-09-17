## Context

Coaches need to track season-bound paper/digital authorizations per player (starting with "autorización para hacer físico fuera de las instalaciones"). The backend already has the exact access-scoping precedent this feature needs:

- `TeamPlayer` (`Back/ExtractionApi/src/RFFM.Api/Domain/Entities/TeamPlayers/TeamPlayer.cs`, `AppDbContext`, schema `app`) already carries `SeasonId` **and** `TeamId` directly on the roster-membership row itself — a player gets a **new** `TeamPlayer.Id` each season (see `UpdateTeamPlayer.cs`, `TeamPlayerFamilyMember`, injury/sanction collections all hang off it). This means "team + player + season" is already a single foreign key: `TeamPlayerId`.
- `UserTeam.LinkedTeamPlayerId` (`Domain/Aggregates/UserClubs/UserTeam.cs`) is the existing "this Player/FamilyMember user owns this TeamPlayer" link, already used for self-service ownership checks in `UpdateTeamPlayer.cs` (`Features/Coaches/Players/Commands/UpdateTeamPlayer.cs:38-56`) and reused unmodified by `player-medical-history`/`player-family-members-crud`.
- `Features/Coaches/Teams/InjuryProtocol/SetTeamInjuryProtocol.cs` + `TeamInjuryProtocolAttachment` is the closest sibling for the upload half: same `IStorageService` contract (`UploadAsync(bucket, filePath, IFormFile, ct)` / `DeleteAsync` / `DownloadAsync`), same "no row yet reads as a default state, not 404" convention, same PDF-only-first pattern (we extend it to PDF+JPEG+PNG per the requirements here).
- `Features/Coaches/SeasonPrep/SeasonPrepExportPdf.cs` + `Services/Export/SeasonPrepPdfGenerator.cs` is the existing QuestPDF (`PackageReference QuestPDF 2026.5.0`, already in the `.csproj` — no new dependency needed) usage pattern: a handler builds `byte[]`, the Minimal API endpoint returns `Results.File(bytes, contentType, fileName)`.
- `Domain/ErrorCodes.cs` is a real, actively-maintained central catalog of `ProblemDetails.Extensions["code"]` values (not a per-project convention mismatch — this backend already follows the same discipline as the CVL.SmartLocks rules describe for a different codebase). New codes for this feature belong there.

## Goals / Non-Goals

**Goals:**
- A document-type catalog that can grow (new types) without a code/model change once shipped.
- Per-season reset of document status with zero extra bookkeeping, by keying off the season-scoped `TeamPlayer.Id` that already exists.
- Self-service upload for `Player`/`FamilyMember` restricted to their own linked `TeamPlayer`, exactly like `UpdateTeamPlayer.cs`.
- Coach/Administrator: team-wide visibility, upload-on-behalf, approve/reject, and a PDF delivery-status report.
- A stable, unambiguous contract (routes, request/response DTOs, error codes) the front-specialist can build against without re-reading backend code.
- Unblock the coordinated frontend change (`player-document-authorizations-frontend`) by seeding the `FeaturePermission` rows its two new pages need (Decision 10) and exposing `teamPlayerId` on `MyProfile` (Decision 11) — both flagged as backend dependencies by that change's own design doc.

**Non-Goals:**
- No frontend work (Coach app UI) — separate, coordinated change.
- No new team-membership/club-membership authorization layer for Coach beyond the existing `[Authorize(Roles = "Coach,Administrator")]` convention already used by every sibling feature (`SetTeamInjuryProtocol.cs`, etc.) — that stricter club-scoping gap (if any) is pre-existing and out of scope here.
- No admin UI/endpoint to create new `DocumentType` rows in this change — the catalog table is designed to support it, but only one type is seeded via migration; adding a management endpoint is future work (see Open Questions).
- No versioning/audit-trail of every past upload — a re-upload replaces the current file (old file deleted from storage); only the latest attempt is kept, mirroring how `TeamInjuryProtocolAttachment` deletion/replacement works today (no history table).

## Decisions

### 1. `DocumentType` is a DB-backed catalog table, not a `SmartEnum`
The requirement is explicit: new document types must be addable "sin cambiar el modelo" (without a code change). Existing catalogs like `ExcuseTypes` (`Features/Coaches/Assistances/Queries/GetExcuseTypes.cs`) are in-code static lists (`Ardalis.SmartEnum`-style), which would require a deploy per new type — the wrong shape for this requirement. `DocumentType` is instead a real entity/table in `AppDbContext` (schema `app`), seeded via EF `HasData` with exactly one row ("Autorización para realizar físico fuera de las instalaciones"). `Status`/`ReviewDecision` on `PlayerDocument`, by contrast, *are* fixed workflow states known at design time, so those stay `Ardalis.SmartEnum` per repo convention (`SmartEnum.EFCore` already referenced).

**Alternative considered**: `SmartEnum` catalog (rejected — contradicts the explicit "no model change" requirement) — reusable growth means data, not code.

### 2. `PlayerDocument` keys off `TeamPlayerId`, not `PlayerId` + `SeasonId`
Because `TeamPlayer` is already season-scoped (new row per season), `PlayerDocument` only needs `TeamPlayerId` + `DocumentTypeId` as its natural key (unique index on the pair). A season rollover naturally "resets" every document to pending because the *new* season's `TeamPlayer` row has no matching `PlayerDocument` row yet — no explicit reset job, no season-copy logic, no risk of leaking last season's approval.

**Alternative considered**: `PlayerId` + `SeasonId` + `DocumentTypeId` directly on `PlayerDocument` (rejected — duplicates information already on `TeamPlayer`, and would require an extra join back to resolve the *current* team for a player/season instead of getting it for free via `TeamPlayer.TeamId`).

### 3. "No row" reads as `Pending`; a row is created lazily on first upload
Mirrors `SetTeamInjuryProtocol.cs`'s "no protocol row yet ⇒ `200 OK` with nulls, not `404`" convention. No background job needs to pre-create `Pending` rows for every roster player when a season/document type is added — the list/report endpoints compute `Pending` for any `TeamPlayer` in scope that has no matching `PlayerDocument` row for that `DocumentTypeId`.

### 4. Status state machine and re-upload behavior
`Pending` (virtual, no row) → `Delivered` (row exists, file present) → `Approved` | `Rejected` (reviewed by Coach/Administrator).
- Upload (self or on-behalf) always sets/keeps `Status = Delivered` and clears any prior `ReviewedByUserId`/`ReviewedAt`/`ReviewNote` — including when re-uploading over an `Approved` or `Rejected` document (e.g., family fixes an illegible scan; a previously approved doc must be re-reviewed once replaced). The previous stored file is deleted from `IStorageService` before/after the new one is saved (best-effort delete, upload is not blocked by a delete failure — same posture as `SetTeamInjuryProtocol.cs`'s attachment delete).
- Review (`approve`/`reject`) is only valid when `Status == Delivered`; otherwise `409 Conflict` with `PlayerDocumentNotDelivered` (nothing to review yet, or it was already re-uploaded since the last review — caller should refresh).

### 5. Authorization mirrors `UpdateTeamPlayer.cs` exactly
`isPrivileged = Roles contains Coach or Administrator` (case-insensitive, same helper shape). Non-privileged callers must additionally satisfy `UserTeam.LinkedTeamPlayerId == {teamPlayerId}` for the specific `TeamPlayer` they're touching, else `403 Forbidden` with a new `PlayerDocumentAccessForbidden` code (parallel to `TeamPlayerEditForbidden`). Review and team-wide listing/report endpoints are Coach/Administrator-only via `[Authorize(Roles = "Coach,Administrator")]`, same as `SetTeamInjuryProtocol.cs`'s write routes.

### 6. File validation
Accepted content types: `application/pdf`, `image/jpeg`, `image/png` (per requirements — broader than the PDF-only injury-protocol attachments). Max size 10 MB, same limit as `SetTeamInjuryProtocol.cs`'s `MaxAttachmentSizeBytes`. Storage bucket: `"player-documents"`, path `{teamPlayerId}/{documentTypeId}/{guid}{extension}` — mirrors `injury-protocol-attachments/{teamId}/{guid}{ext}`.

### 7. `seasonId` is **not a parameter at all** on the two team-scoped endpoints — `teamId` already fixes the season
**Correction made 2026-09-16, superseding an earlier, incorrect version of this decision.** The original version of this design (and the user's confirmation of it) assumed `seasonId` needed to be an independent axis, defaulting to the club's active season when omitted. That assumption was wrong: `Team` itself is season-scoped in this codebase exactly like `TeamPlayer` — `Team.SeasonId` is a required field, `GetTeams.cs` filters teams by `t.ClubId == request.ClubId && t.SeasonId == activeSeason.Id` (`Features/Coaches/Teams/Queries/GetTeams.cs:83`), and `GetPlayersByTeam.cs` (`Features/Coaches/Players/Queries/GetPlayersByTeam.cs:91`) fetches a team's roster with `Where(tp => tp.TeamId == request.TeamId)` alone, **no season filter at all** — because a given `teamId` can only ever have `TeamPlayer` rows from its own single season. A new season means a *new* `Team.Id`, not the same team with a different `seasonId`.

Consequently, `GET /api/catalog/team/{teamId}/documents` and `GET /api/catalog/team/{teamId}/documents/report` take **no `seasonId` parameter at all** — only `documentTypeId`. The handler resolves the roster with `db.TeamPlayers.Where(tp => tp.TeamId == teamId)`, exactly mirroring `GetPlayersByTeam.cs`. Viewing a *different* season's delivery status means the coach picks a *different* `teamId` (last season's team), the same way every other team-scoped Coach page already works — there is no "season picker" concept to add here, and `ErrorCodes.NoActiveSeason` is never raised by this feature (it was only ever needed for the now-removed active-season-resolution step).

**Alternative considered**: keep `seasonId` as an optional, active-season-defaulting parameter (the version the user confirmed on 2026-09-16, before this correction) — rejected once `Team.SeasonId`'s actual role in the data model was found; keeping it would have been redundant with `teamId` and could only ever agree with it or produce a nonsensical/empty result if a caller passed a mismatched `seasonId` for that team's real season. This correction was made before writing `implement.md` specifically to avoid baking a redundant, confusing parameter into the shipped contract — the front-specialist's own design already didn't build a season picker (`player-document-authorizations-frontend/design.md` Risk #4: "no season `<Select>` is built in v1"), so dropping the parameter entirely is strictly simpler than what the frontend was already going to build against, not a breaking change to its plans.

### 8. PDF report generation
New `Services/Export/PlayerDocumentsReportPdfGenerator.cs` (QuestPDF), registered in DI the same way as `SeasonPrepPdfGenerator`. Endpoint takes `teamId` and `documentTypeId` (no `seasonId`, per Decision 7), builds the same "roster + Pending/Delivered/Approved/Rejected per player" rows the list endpoint returns, and renders them as a simple table/list (one page, players sorted by name) with a header (team name, document type name, the team's own season name via `Team.Season.Name`, generated-at timestamp). Returned via `Results.File(bytes, "application/pdf", fileName)`, same as `ExportSeasonPrepPdf.cs`.

### 9. Vertical slice file layout
New folder `Features/Coaches/PlayerDocuments/`:
- `PlayerDocumentTypesQueries.cs` — `GET /api/catalog/document-types`
- `GetPlayerDocuments.cs` — `GET /api/catalog/teamplayer/{teamPlayerId}/documents` (self or Coach/Administrator)
- `GetTeamPlayerDocumentsStatus.cs` — `GET /api/catalog/team/{teamId}/documents` (Coach/Administrator, team-wide by season+type)
- `UploadPlayerDocument.cs` — `POST /api/catalog/teamplayer/{teamPlayerId}/documents/{documentTypeId}` (self or on-behalf)
- `ReviewPlayerDocument.cs` — `PATCH /api/catalog/teamplayer/{teamPlayerId}/documents/{documentTypeId}/review` (Coach/Administrator)
- `ExportPlayerDocumentsReport.cs` — `GET /api/catalog/team/{teamId}/documents/report` (Coach/Administrator)

New domain folder `Domain/Entities/PlayerDocuments/`: `DocumentType.cs`, `PlayerDocument.cs`, `PlayerDocumentStatus.cs` (SmartEnum: `Pending`(only used as a DTO value, never persisted) / `Delivered` / `Approved` / `Rejected`).

New EF configs under `Infrastructure/Persistence/Configuration/Entities/`: `DocumentTypeEntityConfiguration.cs`, `PlayerDocumentEntityConfiguration.cs` (unique index on `TeamPlayerId` + `DocumentTypeId`).

### 10. `FeaturePermission` seeding for the two new Coach-app routes
**Added to backend scope by user confirmation (2026-09-16), coordinating with the frontend's `player-document-authorizations-frontend` change** (`openspec/changes/player-document-authorizations-frontend/design.md`, Decision 4), which gates its two new pages behind `RequireFeaturePermission` + `COACH_FEATURE_ROUTES` and explicitly flagged the backend rows as an external dependency it cannot create itself. `FeaturePermission` rows are **not** created via EF migration `HasData` in this codebase — they're upserted idempotently at app startup by `SeedFeaturePermissionsAsync` (`Back/ExtractionApi/src/RFFM.Host/DependencyInjection/WebApplicationExtensions.cs:376`), which checks `db.FeaturePermissions.Any(fp => fp.RoleName == roleName && fp.FeatureRoute == featureRoute)` before inserting.

Two new logical routes, matching exactly the strings the frontend already committed to in its own design (`Front/src/apps/coach/constants/featureRoutes.ts` mirrors `Domain/Entities/CoachFeatureRoutes.cs`):
```csharp
// Domain/Entities/CoachFeatureRoutes.cs — add:
public const string MyDocuments = "/coach/my-documents";       // Allowed for Player (self-service)
public const string PlayerDocuments = "/coach/player-documents"; // Blocked for Player
```
New seed entries in `SeedFeaturePermissionsAsync`'s `entries` array:
```csharp
("MyDocuments", CoachFeatureRoutes.MyDocuments, "Player", 3, false),
("MyDocuments", CoachFeatureRoutes.MyDocuments, "FamilyMember", 3, false),

("PlayerDocuments", CoachFeatureRoutes.PlayerDocuments, "Coach", 3, false),
("PlayerDocuments", CoachFeatureRoutes.PlayerDocuments, "ClubDirector", 3, false),
```
`3` = `ReadWrite` (both pages have upload/review actions, not just viewing). `Administrator` needs no row — `FeaturePermissionBehavior` already bypasses the check entirely for that role (see the existing comment at line 412 of the same file). `MyDocuments` is intentionally **not** seeded for `Coach`/`ClubDirector`/`Administrator` — it is a self-service "my own player" page, not a team-management page; those roles reach the equivalent team-wide view through `PlayerDocuments` instead. Giving `Player` and `FamilyMember` **identical** rows is required, not incidental: `FeaturePermissionsSeedParityTests.SeedPermissionsAsync_GivesFamilyMemberTheSameDashboardRoutesAsPlayer` (`Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/FeaturePermissionsSeedParityTests.cs`) asserts every `Player` route also exists for `FamilyMember` — this pattern must be followed, not just copied by accident.

This is purely additive to the seeder's `entries` array — no schema change, no new migration.

### 11. Expose the caller's own `TeamPlayerId` on `GET /api/users/me/profile`
**Added to backend scope by user confirmation (2026-09-16)**, replacing the frontend's originally-proposed workaround (`player-document-authorizations-frontend/design.md`, Decision 5: resolving "my own `teamPlayerId`" via `getMyProfile()` + a full roster scan via `getPlayersByTeam()` to find the matching `playerId`). That workaround is unnecessary: `UserProfile.PlayerId` (`Domain/Entities/UserProfile.cs`) stores the **`Player`** entity id, not the season-scoped `TeamPlayer` id, but `UserTeam.LinkedTeamPlayerId` — the same field every other self-service ownership check in this codebase already uses (`UpdateTeamPlayer.cs`) — gives the caller's `TeamPlayerId` directly for the team they're already scoped to, with no extra join through `Player`/roster matching and no ambiguity about "which team".

`GetMyProfile.cs` (`Features/Coaches/Users/Queries/GetMyProfile.cs`) changes:
```csharp
public record MyProfileResponse(string RoleName, string? PlayerId, string? TeamId, string? TeamPlayerId);
```
Handler resolves the new field with one extra lookup keyed by the same `(ApplicationUserId, TeamId)` pair the profile already carries:
```csharp
var teamPlayerId = profile.TeamId is null
    ? null
    : (await _db.Set<UserTeam>().AsNoTracking()
        .FirstOrDefaultAsync(ut => ut.ApplicationUserId == request.UserId && ut.TeamId == profile.TeamId, cancellationToken))
        ?.LinkedTeamPlayerId;
```
`TeamPlayerId` is `null` for roles with no player link (Coach, ClubDirector, Fan, ClubMember, or a Player/FamilyMember who hasn't completed the link-code flow yet) — additive, non-breaking field; existing consumers of `MyProfileResponse` are unaffected.

## API Contract (for the front-specialist)

All routes require authentication (`RequireAuthorization()`); role restrictions noted per route. All errors are `ProblemDetails` with `extensions.code` from `Domain/ErrorCodes.cs`.

**New error codes** (added to `ErrorCodes.cs`):
| Code | Meaning | HTTP |
|---|---|---|
| `DocumentTypeNotFound` | `documentTypeId` doesn't exist | 404 |
| `TeamPlayerNotFound` | *(reused, already exists)* `teamPlayerId` doesn't exist | 404 |
| `PlayerDocumentAccessForbidden` | Player/FamilyMember targeting a `TeamPlayer` not their own | 403 |
| `PlayerDocumentInvalidFile` | Missing file, empty file, or unsupported content type | 400 |
| `PlayerDocumentFileTooLarge` | File exceeds 10 MB | 400 |
| `PlayerDocumentNotFound` | Reviewing a document that has no `Delivered`/any row yet | 404 |
| `PlayerDocumentNotDelivered` | Reviewing a document not currently in `Delivered` status | 409 |

---

**`GET /api/catalog/document-types`** — any authenticated role.
Response `200`: `DocumentTypeResponse[]`
```
DocumentTypeResponse { id: string, name: string, description: string | null, isActive: boolean }
```

---

**`GET /api/catalog/teamplayer/{teamPlayerId}/documents`** — Coach/Administrator (any player) or Player/FamilyMember (only own `teamPlayerId`, else `403 PlayerDocumentAccessForbidden`).
Response `200`: `PlayerDocumentResponse[]` (one entry per active `DocumentType`, `Pending` synthesized if no row exists)
```
PlayerDocumentResponse {
  documentTypeId: string, documentTypeName: string,
  teamPlayerId: string,
  status: "Pending" | "Delivered" | "Approved" | "Rejected",
  fileName: string | null, url: string | null, contentType: string | null,
  uploadedAt: string | null,        // ISO 8601 UTC
  uploadedOnBehalf: boolean | null, // true if a Coach uploaded it for the player
  reviewedAt: string | null, reviewNote: string | null
}
```

---

**`GET /api/catalog/team/{teamId}/documents?documentTypeId={documentTypeId}`** — Coach/Administrator only.
404 `TeamAccessDenied`-style not introduced here; `teamId` not found → plain `404`. `documentTypeId` is required. There is **no `seasonId` parameter** — `teamId` already identifies a single season's team (Decision 7); to inspect a different season, call with that season's own `teamId`.
Response `200`: `TeamPlayerDocumentStatusResponse[]`, one row per `TeamPlayer` on that team:
```
TeamPlayerDocumentStatusResponse {
  teamPlayerId: string, playerId: string, playerName: string, dorsal: number | null,
  status: "Pending" | "Delivered" | "Approved" | "Rejected",
  uploadedAt: string | null, reviewedAt: string | null
}
```

---

**`POST /api/catalog/teamplayer/{teamPlayerId}/documents/{documentTypeId}`** (multipart/form-data, `file`) — Coach/Administrator (on behalf) or Player/FamilyMember (own `teamPlayerId` only).
- `400 PlayerDocumentInvalidFile` — missing/empty file or content type not in `{application/pdf, image/jpeg, image/png}`.
- `400 PlayerDocumentFileTooLarge` — over 10 MB.
- `403 PlayerDocumentAccessForbidden` — non-privileged caller targeting another player's `teamPlayerId`.
- `404 TeamPlayerNotFound` / `404 DocumentTypeNotFound`.
Response `200`: `PlayerDocumentResponse` (see above), `status = "Delivered"`.

---

**`PATCH /api/catalog/teamplayer/{teamPlayerId}/documents/{documentTypeId}/review`** — Coach/Administrator only.
Request: `ReviewPlayerDocumentRequest { approve: boolean, note: string | null }`
- `404 PlayerDocumentNotFound` — no row at all yet.
- `409 PlayerDocumentNotDelivered` — row exists but isn't currently `Delivered`.
Response `200`: `PlayerDocumentResponse`, `status = "Approved" | "Rejected"`.

---

**`GET /api/catalog/team/{teamId}/documents/report?documentTypeId={documentTypeId}`** — Coach/Administrator only.
No `seasonId` parameter, same as the list endpoint above (Decision 7); `documentTypeId` is required.
Response `200`: `application/pdf` file stream (`Results.File`), filename `Documentos_{DocumentTypeName}_{SeasonName}_{yyyyMMdd}.pdf` (`SeasonName` comes from `Team.Season.Name`, not a query param).

---

**Related existing-endpoint change — `GET /api/users/me/profile`** (Decision 11): response gains one additive field.
```
MyProfileResponse { roleName: string, playerId: string | null, teamId: string | null, teamPlayerId: string | null }
```
`teamPlayerId` is the caller's own `TeamPlayer.Id` for `teamId` (via `UserTeam.LinkedTeamPlayerId`), or `null` if the caller has no player link. The frontend should use this instead of resolving "my own player" via a roster scan.

**Related permission data — `GET /api/permissions/me`** (Decision 10): `featurePermissions` now also includes `{ featureName: "MyDocuments", featureRoute: "/coach/my-documents", permissionType: "ReadWrite" }` for `Player`/`FamilyMember`, and `{ featureName: "PlayerDocuments", featureRoute: "/coach/player-documents", permissionType: "ReadWrite" }` for `Coach`/`ClubDirector`. No new endpoint — existing `GetMyPermissions.cs` response shape is unchanged, only its seeded data grows.

## Risks / Trade-offs

- **[Risk]** Re-upload silently discarding a previous approval could surprise a coach who already approved a document. → **Mitigation**: documented explicitly in Decision 4 and surfaced to the frontend via the status transition itself (`Approved` → `Delivered` is visible); acceptable because the alternative (blocking re-upload once approved) would trap families who need to fix a bad scan.
- **[Risk]** No history/audit table means a rejected file is gone once replaced — no "show me what was rejected" trail for a dispute. → **Mitigation**: out of scope per Non-Goals; flagged as a candidate follow-up if the coach workflow needs it later.
- **[Risk]** `GET /api/catalog/team/{teamId}/documents` and the report endpoint don't verify the calling Coach actually belongs to that team's club (same gap as existing sibling features). → **Mitigation**: explicitly called out as pre-existing/out-of-scope rather than silently inherited; if the user wants it fixed, it should be its own cross-cutting change touching all sibling endpoints consistently, not special-cased here.
- **[Risk]** The `FeaturePermission` seed rows (Decision 10) are inserted by an idempotent app-startup routine, not a migration — they only take effect the next time the app starts (e.g. `dotnet run`), not immediately on `dotnet ef database update`. → **Mitigation**: task 9 below includes starting the app locally and confirming via `GET /api/permissions/me` before declaring that part done; note this for whoever deploys, so the deploy step includes an app restart, not just a migration run.

## Migration Plan

1. Add `DocumentType`, `PlayerDocument`, `PlayerDocumentStatus` domain entities + EF configs.
2. Add `DbSet<DocumentType>` / `DbSet<PlayerDocument>` to `AppDbContext`.
3. `dotnet ef migrations add AddPlayerDocumentAuthorizations --startup-project ../RFFM.Host` (per `manage-migrations.ps1` convention), including `HasData` seed for the one initial `DocumentType`.
4. No data backfill needed — `PlayerDocument` starts empty; every existing `TeamPlayer` reads as `Pending` for the seeded type on first `GET`.
5. Add the two `CoachFeatureRoutes` constants and four `FeaturePermission` seed entries (Decision 10) — takes effect on next app start, no migration involved.
6. Add `TeamPlayerId` to `MyProfileResponse` (Decision 11) — no migration involved, pure query/DTO change.
7. Rollback: standard EF migration `Down()` for the two new tables; the `FeaturePermission`/`MyProfile` additions roll back by reverting the code (the seeder is idempotent and additive, so stale rows left behind by a rolled-back deploy are harmless dead data, not a correctness issue).

## Open Questions

All four were resolved by the user on 2026-09-16, each following this design's recommended default:

1. ~~Should `seasonId` default to the active season?~~ **Superseded, not just resolved**: the user's original confirmation ("optional, default to active season") turned out to be based on an incorrect assumption. Once corrected (Decision 7), the real answer is that `seasonId` isn't a parameter at all — `teamId` already fixes the season. This is a strictly simpler contract than what was confirmed, and does not require re-confirmation since it removes complexity rather than adding it (the frontend was never going to build a season picker either way — see `player-document-authorizations-frontend/design.md` Risk #4).
2. ~~Is one seeded `DocumentType` enough for v1?~~ **Resolved: yes** — only "Autorización para realizar físico fuera de las instalaciones" is seeded in this change; no second type added now.
3. ~~Is a `DocumentType` admin CRUD endpoint needed in this change?~~ **Resolved: no** — seed-only via migration for v1 (Non-Goal #3 stands as-is).
4. ~~Is the 10 MB file-size cap acceptable?~~ **Resolved: yes** — kept identical to the `injury-protocol` limit.

Two small additions were folded into backend scope on 2026-09-16, coordinated with the front-specialist's `player-document-authorizations-frontend` change (both were "open dependencies" flagged by that change's own design doc, now resolved here as Decisions 10 and 11):
5. `FeaturePermission` seeding for `/coach/my-documents` and `/coach/player-documents` — **added to scope** (Decision 10).
6. `teamPlayerId` on `GET /api/users/me/profile` — **added to scope** (Decision 11), replacing the frontend's roster-scan workaround.

No open questions remain blocking implementation.
