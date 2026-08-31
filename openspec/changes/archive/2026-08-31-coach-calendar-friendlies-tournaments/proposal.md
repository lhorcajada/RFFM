## Why

The team calendar consumed by the Coach app (`coach/convocations?teamId=`) already stores friendly
(`Amistoso`, `EventTypeId=4`) and tournament (`Torneo`, `EventTypeId=6`) matches as `SportEvent` rows
with a first-class `EventTypeId`, but two gaps block the frontend from surfacing them alongside
league matches: (1) `GET /api/sport-events/{teamId}` exposes `EventTypeId` as a bare int with no
stable category, forcing consumers (Mobile already does this as a documented workaround) to
substring-match the localized type name to know "is this a match-like event"; (2) the automatic
calendar generation endpoint (`POST /api/sport-events/sync-calendar`) only ever creates/updates
`EventTypeId=1` (league) events sourced from the Federation API — there is no idempotent bulk
upsert path for friendlies/tournaments, so any future bulk-entry flow for them would either have to
duplicate ad hoc logic or risk creating duplicate rows on every regeneration.

## What Changes

- Add a backend-computed `MatchCategory` field (`"League" | "Friendly" | "Tournament" | null`) to
  `GetSportEvents`' `SportEventResponse`, replacing the need for name substring-matching to classify
  an event as a match variant.
- Generalize `POST /api/sport-events/sync-calendar` to accept optional `Friendlies` and
  `Tournaments` arrays (same item shape as the existing `Matches` array) alongside the existing
  league `Matches` array, upserting each into `SportEvent` rows with `EventTypeId` 4 / 6
  respectively, using the same idempotent identity rule as league matches (match by `CodActa` when
  present, otherwise by `TeamId` + `EventTypeId` + date window) — never duplicating existing rows on
  a repeated call.
- No changes to `EventTypeId`'s existing values or to any persisted schema (the `Amistoso`/`Torneo`
  `SportEventType` rows already exist per migration `20260828112649_AddTournamentSportEventType`).

## Capabilities

### New Capabilities
- `coach-calendar-match-categories`: backend contract for classifying and idempotently
  generating/regenerating league, friendly, and tournament events on a team's calendar.

### Modified Capabilities
(none — no existing spec file covers `sport-events`/calendar sync today)

## Impact

- Backend only (`Back/ExtractionApi/`): `Features/Coaches/SportEvents/Queries/GetSportEvents.cs`,
  `Features/Coaches/SportEvents/Commands/SyncCalendarFromFederation.cs`.
- API contract change (additive/backward-compatible): new response field, new optional request
  arrays. No breaking changes for existing frontend callers.
- Frontend (`Front/`) will consume the new `MatchCategory` field and the extended sync endpoint in
  a separate, follow-up change owned by the front specialist — out of scope here.
