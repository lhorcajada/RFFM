## Why

The sanctions screen (`Sanctions.tsx`) lists every sanction row-by-row but gives the coach no
aggregate view of the team's economic situation (how much has been fined in total, how much is
still owed) and no way to track money the club actually holds after players pay their fines — a
"team fund" the coach can reason about independently of individual sanctions today, since the
user anticipates other income/expense sources joining it later. Rows also identify a sanctioned
player by name only, forcing the coach to cross-reference the squad to recognize who's who at a
glance, unlike every other player list in this app which already shows a photo.

## What Changes

- **Team fund balance (new)**: add a per-`Team` persisted running balance ("bolsa del equipo"),
  fed automatically whenever a sanction's `AmountPaid` is set or changed — see design.md Decisión 1
  for the ledger-vs-counter choice and Decisión 2 for the exact delta rule on edits (including
  `AmountPaid` decreasing). No manual adjustment endpoint yet (explicitly out of scope this
  iteration); the data model leaves room for one and for non-sanction sources later.
- **New read endpoint**: `GET /api/catalog/team/{teamId}/fund` returns the team's current
  balance (and, per the chosen ledger design, optionally the movement history) for the frontend
  summary cards.
- **Sanctions summary header (frontend, scoped for front-specialist)**: three cards in
  `Sanctions.tsx`'s header — total fined (`Σ Fine` over economic sanctions), total pending
  (`Σ PendingAmount`), and team fund balance (from the new endpoint) — each with an icon.
- **Player photo in sanctions list (frontend, scoped for front-specialist)**: add each
  sanctioned player's photo to the sanctions table rows, reusing the exact
  `PlayerResponse.urlPhoto` → `playerService.fetchPlayerPhoto()` → `<img>`/`defaultAvatar`
  pattern already used in `Squad.tsx`/`AttendanceTabs.tsx` — see design.md Decisión 4 for the
  exact reference implementation.

## Capabilities

### New Capabilities
- `team-fund`: a per-team persisted balance that is automatically credited whenever a sanction's
  `AmountPaid` is recorded or increased (and debited when reduced), exposed via a read endpoint;
  no manual-adjustment endpoint in this iteration.

### Modified Capabilities
- `player-sanctions`: setting/editing a sanction's `AmountPaid` now has a side effect on the new
  team fund balance (create and update endpoints only — no change to their request/response
  shape). The frontend sanctions list and summary header (scoped, not implemented here) consume
  both `player-sanctions` and the new `team-fund` endpoint.

## Impact

- Backend: new `TeamFundMovement` entity + EF configuration + migration (schema `app`), a new
  `Features/Coaches/Teams/Commands|Queries` (or `Players`) file group for the fund read endpoint,
  and a small addition inside `Features/Coaches/Players/Commands/SetPlayerSanction.cs`'s create
  and update handlers to record the delta. No changes to `TeamPlayerSanction` itself.
- Frontend (later, front-specialist): `Front/src/apps/coach/pages/sanctions/Sanctions.tsx`,
  `Front/src/apps/coach/services/teamplayerSanctionService.ts` (or a new `teamFundService.ts`),
  and reuse of the existing photo-resolution pattern (`playerService.fetchPlayerPhoto`,
  `assets/avatar.svg`) already used in `Squad.tsx` / `AttendanceTabs.tsx` /
  `NotConvokedList.tsx`.
- No breaking changes to existing `player-sanctions` request/response contracts.
