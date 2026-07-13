## Why

`CreateSeason` already requires an explicit `clubId` in its request body and fails without one, but the Coach "Crear temporada" form (`SeasonEditorForm`/`SeasonManager`) never collects a club — it silently depends on a `clubId` prop threaded in from a sibling "Mis clubes" tab (`Settings.tsx` → `preferredClubId`). A coach who lands on the Seasons tab first, or who has no club yet, sees a bare error text ("Selecciona un club para cargar las temporadas") with no way to act, and cannot create a season at all until they discover the unrelated Clubs tab. The backend now also allows Coach-role club creation (`POST /api/catalog/club`, capped at 3 clubs per creator, `code: "club_quota_exceeded"` on breach) — the frontend has no consumer of this yet for the season-creation entry point.

## What Changes

- Add a mandatory club selector to the season creation form (`SeasonEditorForm`), populated via `GET /api/catalog/user-clubs`, replacing the current silent dependency on an externally-supplied `clubId`.
- When the coach has zero clubs, or explicitly chooses "Crear club nuevo" from the selector, show an inline club-creation sub-form (Name, CountryCode, optional Emblem) in the same screen — no navigation away — that calls `POST /api/catalog/club` and auto-selects the newly created club for the season.
- Disable "Crear temporada" until a club is selected; keep season editing (existing seasons already have a club) unaffected.
- Map backend 400 error codes to Spanish via the existing `react-i18next` `errors` namespace (`Front/src/shared/i18n`, `mapApiErrorToMessage`) instead of showing raw `detail` strings: add the missing `club_quota_exceeded` key (the `ValidationFailed` key already exists) and route both the club-creation and season-creation error paths through `mapApiErrorToMessage`.

## Capabilities

### New Capabilities
(none — extends the existing Coach `seasons` UI capability)

### Modified Capabilities
- `coach-seasons-ui` (informal, no existing spec file): season creation form now owns club selection end-to-end, including inline club creation, instead of relying on a pre-selected `clubId` from another screen.

## Impact

- `Front/src/apps/coach/pages/settings/components/Seasons/SeasonEditorForm/SeasonEditorForm.tsx` (+ `.module.css`) — add club Select + inline create sub-form.
- `Front/src/apps/coach/pages/settings/components/Seasons/SeasonManager/SeasonManager.tsx` — own club list loading/selection state, remove hard block on missing external `clubId`, route errors through `mapApiErrorToMessage`.
- `Front/src/apps/coach/services/clubService.ts` — no signature changes, reused as-is (`getUserClubs`, `createClubMultipart`).
- `Front/src/shared/i18n/locales/{es,en}/errors.json` — add `club_quota_exceeded`.
- New/updated Vitest + Testing Library tests under `Seasons/**/__tests__/`.
- No backend changes (already shipped per `coach-club-quota-permission`).
