# Proposal: Editar goles, goleadores y tarjetas de un partido finalizado

## Ownership
Frontend (`Front/src/apps/coach/`). No changes required in `Back/ExtractionApi/` — the
`SaveMatchParticipation` endpoint already persists `GoalsJson`/`CardsJson` verbatim as part of
the same payload used for minutes, so this is a UI-only extension.

## Rationale
Today, once a match reaches `matchPhase === "finished"`, the Coach app only exposes
"Edición manual de minutos" (`LiveMatchManualEditDialog`) to correct per-player minutes after
the fact. Goals and cards can only be added *during* the live simulation (via
`LiveMatchScoreboard`'s "Gol"/"Tarjeta" buttons, gated by `canScore`) — once the match is
finished those controls disappear, so a coach who mis-recorded a scorer, minute, or card type
(or forgot one entirely) has no way to fix it short of deleting all saved match data
(`live.deleteParticipation`) and re-running the whole live simulation.

## Scope
- Extend the post-match manual-edit dialog to also let the coach add, edit, and remove goals
  and cards for a finished match, in addition to the existing minutes editing.
- Reuse the existing data model end-to-end: `GoalEvent`/`CardEvent` types, `live.goals`/
  `live.cards` state in `useLiveMatch`, and the existing `goalsJson`/`cardsJson` fields already
  sent by `SaveMatchParticipation`.
- Extract the goal-registration dialog currently inline in `LiveMatchScoreboard` into a
  reusable `GoalEventDialog` component (mirroring the existing `CardEventDialog`), so both the
  live-match flow and the new post-match editor share one implementation.
- Add `updateGoal`/`updateCard` to `useLiveMatch`, and let `addGoal`/`addCard` accept an
  explicit minute (and half, for cards) instead of always defaulting to "now".

## Non-goals
- No backend/API changes.
- No changes to the read-only "Partido guardado" summary rendering beyond reflecting edits
  after a save.
- No support for extra time/penalties (`half` stays `1 | 2`, consistent with existing types).
