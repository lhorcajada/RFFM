## 1. Domain

- [x] 1.1 Create `TeamNote` entity in `Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/UserClubs/TeamNote.cs`
      (`BaseEntity`, `TeamId`, `Text`, `Order`, factory `Create(teamId, text, order)`, mutation
      `UpdateText(text)`).
- [x] 1.2 Add domain unit tests (`TeamNoteTests.cs`) for `Create` (empty teamId/text throw) and
      `UpdateText` (empty text throws, trims whitespace) — write these first (Red) before the
      entity exists, then implement (Green).

## 2. Infrastructure

- [x] 2.1 Add `TeamNoteEntityConfiguration.cs` under
      `Infrastructure/Persistence/Configuration/Aggregates/UserClubs/` (table `TeamNotes`,
      `Text` `HasMaxLength(500)`, FK to `Teams`, index on `TeamId`).
- [x] 2.2 Register `DbSet<TeamNote> TeamNotes` on `AppDbContext`.
- [x] 2.3 Generate EF Core migration `AddTeamNotes` (`20260904124902_AddTeamNotes`) targeting
      the `app` schema.

## 3. Backend feature slice — GET (list + lazy seed)

- [x] 3.1 Write failing handler tests (`GetTeamNotesHandlerTests.cs`, Postgres-backed like
      `SaveClubKitsHandlerTests`): team with zero notes seeds the two default notes; team with
      existing notes returns them unseeded and in `Order` ascending; unknown team throws
      `NotFoundException`.
- [x] 3.2 Implement `Features/Coaches/Notes/GetTeamNotes.cs` until tests pass (Green).
- [x] 3.3 Add integration/authorization test mirroring `GetEventConvocations`'s access pattern
      (`IntegrationTests/TeamNotesEndpointAuthorizationTests.cs`).

## 4. Backend feature slice — POST/PUT/DELETE (Coach-only writes)

- [x] 4.1 Write failing validator + handler tests for `CreateTeamNote`
      (`CreateTeamNoteValidatorTests.cs`, `CreateTeamNoteHandlerTests.cs`).
- [x] 4.2 Implement `Features/Coaches/Notes/CreateTeamNote.cs`
      (`.RequireAuthorization(new AuthorizeAttribute { Roles = "Coach" })`) until green.
- [x] 4.3 Write failing validator + handler tests for `UpdateTeamNote`
      (`UpdateTeamNoteValidatorTests.cs`, `UpdateTeamNoteHandlerTests.cs`).
- [x] 4.4 Implement `Features/Coaches/Notes/UpdateTeamNote.cs` until green.
- [x] 4.5 Write failing handler tests for `DeleteTeamNote` (`DeleteTeamNoteHandlerTests.cs`).
- [x] 4.6 Implement `Features/Coaches/Notes/DeleteTeamNote.cs` until green.
- [x] 4.7 Add integration/authorization tests for all three write endpoints
      (`TeamNotesEndpointAuthorizationTests.cs`).

## 5. Verification

- [x] 5.1 `dotnet build` from `Back/ExtractionApi` — zero errors.
- [x] 5.2 `dotnet test` from `Back/ExtractionApi` — 948 passed, only the 2 pre-existing
      unrelated failures (`AdnLegibleImporterFullDocumentSpotCheckTests`,
      `GameModelSeederRealDocumentTests`), no new regressions.
- [x] 5.3 Migration verified against the Postgres test container fixture used by the handler
      tests.

## 6. Frontend delivery (post-backend addendum, `front-specialist`)

- [x] 6.1 `Front/src/apps/coach/services/teamNoteService.ts` — `getTeamNotes`,
      `createTeamNote`, `updateTeamNote`, `deleteTeamNote`.
- [x] 6.2 `Front/src/apps/coach/pages/convocations/components/TeamNotesEditor.tsx` — lists team
      notes; `Coach` role gets add/edit/delete controls, other roles get a read-only list.
      Reachable via its own "Notas" button/dialog in `ConvocationMatchHeader.tsx`.
- [x] 6.3 `ConvocationDetailsDialog.tsx` fetches and renders team notes (bulleted list) instead
      of the old hardcoded warning text.
- [x] 6.4 `convocationSummary.ts` (`buildWhatsAppText`) takes a `notes` parameter and renders a
      `📌 *NOTAS*` block from them instead of the old fixed lines.
- [x] 6.5 `npm run test` (targeted + full suite) and `npm run build` green — see
      `add-club-kit-configuration/tasks.md` §6 for the shared frontend verification note.
