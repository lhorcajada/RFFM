## Why

`SportEvent.Location` (`Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/Assistances/SportEvent.cs:14`) is a single free-text string. The coach's `SportEventDialog.tsx` renders it as one "Ubicación (opcional)" `TextField`, and it is shown as plain text in `EventCard.tsx:394-396` and `AttendanceEvent.tsx:301`. There is no way to attach a Google Maps link — a coach who wants players to be able to tap through to directions has to paste the whole URL into the description field, where it renders as unclickable text, or into `Location` itself, which then reads like `"Campo Municipal Norte https://maps.google.com/..."` in the UI.

This change lets the coach keep the human-readable location text (`Location`, unchanged) and additionally attach a Google Maps URL, so the app can render "📍 Campo Municipal Norte" as a clickable link that opens the map in a new tab wherever the location is already shown.

## What Changes

- Add a new nullable `LocationMapUrl` field to `SportEvent`, alongside the existing `Location` text field — no rename, no data migration, fully additive.
- Extend `POST /api/sport-events` (`CreateSportEvent.cs`) and `PUT /api/sport-events/{id}` (`UpdateSportEvent.cs`) request/response contracts with `locationMapUrl` (optional string, validated as a well-formed absolute URL when present).
- Extend `GET /api/sport-events/{teamId}` and `GET /api/sport-events/item/{id}` (`GetSportEvents.cs`, `GetSportEventItem.cs`) responses with `locationMapUrl`.
- EF Core migration adding the new nullable column on `SportEvents` (`AppDbContext`, schema `app`).
- Frontend (`Front/src/apps/coach/`): `SportEventDialog.tsx` gains an optional "Enlace de Google Maps" field next to "Ubicación"; `EventCard.tsx` and `AttendanceEvent.tsx` render the location as a clickable link (opens in a new tab, `rel="noopener noreferrer"`) when `locationMapUrl` is present, plain text otherwise.

## Out of Scope

- Restricting `locationMapUrl` to Google Maps domains specifically — any well-formed absolute URL is accepted, consistent with how the rest of the codebase validates URL-shaped fields (e.g. `NewRivalRequest.UrlPhoto` has no domain allowlist either).
- Rendering an embedded map/iframe preview — this change only adds a link.
- Mobile (`Mobile/`) — not requested; can be a follow-up once this contract exists.
- Any change to `Trainings/Sessions` locations — out of scope per user confirmation, only `SportEvents` (Coach calendar) is affected.

## Impact

- Backend: `Domain/Aggregates/Assistances/SportEvent.cs`, `Infrastructure/Persistence/Configuration/Aggregates/Assistances/SportEventEntityConfiguration.cs`, new EF migration, `Features/Coaches/SportEvents/Commands/CreateSportEvent.cs`, `Features/Coaches/SportEvents/Commands/UpdateSportEvent.cs`, `Features/Coaches/SportEvents/Queries/GetSportEvents.cs`, `Features/Coaches/SportEvents/Queries/GetSportEventItem.cs`, new/extended xUnit tests.
- Frontend: `Front/src/apps/coach/services/sportEventService.ts`, `Front/src/apps/coach/pages/attendance/components/SportEventDialog.tsx`, `Front/src/apps/coach/pages/attendance/EventCard.tsx`, `Front/src/apps/coach/pages/attendance/AttendanceEvent.tsx`, new/extended Vitest tests.
