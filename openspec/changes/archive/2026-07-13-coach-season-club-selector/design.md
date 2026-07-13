## Context

`SeasonManager` (`Front/src/apps/coach/pages/settings/components/Seasons/SeasonManager/SeasonManager.tsx`) requires a `clubId` prop today. That prop originates from `Settings.tsx`'s `preferredClubId` state (set via the separate "Mis clubes" tab, `ClubSelector.tsx`) and flows through `SeasonOption.tsx`. When `clubId` is falsy, `SeasonManager`'s `useEffect` short-circuits, clears state, and renders only an error string — the season list, "Nueva temporada" button, and form are effectively invisible/unusable. `seasonService.createSeason(name, isActive, startDate, endDate, clubId)` already throws client-side if `clubId` is falsy and already sends `clubId` in the POST body, so the backend contract needs no change (confirmed live: `POST /api/catalog/club` now grants Coach `Write` and enforces a 3-club quota returning `code: "club_quota_exceeded"`, per the archived `coach-club-quota-permission` change).

`ClubSelector.tsx` already has a working, self-contained "create club" dialog (Name + CountryCode via `countryService.getCountries()` + optional Emblem via `FileImagePicker`, submitted through `clubService.createClubMultipart`). It is the pattern to mirror, not reuse directly — `ClubSelector` is a full club-management screen (edit preferred club, delete clubs) with different responsibilities than a compact "pick or create a club for this season" field.

The repo already has a working error-i18n pipeline (`Front/src/shared/i18n/i18n.ts`, `react-i18next`, namespace `errors`) plus `Front/src/shared/utils/errorMessages.ts` (`mapApiErrorToMessage`), used by the auth pages. It supports the ProblemDetails `code` contract (`error.response.data.code`) with a `detail`-string fallback, which is exactly the shape `club_quota_exceeded` and `ValidationFailed` already arrive in. `ValidationFailed` has a Spanish/English message; `club_quota_exceeded` does not yet exist in either locale file — it must be added. `ClubSelector.tsx` does **not** use this pipeline yet (it has its own ad-hoc `resolveErrorMessage`); left untouched in this change since it wasn't part of the ask and touching it risks unrelated regressions in an already-working screen (flagged as a follow-up under Non-Goals).

## Goals / Non-Goals

**Goals:**
- The "Crear temporada" form itself owns club selection: a mandatory `Select` populated from `GET /api/catalog/user-clubs` (`clubService.getUserClubs`), with "Crear temporada" disabled until a club is chosen.
- Zero-clubs coaches (or coaches who pick "Crear club nuevo" from the selector) get an inline club-creation sub-form in the same screen (Dialog overlay, no route change), calling `POST /api/catalog/club` (`clubService.createClubMultipart`), auto-selecting the new club on success.
- 400 errors from both club creation and season creation are shown in Spanish via `mapApiErrorToMessage`/the `errors` i18n namespace, not raw `detail` text. `club_quota_exceeded` gets a real translation; `ValidationFailed` already has one.
- Season **editing** is unaffected — an existing season already belongs to a club; no club re-selection is offered when editing.

**Non-Goals:**
- No change to `ClubSelector.tsx`, `MyTeams.tsx`, or `Settings.tsx`'s `preferredClubId` persistence flow — those keep working exactly as today; this change only removes the season form's *blocking dependency* on that flow having been used first.
- No backend changes (already shipped and verified per `coach-club-quota-permission`).
- No retrofit of `ClubSelector.tsx`'s own error handling onto the shared i18n pipeline (separate, working flow — out of scope; candidate for a future cleanup change).
- No multi-select or club switching mid-edit of an existing season.

## Decisions

**1. New component `SeasonClubField` (`Seasons/SeasonClubField/SeasonClubField.tsx` + `.module.css`), not a prop-bag on `SeasonEditorForm`.**
It owns its own club-list loading (`clubService.getUserClubs`), the "Crear club nuevo" sentinel option, the inline creation `Dialog` (mirroring `ClubSelector`'s dialog fields: Name, CountryCode via `countryService.getCountries`, optional Emblem via `FileImagePicker`), and its own submit/error state. `SeasonEditorForm` renders `<SeasonClubField value={clubId} onChange={onClubIdChange} disabled={saving} />` when `!isEditing`, keeping `SeasonEditorForm` presentational (it does not import `clubService`) while keeping the field independently testable (its own Vitest suite mocking `clubService`/`countryService`) instead of inflating `SeasonEditorForm`'s or `SeasonManager`'s test surface.
Alternative considered: extend `SeasonEditorForm` directly with club state — rejected, it would duplicate `ClubSelector`'s club-loading/creation logic inline in an already-multi-field form component and blur single-responsibility (season fields vs. club fields).

**2. `SeasonManager` keeps `clubId` as an optional *seed* prop; club state ownership moves to `SeasonEditorForm`'s local `clubId` field via `SeasonManager`'s `form`-adjacent state.**
`SeasonManager` adds an `activeClubId` state, initialized from the `clubId` prop (so `Settings.tsx`'s existing preferred-club flow still pre-fills the field for continuity) but no longer required for the UI to render. The early-return-with-error-text on missing `clubId` is removed: the season list panel instead shows a neutral empty state ("Selecciona o crea un club para ver sus temporadas.") and the "Nueva temporada" button remains available regardless. `activeClubId` drives both the season list `useEffect` (re-fetches when it changes, including right after an inline club creation) and is passed into `SeasonEditorForm` as `clubId`/`onClubIdChange`, so picking or creating a club in the create-form immediately scopes the visible season list to that club too — one source of truth, no divergent "form club" vs. "list club".
Alternative considered: two independent club ids (one for the list, one for the create form) — rejected as confusing UX (you could create a season under a club whose seasons aren't the ones currently listed) for no material benefit.

**3. Error handling: replace `SeasonManager`'s local `getErrorMessage` with `mapApiErrorToMessage` from `Front/src/shared/utils/errorMessages.ts`; `SeasonClubField` uses the same utility for its own club-creation errors.**
Both paths already receive Axios errors shaped as `{ response: { data: { code, detail } } }` — exactly what `mapApiErrorToMessage` expects. No new parsing branch needed; only a new i18n key.

**4. Add `"club_quota_exceeded"` to both locale files, alongside the existing `season_has_related_data`/`team_has_players` snake_case keys (matches backend `ErrorCodes.ClubQuotaExceeded = "club_quota_exceeded"` exactly, case-sensitive key lookup in `i18next.exists`).**
Spanish text reuses the backend's own `detail` wording for consistency: "Has alcanzado el número máximo de clubes que puedes crear (3)." English: "You've reached the maximum number of clubs you can create (3)."

**5. `SeasonEditorForm`'s save button gains one more guard: `disabled={saving || !form.name.trim() || (!isEditing && !clubId)}`.**
Keeps the existing minimal-diff style of that line; no separate "club required" validation message needed since the control is simply disabled (mirrors how the date-order check already surfaces via `setError` only on submit attempt, but club selection is a hard precondition, not a submit-time check, so disabling is more direct and prevents a wasted round trip).

## Risks / Trade-offs

- [Risk] Moving `activeClubId` ownership into `SeasonManager` while `Settings.tsx` also owns `preferredClubId` creates two sources of truth for "which club" across the Settings page → Mitigation: `activeClubId` only seeds from `preferredClubId` on mount (one-way, via the existing `clubId` prop) and never writes back to `Settings.tsx`; switching club inside the Season form does not change the coach's persisted preferred club elsewhere. Documented behavior, not a bug — Settings.tsx's preferred-club concept is a different, unrelated setting (used for MyTeams/dashboard defaults).
- [Risk] `SeasonClubField`'s inline club creation duplicates ~40 lines of dialog UI already in `ClubSelector` → Mitigation: acceptable per Non-Goals (not touching `ClubSelector`); the two components have different field sets in practice today would stay near-identical, flagged as a candidate for extracting a shared `ClubCreateDialog` in a future change if a third consumer appears (rule of three).
- [Risk] TOCTOU: two rapid submits could both pass the "clubId selected" client-side check before the 3-club quota check runs server-side on the *club-creation* dialog — not applicable to season creation itself (no quota there); acceptable, matches the backend's own documented TOCTOU trade-off for the quota check.

## Migration Plan

Frontend-only, additive UI change behind existing routes (`/coach/settings`, seasons tab). No feature flag needed — old behavior (external `clubId` required) is a strict subset of new behavior (still works via the seed prop, now also self-service). Rollback = revert the changed files; no data/schema impact.

## Open Questions

- Should `ClubSelector.tsx` migrate to `mapApiErrorToMessage` and get a "no leaving the Clubs tab" cross-link to Seasons? Out of scope here; flagged for a future consistency pass once this pattern is validated with coaches.
