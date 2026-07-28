## Context

**Current state** (`Mobile/src/screens/EventDetailScreen.tsx`, verified in code):
- Each roster row renders a `buttonGroup` with exactly two `Pressable`s when `canEdit` is true: `going-button-{teamPlayerId}` → `handleConfirmAttendance(row.teamPlayerId, 'Going')`, and `not-going-button-{teamPlayerId}` → `handleConfirmAttendance(row.teamPlayerId, 'NotGoing')`.
- `handleConfirmAttendance(rowTeamPlayerId, status)` is generic over `status` already — it POSTs `{ teamId, teamPlayerId: rowTeamPlayerId, status }` to `/api/mobile/events/{eventId}/attendance`, optimistically updates local roster state, and auto-expands the destination group (`GROUP_ORDER = ['Pending', 'Going', 'NotGoing']`). No changes needed to this function.
- `canEdit = isPrivileged || row.teamPlayerId === myTeamPlayerId` — identical rule must gate the new button.
- Backend `ConfirmAttendance.cs` (`Back/ExtractionApi/src/RFFM.Api/Features/Mobile/Attendance/Commands/ConfirmAttendance.cs`): `Validator` checks `AttendanceStatus.List().Any(a => a.Name == s)`, and `AttendanceStatus.List()` returns `Pending`, `Going`, `NotGoing`. The handler's `isOwnPlayer`/`isPrivilegedRole` check runs identically regardless of target status. **No backend file needs to change.**
- i18n: `t('attendance.pending')` already resolves to `'Pendiente'` (es) / `'Pending'` (en) in `Mobile/src/i18n/translations/{es,en}.ts` — already used for the status label text, just needs reuse as a button label.

## Goals / Non-Goals

**Goals:**
- Add a "Pendiente" button to every editable card, calling the existing `handleConfirmAttendance(teamPlayerId, 'Pending')`.
- Keep the same `canEdit` visibility rule as the other two buttons.

**Non-Goals:**
- No backend changes.
- No change to grouping/expansion behavior beyond what `handleConfirmAttendance` already does (auto-expand destination group on status change — already works for any status including `Pending`).
- No change to button behavior when a card is already in the Pending group (showing the button there too is harmless/no-op-ish and keeps the three actions consistent across all groups — simpler than conditionally hiding it).

## Decisions

1. **Reuse `handleConfirmAttendance` as-is.** It already accepts an arbitrary `status` string and POSTs it; no signature change needed.
2. **Third button placement**: extend the existing `buttonGroup` View to hold three `Pressable`s instead of two. Use `buttonSecondary` style (same neutral/outline look as "No voy") for the new "Pendiente" button to avoid implying it's a primary/destructive action — visually it should read as a neutral "undo/reset" action, distinct from the primary "Voy" (`buttonPrimary`) affordance.
3. **testID convention**: `pending-button-{teamPlayerId}`, matching the existing `going-button-{teamPlayerId}` / `not-going-button-{teamPlayerId}` pattern.
4. **Label**: reuse `t('attendance.pending')` (no new i18n key) — it already reads "Pendiente"/"Pending", appropriate as both a status label and a button caption (same word works for "mark as pending" in this UI's terse button style, consistent with "Voy"/"No voy" also being terse first-person/status-style labels rather than full imperative sentences).

## Risks / Trade-offs

- **[Trade-off] Showing "Pendiente" on cards already in the Pending group** is slightly redundant but avoids conditional-rendering complexity for a harmless no-op tap (posts the same status again, which is idempotent server-side — `UpdateStatus` on an existing confirmation, or no existing confirmation and a new one is created with `Pending`, either way ending state is correct).

## Migration Plan

- Mobile only, additive: one new button per card, no new dependencies, no data/schema changes. No migration needed.

## Open Questions

(none — resolved above)
