## Why

`Mobile/src/screens/EventDetailScreen.tsx` shows every convocated player's attendance in three groups (Pendientes/Asisten/No asisten) with "Voy"/"No voy" buttons on each card, but there is no way to move a player *back* to "Pendiente" once they've confirmed Going or NotGoing. A coach/admin correcting a mistaken confirmation, or a player/family member who confirmed too early and needs to undo it, currently has no button for that — they'd have to contact support or live with a wrong status. The backend already has zero gaps here: `ConfirmAttendance.cs`'s `Status` validator accepts any `AttendanceStatus.List()` member, which includes `Pending` (id 0), and the existing privileged-role bypass (Coach/Administrator may confirm any player; Player/FamilyMember only their own linked player) applies identically regardless of target status. No backend change is needed.

## What Changes

- **Mobile only**: add a third button, "Pendiente" (`t('attendance.pending')`, already defined in both `es.ts`/`en.ts`), to every player card in `EventDetailScreen.tsx`, alongside the existing "Voy"/"No voy" buttons. Tapping it calls the same `handleConfirmAttendance(teamPlayerId, 'Pending')` path already used for the other two statuses — no new endpoint, no new permission logic.
- Same visibility rule as the existing buttons: shown only when `canEdit` (own player for Player/FamilyMember, any player for Coach/Administrator).

## Capabilities

### Modified Capabilities
- `mobile-attendance-roster`: player cards gain a third status-change action (→ Pending) in addition to the existing Going/NotGoing actions, with identical edit-rights gating.

### New Capabilities
(none)

## Impact

- **Mobile**: `Mobile/src/screens/EventDetailScreen.tsx` (add button) and its test file `EventDetailScreen.test.tsx` (new test cases). No new dependencies.
- **Backend**: no changes — `ConfirmAttendance.cs` already accepts `Status: "Pending"`.
- **Front (web)**: not touched.
