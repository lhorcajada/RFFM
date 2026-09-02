## Why

Every backend service that scrapes `rffm.es` needs a "temporada" (RFFM season code, e.g. `21` for
2025-2026). Today that code is either hardcoded (`CompetitionService.GetCompetitionsAsync` uses
`temporada=21`; `GetActa`/`GetPlayer` default to `21`) or missing entirely (`ClubDirectoryService`
never sends `temporada` when searching clubs or listing a club's teams — used by
`/federation/settings`'s club search). The frontend mirrors this: `Acta.tsx` and
`PlayerQuickViewDialog.tsx` hardcode `"21"`. Since RFFM already opened the 2026-2027 season
(code `22`), club/team/player/acta lookups against the old default silently return stale or empty
data, and every future season rollover requires another manual sweep of the same scattered
literals.

## What Changes

- Backend: introduce `Rffm:CurrentSeasonId` (config-driven, default `22`) as the single source of
  truth, replacing every hardcoded `21`/`"21"` default. Add an optional `temporada`/`seasonId`
  query parameter to `GET /clubs/search` and `GET /clubs/{clubCode}/teams` (currently missing it),
  and thread it through `ClubDirectoryService` and `CompetitionService.GetCompetitionsAsync`.
- Backend: new `GET /rffm/seasons` (current season + a short list of selectable seasons) and
  `PUT /rffm/season-preference` (per-user upsert, new `RffmSeasonPreference` entity in the
  `federation` schema) so the user's chosen season survives across devices/sessions.
- Frontend: new shared `RffmSeasonSelector` + a season context (loads seasons/preference once,
  saves on change), reused in both the Federation app (Settings club search, Acta,
  PlayerQuickViewDialog) and the Coach app (`ClubPlayerSearch`), replacing the hardcoded `"21"`s.

## Out of scope

- Coach's own `Season` entity (season-access, season-plan, roster) is a separate, DB-owned concept
  with its own dates — not touched or merged with the RFFM season code here.

## Capabilities

### New Capabilities
- `federation-rffm-season`: config-driven current RFFM season, selectable/persisted per user, used
  by every RFFM-scraping endpoint and both frontend apps.

## Impact

- Backend (`Back/ExtractionApi/`): `Features/Federation/Clubs/*`, `Features/Federation/Competitions/Services/CompetitionService.cs`,
  `Features/Federation/Teams/Queries/GetActa.cs`, `Features/Federation/Players/Queries/GetPlayer.cs`,
  `Features/Federation/Teams/Queries/GetTeamCallups.cs`, new `Features/Federation/Seasons/*`,
  `Domain/Entities/Federation/RffmSeasonPreference.cs`, new EF migration.
- Frontend (`Front/`): new `shared/components/ui/RffmSeasonSelector/`, `shared/context/RffmSeasonContext.tsx`,
  `shared/services/rffmSeasonService.ts`; edits to `apps/federation/pages/Settings/ClubSearchSection.tsx`,
  `apps/federation/pages/Acta/Acta.tsx`, `apps/federation/components/players/PlayerQuickViewDialog/`,
  `apps/coach/components/ClubPlayerSearch/ClubPlayerSearch.tsx`.
