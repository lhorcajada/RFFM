## Why

`TeamPlayerSanction` today only records a category, a free-text type/description, an optional
fine, and a manual `EndDate` used as a proxy for "lifted". The coach cannot tie a sanction to a
concrete enforcement mechanism (missing a specific match, or playing under a minute cap in a
specific match), cannot track partial payment of a fine, and nothing marks a sanction as
"served" automatically — the coach must remember to clear it by hand, including for the
automatic card-based sanctions already in production. This change extends the existing sanction
system so sportive punishments are enforceable and self-tracking, and economic punishments carry
a payment ledger.

## What Changes

- Add sportive-punishment fields to `TeamPlayerSanction`: an optional punishment type
  (`Deconvocation` | `MinutesLimit`), the `SportEvent` it applies to, and (for `MinutesLimit`) the
  minute cap. Fine (economic) and sportive punishment are independent and both optional.
- Add payment-tracking fields: `AmountPaid` (persisted); `PendingAmount` is exposed as a computed
  API field (`Fine - AmountPaid`), never persisted.
- Reuse the existing `SanctionCategory` (`Competition` / `InternalDiscipline`) as the "nature"
  distinction the user asked for — no new enum (see design.md Decisión 1). This is a distinction
  of **origin**, not of the resulting punishment: `Competition` = deportiva, originated by the
  competition regulations (cards, sanctioning-committee decisions — includes the existing
  automatic card sanctions); `InternalDiscipline` = comportamiento, originated by an internal
  club/coach decision (lateness, misconduct). Either category can carry an economic punishment,
  a sportive punishment, both, or neither — the category never depends on which punishment type
  is attached.
- Derive an explicit `status` (`Pending` | `Fulfilled`) from the existing `EndDate` field for
  every sanction (economic, sportive, or plain) instead of adding a redundant persisted column —
  no persisted-state duplication, and `AddConvocations`'s existing "block convocation while
  `EndDate == null`" check keeps working unmodified.
- **Creating (or editing the target event of) a `Deconvocation` sanction now forces the
  enforcement itself**, instead of merely recording intent: the system automatically transitions
  (or creates, if it doesn't exist yet) the player's `Convocation` for `TargetEventId` to
  `Deconvoke`, with the excuse "Sanción deportiva" — reusing the transition logic already in
  `UpdateConvocationStatus.Handler`, extracted into a shared enforcement service. The sanction is
  marked `Fulfilled` in the same operation (auto-fulfillment). To give the coach a margin to
  correct a mistake, this auto-fulfillment is **reversible while the target event is still in the
  future**: deleting, or editing away the `Deconvocation` punishment (or changing its
  `TargetEventId`) before the event happens reverts the forced convocation back to `Pending` and
  clears the sanction-set excuse. Once the target event's date has passed, the sanction is locked
  exactly like any other `Fulfilled` sanction (see design.md Decisión 4/7).
- A `MinutesLimit` sanction keeps the original (non-forcing) design: it is marked `Fulfilled` when
  the player's saved minutes for the target event are `<=` the cap, detected passively in
  `SaveMatchParticipation`. Economic-only and `InternalDiscipline` sanctions remain manually
  toggled by the coach (existing `PUT` endpoint).
- Add a new `ExcuseTypes` entry ("Sanción deportiva") so a Deconvoke convocation can record that
  the absence is an enforced sportive punishment, not a personal excuse. The frontend convocation
  listing distinguishes a sanction-forced `Deconvoke` from an ordinary one purely by this existing
  `ExcuseTypeId == 8` value — no new backend field (design.md Decisión 10).
- **Reverse coupling (new in this revision):** if a convocation that is `Deconvoke` because a
  `Deconvocation` sanction forced it is later transitioned away from `Deconvoke` through the normal
  `PUT .../convocations/{id}/status` endpoint (not through editing/deleting the sanction itself),
  the linked `Fulfilled` sanction is automatically reopened to `Pending` (design.md Decisión 11).
  This is deliberately allowed even for a past target event, since it reflects the coach correcting
  the convocation record after the fact.
- Block `DELETE` of a sanction whose derived status is `Fulfilled`.
- Expose active `MinutesLimit` sanctions for a given event so the coach's live-match screen can
  warn when a sanctioned player reaches their minute cap (frontend-computed against
  backend-provided caps — no SignalR/WebSockets in this repo; confirmed by inspecting
  `useLiveMatch.ts`/`liveMatchService.ts`, which already poll nothing and run entirely on a
  client-side timer).
- Frontend (`Front/`, executed later by front-specialist): sanction form gains nature/punishment
  fields, minutes-limit live-match banner, payment fields, and the new deconvocation excuse —
  scoped in tasks.md, not implemented here.

## Capabilities

### New Capabilities
(none — this deepens `player-sanctions`, it does not introduce an unrelated capability)

### Modified Capabilities
- `player-sanctions`: create/update/delete requests and responses gain punishment-type, target
  event, minutes-limit, payment, and derived-status fields; delete is now conditionally rejected
  (with a time-boxed exception for reversible forced deconvocations); creating/editing a
  `Deconvocation` sanction now has a side effect on `Convocation` state; a new read endpoint
  exposes active minute-limit sanctions per event.

## Impact

- Backend: `Domain/Entities/TeamPlayers/TeamPlayerSanction.cs` (including a new `Reopen()` method,
  symmetric with `MarkFulfilled(DateTime)`), a new `SanctionSportivePunishmentType` SmartEnum,
  `Infrastructure/Persistence/Configuration/Entities/TeamPlayerSanctionEntityConfiguration.cs`, a
  new EF migration (schema `app`), `Features/Coaches/Players/Commands/SetPlayerSanction.cs`,
  `Features/Coaches/Convocations/UpdateConvocationStatus.cs` (both the forced-transition delegation
  to the enforcement service, and the new reverse-coupling reopen step — design.md Decisión 11),
  `Features/Coaches/Convocations/SaveMatchParticipation.cs`,
  `Domain/Aggregates/Assistances/ExcusesType.cs`, and a new shared
  `Domain/Services/SanctionConvocationEnforcementService.cs` (forces/reverts the
  `Deconvocation`-type convocation transition, called from both `SetPlayerSanction.cs` and
  `UpdateConvocationStatus.Handler`). `AddConvocations.cs` is **not modified** — its existing
  active-automatic-sanction block is orthogonal to (and does not conflict with) the new forced
  transition; see design.md Decisión 4.
- Frontend (later, front-specialist): `Front/src/apps/coach/pages/sanctions/Sanctions.tsx`,
  `Front/src/apps/coach/services/teamplayerSanctionService.ts`,
  `Front/src/apps/coach/pages/convocations/hooks/useLiveMatch.ts`,
  `Front/src/apps/coach/services/liveMatchService.ts`, convocation excuse-type UI, and the
  convocation-listing component(s) (audit first — same one(s) already rendering `ExcuseTypeId`, per
  `GetEventConvocations.cs`'s existing `ConvocationResponse`) for the sanction-forced `Deconvoke`
  badge (design.md Decisión 10).
- No breaking changes to existing fields; all additions are optional/nullable and existing
  automatic-sanction and convocation-blocking behavior is preserved.
