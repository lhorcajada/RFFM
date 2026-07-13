## 1. i18n

- [x] 1.1 Add `club_quota_exceeded` key to `Front/src/shared/i18n/locales/es/errors.json` and `Front/src/shared/i18n/locales/en/errors.json`.

## 2. SeasonClubField component (TDD: red first)

- [x] 2.1 Write `Front/src/apps/coach/pages/settings/components/Seasons/SeasonClubField/__tests__/SeasonClubField.test.tsx` covering: renders loading then club options from `clubService.getUserClubs`; calls `onChange` when an existing club is selected; shows a "create club" affordance when the list is empty; opens inline creation on the "Crear club nuevo" option; submits via `clubService.createClubMultipart` and calls `onChange` with the new club id on success; shows the localized `club_quota_exceeded` message on a 400 with that code; shows the localized `ValidationFailed` message on a 400 with that code.
- [x] 2.2 Implement `SeasonClubField.tsx` + `SeasonClubField.module.css` to satisfy the tests: MUI `Select` + sentinel "create new" option, inline `Dialog` sub-form (Name, CountryCode via `countryService.getCountries`, optional Emblem via `FileImagePicker`), errors resolved via `mapApiErrorToMessage` from `Front/src/shared/utils/errorMessages.ts`.
- [x] 2.3 Run `npx vitest run` scoped to the new test file; confirm green.

## 3. SeasonEditorForm integration (TDD: red first)

- [x] 3.1 Update/extend `SeasonEditorForm`'s test coverage (new `__tests__/SeasonEditorForm.test.tsx` if none exists) to assert: `SeasonClubField` renders only when `!isEditing`; "Crear temporada" is disabled while `clubId` is empty; enabled once `clubId` and `name` are set; not required when `isEditing`.
- [x] 3.2 Add `clubId: string` and `onClubIdChange: (id: string) => void` props to `SeasonEditorForm`; render `<SeasonClubField value={clubId} onChange={onClubIdChange} disabled={saving} />` when `!isEditing`; update the save-button `disabled` expression per design.md decision 5.
- [x] 3.3 Run the scoped test file; confirm green.

## 4. SeasonManager wiring (TDD: red first)

- [x] 4.1 Extend/add `SeasonManager` tests to assert: UI renders (list + "Nueva temporada" button) even when the `clubId` prop is empty (no more blocking error-only state); `activeClubId` seeds from the `clubId` prop; season list re-fetches when `activeClubId` changes; `createSeason` is called with the currently selected club id; API errors are shown via the localized message (mock `mapApiErrorToMessage` or assert on rendered translated text).
- [x] 4.2 Add `activeClubId` state to `SeasonManager`, seeded from the `clubId` prop; remove the early-return-with-error-text on missing `clubId`, replacing the season-list empty state with a neutral message; wire `activeClubId`/setter into `SeasonEditorForm`'s new `clubId`/`onClubIdChange` props; key the season-list `useEffect` off `activeClubId`; replace the local `getErrorMessage` helper with `mapApiErrorToMessage`.
- [x] 4.3 Run the scoped test file; confirm green.

## 5. Full verification

- [x] 5.1 `cd Front && npm run test` — full suite green, no skipped tests.
- [x] 5.2 `cd Front && npm run build` — TypeScript strict build passes.
- [x] 5.3 Manually trace: `SeasonOption` → `SeasonManager` → `SeasonEditorForm` → `SeasonClubField` prop wiring compiles and matches design.md decision 2 (single `activeClubId` source of truth, `Settings.tsx`'s `preferredClubId` untouched).
