## 1. Backend — domain

- [x] 1.1 Edit `Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/Assistances/ValidationAssistancesConstants.cs` — add `public const int MaxLocationMapUrlLength = 2048;`.
- [x] 1.2 Edit `Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/Assistances/SportEvent.cs` — add `LocationMapUrl` property, `SetLocationMapUrl(string?)` per design.md §1, extend `CreateNew(...)` with a trailing optional `string? locationMapUrl = null` parameter.
- Verify: `dotnet build` from `Back/ExtractionApi`.

## 2. Backend — persistence

- [x] 2.1 Edit `Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/Configuration/Aggregates/Assistances/SportEventEntityConfiguration.cs` — add `builder.Property(se => se.LocationMapUrl).IsRequired(false).HasMaxLength(ValidationAssistancesConstants.MaxLocationMapUrlLength);`.
- [x] 2.2 Run `cd Back/ExtractionApi && .\manage-migrations.ps1` (Context `AppDbContext`) to create the migration adding the new nullable column; inspect the generated `Up()`/`Down()` are purely additive.
- Verify: `dotnet build`; review migration.

## 3. Backend — tests first (Red)

- [x] 3.1 New/extended `SportEventTests.cs` (domain tests, nearest sibling location per `testing.md`): `SetLocationMapUrl` accepts a valid `https://...` URL; rejects a non-URL string; rejects a URL longer than `MaxLocationMapUrlLength`; accepts `null`/empty (clears the field).
- [x] 3.2 New/extended validator tests for `CreateSportEventValidator`/`UpdateSportEventValidator`: valid `locationMapUrl` passes; malformed string (`"not a url"`) fails with the expected message; `null`/omitted passes (field is optional).
- Verify: tests compile and **fail** (Red) before step 4 implementation.

## 4. Backend — command/query wiring (Green)

- [x] 4.1 Edit `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/SportEvents/Commands/CreateSportEvent.cs`:
  - Add `LocationMapUrl` to `CreateSportEventRequest`.
  - Add the `BeAWellFormedHttpUrl` rule to `CreateSportEventValidator` per design.md §2.
  - Pass `req.LocationMapUrl` into `SportEvent.CreateNew(...)`.
  - Copy `ev.LocationMapUrl` into generated recurrence instances alongside `ev.Location`/`ev.Description`.
  - Add `LocationMapUrl` to `SportEventSaveResponse` and populate it in the `Results.Ok(...)` call.
- [x] 4.2 Edit `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/SportEvents/Commands/UpdateSportEvent.cs` — add `LocationMapUrl` to `UpdateSportEventRequest`, set `ev.LocationMapUrl = req.LocationMapUrl;` (mirroring the existing `ev.Location = req.Location;` line), add the same validator rule, add `LocationMapUrl` to the `SportEventSaveResponse` construction.
- [x] 4.3 Edit `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/SportEvents/Queries/GetSportEvents.cs` — add `LocationMapUrl` to the response DTO and the projection (`Location = sportEvent.Location,` sibling line).
- [x] 4.4 Edit `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/SportEvents/Queries/GetSportEventItem.cs` — same as 4.3 for the item DTO/projection.
- Verify: `dotnet build`; re-run tests from step 3 — now **green**.

## 5. Backend — wrap-up

- [x] 5.1 `dotnet test` from `Back/ExtractionApi` — 100% pass, no skipped tests.
- [x] 5.2 Manually exercise `POST`/`PUT /api/sport-events` and `GET /api/sport-events/{teamId}` via the running API to confirm `locationMapUrl` round-trips correctly.

## 6. Frontend — contract

- [x] 6.1 Edit `Front/src/apps/coach/services/sportEventService.ts` — add `locationMapUrl?: string | null;` to `SportEventResponse` and `SportEventPayload`.

## 7. Frontend — tests first (Red)

- [x] 7.1 Extend `Front/src/apps/coach/pages/attendance/components/__tests__/SportEventDialog.test.tsx` — renders a "Enlace de Google Maps" field; typing an invalid URL and saving shows a validation error and does not call `createSportEvent`/`updateSportEvent`; typing a valid URL includes `locationMapUrl` in the submitted payload; editing an existing event with `locationMapUrl` pre-fills the field.
- [x] 7.2 Extend `Front/src/apps/coach/pages/attendance/__tests__/EventCard.compact.test.tsx` (or a sibling test file for the non-compact card, per whichever already covers `location` rendering) — when `locationMapUrl` is present, the location renders as an `<a>` with that `href` and `target="_blank"`; when absent, renders as plain text (no anchor).
- [x] 7.3 New/extended test for `AttendanceEvent.tsx`'s location row — same link-vs-plain-text behavior as 7.2.
- Verify: `npm run test` from `Front` — new tests **fail** (Red) before step 8.

## 8. Frontend — implementation (Green)

- [x] 8.1 Edit `Front/src/apps/coach/pages/attendance/components/SportEventDialog.tsx` per design.md §4: `locationMapUrl` state, populate/reset in the existing effects, new `TextField`, client-side URL validation in `handleSave`, include `locationMapUrl` in the `SportEventPayload`.
- [x] 8.2 Edit `Front/src/apps/coach/pages/attendance/EventCard.tsx` (around line 394) per design.md §5 — conditional `<a>` wrapping with `stopPropagation` on click.
- [x] 8.3 Edit `Front/src/apps/coach/pages/attendance/AttendanceEvent.tsx` (around line 301) per design.md §5 — conditional `<a>` wrapping, no `stopPropagation` needed.
- [x] 8.4 If the anchor's default color is illegible against the Coach dark theme, add a minimal `.location a { color: inherit; text-decoration: underline; }` rule to the relevant CSS Module (verify visually first — do not add speculatively).
- Verify: `npm run test` — tests from step 7 now **green**.

## 9. Frontend — wrap-up

- [x] 9.1 `npm run build` from `Front` — clean.
- [x] 9.2 `npm run test` — 100% pass, no skipped tests, coverage of modified code ≥75%.
- [x] 9.3 Manually verify in the running dev app: create an event with a location + map link, confirm the link opens Google Maps in a new tab from both the attendance list card and the event detail view; edit an existing event to add/remove the link; confirm an event with only a description (no link) still renders as plain text.

## 10. Close-out

- [x] 10.1 Confirm with the user before any `git commit`/`git push` per `.claude/rules/git.md` §6.3.
- [x] 10.2 Move this change to `openspec/changes/archive/YYYY-MM-DD-add-sport-event-location-map-link/` once merged, adding a `specs/sport-event-location-map-link/spec.md` capturing the final scenario per repo convention.
