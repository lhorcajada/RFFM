# Proposal: Live Match Tracking Enhancements

## Rationale

The Coach app's live match tracker (`PartidoEnDirectoTab` / `useLiveMatch`) currently
supports goals (minute, scorer, dorsal) and substitution windows, but is missing several
capabilities coaches need while tracking a match in real time:

- The tactical formation is fixed once the match starts — it cannot be changed mid-match,
  and there is no record of which position a player actually occupied over time.
- Substitution windows are capped at 4 total / 3 in the second half for every match type,
  even friendlies, where real-world rules impose no such limit.
- Goals do not record where on the pitch they were scored from, nor whether they were
  scored with the head or the foot.
- Cards (amonestaciones) cannot be registered at all in the live tracker today — the
  backend has an unused `CardsJson` column, but no frontend UI, type, or save path exists.
- There is no way to record a rival player's shirt number on a card, mirroring the
  existing free-text dorsal already used for visitor-team goals.

## Scope

**In scope:**
1. Mid-match formation changes with a confirmation step, persisting a per-player position
   history (which position each player occupied, and from which minute).
2. Automatic unlimited substitution windows when the event's `SportEventType` is
   "Amistoso" (id 4); all other event types keep the current 4-total / 3-second-half limit.
3. A 5-column × 10-row pitch grid (unnamed cells) for selecting the goal's origin zone.
4. A head/foot selector on each goal.
5. Card (amonestación) registration: type (yellow/red), minute, match half (1st/2nd —
   no extra time/penalties yet), and player — own team player, or free-text dorsal for a
   rival player (no rival roster exists).
6. A free-text dorsal field for visitor-team goals is already partially wired
   (`scorerDorsal` in `GoalEvent`) — confirm/complete its exposure in the goal-registration UI.
7. Backend: extend `MatchParticipation` persistence (`GoalsJson`, `CardsJson`, and a new
   formation/position-history field) and `SaveMatchParticipationRequest` /
   `GetMatchParticipationResponse` to carry the new fields; update `GetPlayerSeasonCards`
   (`CountCards`) to keep working with the richer `CardsJson` shape.

**Out of scope:**
- Extra time / penalties as match parts (explicitly deferred by the user).
- A rival-player roster/entity (dorsal stays free-text for now).
- Changing the substitution-window limit for non-friendly event types.
- Any change to the offline "simulator" (`useMatchSimulation.ts`) beyond keeping it
  buildable — it may reuse shared types but is not a target of this change.

## Ownership

Cross-stack: `Back/ExtractionApi` (RFFM.Api — `Features/Coaches/Convocations`,
`Features/Mobile/Players/Queries/GetPlayerSeasonCards.cs`,
`Domain/Entities/TeamPlayers/MatchParticipation.cs`) and `Front`
(`src/apps/coach/pages/convocations/**`).
