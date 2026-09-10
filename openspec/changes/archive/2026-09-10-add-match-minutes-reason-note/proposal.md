## Why

A coach takes two goalkeepers to a match. One attended training and last week's
friendly; the other did not (he was on holiday). Even though both train equally this
week, the coach wants one to play more minutes than the other (e.g. 50 vs 30) and
wants to record *why* — either while planning the lineup before the match, or when
closing out the minutes actually played afterwards. Today there is nowhere to write
this down: `Convocation.ExcuseTypeId` only models a fixed-enum reason for players who
do **not** attend at all, and `MatchParticipation` has no free-text field at all. This
change adds an optional, editable, free-text field for exactly this case — a player
who does participate, but with reduced minutes by technical decision or another
reason — surfaced everywhere the coach app already shows minutes played, so the note
travels with the numbers instead of living only in the coach's memory.

## What Changes

- New nullable free-text field `MinutesReason` (max 500 chars) added to both
  `Convocation` (pre-match) and `MatchParticipation` (post-match/live), via a single
  EF Core migration touching both `Convocations` and `MatchParticipations` tables.
- New dedicated endpoint `PUT /api/events/{eventId}/convocations/{convocationId}/minutes-reason`
  (Coach/Administrator) to set/clear the pre-match reason independently of status/assistance.
- New dedicated endpoint `PUT /api/events/{eventId}/match-participation/{teamPlayerId}/reason`
  (Coach/Administrator) to set/clear the post-match reason without requiring the
  frontend to resend the full live-match `SaveMatchParticipationRequest` payload.
- `MinutesReason` added to the response DTOs of every existing listing/summary
  endpoint that already exposes minutes played or a convocation: `GetEventConvocations`,
  `GetMatchParticipation`, `GetPlayerMatchHistory`, `GetTeamMatchMinutes`.
- Coach-app visibility only — no Federation exposure, no Mobile changes.

## Capabilities

### New Capabilities
- `match-minutes-reason-note`: optional, editable, deletable free-text note explaining
  why a convocated/participating player played (or is planned to play) fewer minutes
  than other players, recordable pre-match on the `Convocation` and post-match/live on
  the `MatchParticipation`.

### Modified Capabilities
(none — no existing spec covers this)

## Impact

- Affected code: `Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/Assistances/Convocation.cs`,
  `Back/ExtractionApi/src/RFFM.Api/Domain/Entities/TeamPlayers/MatchParticipation.cs`,
  `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Convocations/` (new files +
  `GetEventConvocations.cs`, `GetMatchParticipation.cs`),
  `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Players/Queries/` (`GetPlayerMatchHistory.cs`,
  `GetTeamMatchMinutes.cs`), `Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/`
  (entity configurations + migration), `Back/ExtractionApi/tests/RFFM.Api.Tests/`.
- No frontend files touched by this change (backend contract only, per task scope).
- New nullable columns on the existing `Convocations` and `MatchParticipations` tables
  in the `app` schema (via `AppDbContext`) — no new table.
