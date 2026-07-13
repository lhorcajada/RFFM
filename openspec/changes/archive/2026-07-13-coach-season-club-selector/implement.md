# Implement: coach-season-club-selector

Self-contained script for implementing this change. Follow TDD (red → green) per file group. All paths relative to `Front/src/apps/coach/pages/settings/components/Seasons/` unless stated otherwise.

## 1. i18n (done)
- `Front/src/shared/i18n/locales/es/errors.json` / `en/errors.json`: added `club_quota_exceeded` key next to `ClubNotExist`.

## 2. New component: SeasonClubField
Create `Seasons/SeasonClubField/SeasonClubField.tsx` + `.module.css` + `__tests__/SeasonClubField.test.tsx`.

Props: `{ value: string; onChange: (clubId: string) => void; disabled?: boolean }`.

Behavior:
- On mount, load clubs via `clubService.getUserClubs()` (path `../../../../services/clubService`, default export has `getUserClubs`, `createClubMultipart`). Shape: `{ clubId, clubName, ... }[]`.
- Render MUI `FormControl` + `Select` (label "Club"), one `MenuItem` per club (`value=club.clubId`, label `club.clubName`), plus a fixed sentinel `MenuItem value="__create__"` labeled "+ Crear club nuevo".
- Selecting a real club id calls `onChange(clubId)`.
- Selecting the sentinel opens an inline MUI `Dialog` (title "Crear club") with fields: Name (`TextField`, maxLength 200, required), Country (`Select` populated from `countryService.getCountries()`, loaded lazily on dialog open), optional Emblem (`FileImagePicker` from `../../../../../../shared/components/ui/FileImagePicker/FileImagePicker`, same relative depth as `ClubSelector.tsx` uses one level up — verify actual relative path from the new folder, it is one directory deeper than `ClubSelector.tsx` so add one more `../`).
- When clubs list is empty after load, render inline hint text ("No tienes clubes todavía.") plus a button that opens the same create dialog (do not auto-open on mount).
- Dialog submit calls `clubService.createClubMultipart({ name, countryCode, roleId: MembershipRole.Coach, emblem })` (import `MembershipRole` from `../../../../types/MembershipRole`). On success: append the new club to local state (need the created club's id + name from the response, or re-fetch via `getUserClubs()` — prefer re-fetch for correctness since multipart create response shape may differ from `UserClubsResponse`), call `onChange(newClubId)`, close dialog.
- On error, call `mapApiErrorToMessage(error)` (import from `../../../../../../shared/utils/errorMessages`) and show it in an error box inside the dialog. Do not close the dialog on error.
- `disabled` prop disables the Select control (not the dialog once open).

Test file must mock `clubService` and `countryService` (`vi.mock`) and cover:
1. loading → shows club options from `getUserClubs`.
2. selecting an existing club calls `onChange` with its id.
3. empty club list shows a create affordance.
4. choosing "+ Crear club nuevo" opens the dialog.
5. successful submit calls `createClubMultipart` and then `onChange` with the new id.
6. a rejected promise shaped `{ response: { data: { code: "club_quota_exceeded", detail: "..." } } }` renders the Spanish text from `errors.json` (`"Has alcanzado el número máximo de clubes que puedes crear (3)."`).
7. a rejected promise shaped `{ response: { data: { code: "ValidationFailed" } } }` renders the Spanish `ValidationFailed` text.

Write test file first, run `npx vitest run <path>`, confirm failing (red) for the right reason (missing implementation, not a typo), then implement component and re-run to green.

## 3. SeasonEditorForm changes
Add props `clubId: string`, `onClubIdChange: (id: string) => void` to `SeasonEditorFormProps`. Import `SeasonClubField` from `../SeasonClubField/SeasonClubField`. Render `{!isEditing && <SeasonClubField value={clubId} onChange={onClubIdChange} disabled={saving} />}` inside `styles.formGrid` as a `fullWidth` block, before or after the name field. Update the save button:
```tsx
disabled={saving || !form.name.trim() || (!isEditing && !clubId)}
```
Add/extend `__tests__/SeasonEditorForm.test.tsx`:
- club field renders when `!isEditing`, not when `isEditing`.
- save button disabled while `clubId === ""` and `!isEditing`.
- save button enabled once `clubId` set and name non-empty.
TDD: write/extend test first, confirm red, implement, confirm green.

## 4. SeasonManager changes
- Add `activeClubId` state, `useState(clubId || "")`. Do NOT early-return when `!activeClubId`; instead:
  - `loadSeasons` / the season-list `useEffect` should key off `activeClubId` (rename the effect dependency), and when `activeClubId` is falsy, set `seasons = []` and show an inline (non-blocking) message in the list panel area ("Selecciona o crea un club para ver sus temporadas."), NOT replacing the whole component with only that text — the "Nueva temporada" button and, when `isFormVisible`, the form (with `SeasonClubField`) must still render.
  - `handleSave` create-branch: guard `if (!activeClubId) return;` then call `seasonService.createSeason(name, form.isActive, startDate, endDate, activeClubId)`; after success, `loadSeasons()` refetches for `activeClubId`.
  - Pass `clubId={activeClubId}` and `onClubIdChange={setActiveClubId}` into `<SeasonEditorForm ... />`.
  - Replace the local `getErrorMessage` helper usages with `mapApiErrorToMessage` from `../../../../../../shared/utils/errorMessages` (adjust relative depth — verify from `SeasonManager.tsx`'s actual location, one level shallower than `SeasonClubField`). Keep the function's call sites (`catch (caughtError) { setError(mapApiErrorToMessage(caughtError)); }`) — drop the `fallback` argument since `mapApiErrorToMessage` has its own generic fallback already localized.
  - `clubId` prop on `SeasonManagerProps` stays as-is (seed value), semantics documented as "initial/preferred club id".
Add/extend `SeasonManager` tests: renders list+button even with empty `clubId` prop; `activeClubId` seeds from prop; season list refetches when `activeClubId` changes (e.g., after selecting a different club in the form); `createSeason` called with `activeClubId`; a mocked 400 error surfaces the localized message.
TDD: write/extend test first (red), implement, green.

## 5. Full verification
- `cd Front && npm run test` (or `npx vitest run` for scoped/then full) — all green, no skips.
- `cd Front && npm run build` — must pass (strict TS).
- Sanity-check no other consumer of `SeasonManager`/`SeasonEditorForm` breaks (`SeasonOption.tsx` — no prop changes needed there, `clubId` prop keeps working as a seed).
