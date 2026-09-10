## Why

A coach cannot currently nudge families whose confirmation for an upcoming event
(match/training/etc.) is still pending — they have to call or message each family manually
outside the app. `WhatsAppCredentialsDialog.tsx` and `ConvocationDetailsDialog.tsx`'s "Copiar
para WhatsApp" button already prove the pattern of composing a WhatsApp-ready message for the
coach (today only by copying to the clipboard — see `design.md` Context for the correction: no
`wa.me` link exists anywhere in the codebase yet). This change extends that idea one step
further: build and open an actual `wa.me` deep link per family member, so the coach doesn't even
need to paste — and the link drops the family straight into the convocation after opening.

## What Changes

- In `AttendanceTabs.tsx`'s existing "Pendientes de aceptar" group (`Front/src/apps/coach/pages
  /attendance/AttendanceTabs.tsx`) — not a new screen — the coach selects one or more players
  whose convocation status is `Pending` (individual checkboxes on `ConvocationCard` + a "select
  all pending" checkbox) and triggers a "Notificar por WhatsApp" action, opening a new
  `NotifyPendingConvocationDialog`.
- **Backend**: a new read-only endpoint returns, for a given event and a set of `teamPlayerId`s,
  each player's family members that have a registered app account (`RegistrationStatus ==
  Approved`) and a phone number — the only data the frontend needs to build one `wa.me` link per
  recipient. Players with zero eligible family members are identifiable in the response so the
  frontend can warn the coach without attempting any send for them.
- **Frontend**: builds the `wa.me` links (one per family member, opened via a user gesture per
  family member since browsers block multiple auto-opened tabs), composes the WhatsApp message
  text (event type, rival/name, date, time, location, and a deep link to
  `/coach/attendance/{eventId}?viewConvocation=1`, reusing the pattern already shipped in
  `add-news-link`), and shows a warning listing players with no eligible recipient. Full
  component/util breakdown in `design.md` §F1-F5.
- No new persistence: nothing is "sent" server-side (WhatsApp delivery happens via the browser
  opening `wa.me` links), so no message/notification entity or command is introduced. The
  frontend keeps only a transient, dialog-session-local "already opened" marker per family
  member — not a persisted send receipt.
- **Not in scope**: `returnUrl`/redirect-after-login support for `SharedLogin`/`CoachAuthContext`
  — a logged-out family member's `wa.me` click lands them on the plain login page, then the
  app's default landing page, rather than being auto-redirected back to the convocation after
  authenticating. Reasoned and confirmed out of scope in `design.md` §F0 (cross-cutting to every
  login path in the app, unrelated in blast radius to this feature) — tracked as a candidate
  follow-up change, not silently dropped.

## Capabilities

### New Capabilities
- `convocation-pending-notification-recipients`: backend read endpoint that, for an event and a
  set of players, resolves which family members are eligible WhatsApp notification recipients
  (registered account + phone), and which players have none.

### Modified Capabilities
(none — no existing spec covers convocations or family members yet)

## Impact

- Backend: new feature slice under
  `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Convocations/` (sibling to
  `GetEventConvocations.cs`), reusing `TeamPlayerFamilyMember`/`FamilyMemberAccountRequest`
  (no domain/entity changes, no migration).
- Frontend: `Front/src/apps/coach/pages/attendance/AttendanceTabs.tsx` (selection state +
  bulk-action button), `Front/src/apps/coach/pages/attendance/components/ConvocationCard.tsx`
  (new optional selection props), a new
  `Front/src/apps/coach/pages/attendance/components/NotifyPendingConvocationDialog.tsx`, a new
  `Front/src/apps/coach/pages/attendance/utils/pendingConfirmationWhatsApp.ts` (message + `wa.me`
  link builders), a new
  `Front/src/apps/coach/services/convocationNotificationService.ts`, and a small derivation added
  to `Front/src/apps/coach/pages/attendance/AttendanceEvent.tsx` to pass event summary data down.
  Full breakdown in `design.md` §F1-F5.
- No changes to `Mobile/`.
