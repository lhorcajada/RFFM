## 1. Domain (TDD — tests first)

- [ ] 1.1 Add failing unit tests in `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/TeamPlayerSanctionTests.cs` for the new invariants: `MinutesLimit` type requires `targetEventId` + positive `minutesLimit`; `Deconvocation` type requires `targetEventId` and rejects a non-null `minutesLimit`; `null` type requires both null; `AmountPaid` must be `>= 0`; `MarkFulfilled(DateTime)` sets `EndDate` and leaves other fields untouched; `Reopen()` sets `EndDate` back to `null` and leaves other fields untouched (design.md Decisión 11).
- [ ] 1.2 Create `SanctionSportivePunishmentType` SmartEnum (`Domain/Entities/TeamPlayers/SanctionSportivePunishmentType.cs`), mirroring `SanctionCategory`'s `TryParseName` pattern.
- [ ] 1.3 Extend `TeamPlayerSanction`: add `SportivePunishmentType`, `TargetEventId`, `MinutesLimit`, `AmountPaid`, `TargetEvent` navigation; extend `Create`/`Update` with the new optional parameters and invariant checks (design.md Decisión 2); add `MarkFulfilled(DateTime at)` and `Reopen()` (design.md Decisión 11).
- [ ] 1.4 Run `dotnet test --filter TeamPlayerSanctionTests` until green.
- [ ] 1.5 Add `ExcuseTypes.SportiveSanction` (id 8, "Sanción deportiva", `justified: true`) to `Domain/Aggregates/Assistances/ExcusesType.cs` (design.md Decisión 6). Add/extend a unit test asserting `ExcuseTypes.List()` includes it and `FromId(8)` resolves it.

## 2. Persistence

- [ ] 2.1 Extend `TeamPlayerSanctionEntityConfiguration.cs`: map `SportivePunishmentType` (nullable int via SmartEnum conversion, same pattern as `Category`), `TargetEventId` (nullable string, FK to `SportEvents`), `MinutesLimit` (nullable int), `AmountPaid` (nullable decimal, same precision as `Fine`).
- [ ] 2.2 Generate migration `AddSanctionEnforcementAndPaymentFields` via `.\manage-migrations.ps1` from `Back/ExtractionApi` (schema `app`). Verify the generated migration only adds nullable columns — no data loss, no default backfill needed.
- [ ] 2.3 Apply the migration locally and confirm `dotnet run --project src/RFFM.Host` starts cleanly.

## 3. `SetPlayerSanction.cs` — create/update/delete/read

- [ ] 3.1 Add failing functional/integration tests (new or extended `*Tests.cs` under the functional test project, following the nearest existing sanction-endpoint test file) for: create with `sportivePunishmentType`/`targetEventId`/`minutesLimit`, create with `amountPaid`, `amountPaid > fine` rejected (`400`), `sportivePunishmentType` without `targetEventId` rejected (`400`), `minutesLimit` without `MinutesLimit` type rejected (`400`), update recomputing `pendingAmount`, delete of a `Pending` sanction succeeds (`204`), delete of a `Fulfilled` sanction rejected (`409`).
- [ ] 3.2 Extend `SanctionCreateRequest`/`SanctionUpdateRequest`/`SanctionRecordResponse` records with the new fields plus computed `Status` and `PendingAmount` (design.md Decisión 3, 8).
- [ ] 3.3 Extend the `POST`/`PUT` handlers: parse/validate `sportivePunishmentType` (mirroring the existing `category` `TryParseName` + `ValidationProblem` pattern), validate `amountPaid <= fine` and `amountPaid >= 0`, pass through to `Create`/`Update`.
- [ ] 3.4 Add the `409 Conflict` guard to the `DELETE` handler, including the time-boxed reversible exception for `Deconvocation` sanctions targeting a future event (design.md Decisión 7 — full implementation and tests tracked in section 4, since it depends on the enforcement service).
- [ ] 3.5 Update `ToResponse(...)` to compute `Status` and `PendingAmount`.
- [ ] 3.6 Run the full sanction functional test suite until green.

## 4. Auto-fulfillment wiring and forced deconvocation

- [ ] 4.1 Add failing unit tests for a new `SanctionConvocationEnforcementService`: `ForceDeconvocationAsync` transitions an existing convocation to `Deconvoke`/`SportiveSanction`; `ForceDeconvocationAsync` creates a new `Deconvoke` convocation when none exists for that player/event; `TryRevertForcedDeconvocationAsync` reverts a convocation matching the forced signature back to `Pending`/no-excuse and returns `true`; `TryRevertForcedDeconvocationAsync` no-ops and returns `false` when the convocation's current state doesn't match the forced signature (design.md Decisión 4).
- [ ] 4.2 Create `Domain/Services/SanctionConvocationEnforcementService.cs` (+ `ISanctionConvocationEnforcementService`) implementing both methods; register scoped in `Program.cs`. Run until green.
- [ ] 4.3 Refactor `UpdateConvocationStatus.Handler.Handle`'s existing `Deconvoke` branch to call the extracted service instead of inline `SetConvocationStatusId`/`SetExcuseTypeId`, keeping its own defensive auto-fulfillment lookup (design.md Decisión 4) unchanged in behavior. Add/keep a test asserting an unrelated event's sanction is untouched.
- [ ] 4.4 Add failing tests for `SetPlayerSanction.cs`'s create handler: creating a sanction with `sportivePunishmentType: "Deconvocation"` and `targetEventId` (a) forces an existing convocation for that player/event to `Deconvoke` with excuse `SportiveSanction`, and marks the sanction `Fulfilled` in the same response; (b) creates a new `Deconvoke` convocation when none existed for that player/event; (c) references a non-existent `targetEventId` → `404`.
- [ ] 4.5 Implement the forced-deconvocation call (create/save sanction, then `ForceDeconvocationAsync`, then `sanction.MarkFulfilled(...)`) in `SetPlayerSanction.cs`'s create handler (design.md Decisión 4).
- [ ] 4.6 Add failing tests for `SetPlayerSanction.cs`'s update handler covering design.md Decisión 7's edit rules: editing a `Deconvocation` sanction's `targetEventId` while the old target event is still future reverts the old convocation and forces the new one; editing it while the old target event has already passed is rejected with `409`; removing the `Deconvocation` punishment (future event) reverts the convocation; editing unrelated fields (`fine`, `description`) on a past-event `Fulfilled` `Deconvocation` sanction still succeeds.
- [ ] 4.7 Implement the update-handler edit rules from 4.6 (design.md Decisión 7).
- [ ] 4.8 Add failing tests for `SetPlayerSanction.cs`'s delete handler covering design.md Decisión 7: deleting a `Fulfilled` `Deconvocation` sanction whose target event is still future succeeds (`204`) and reverts the convocation; deleting one whose target event has passed is rejected (`409`); deleting one whose convocation no longer matches the forced signature still deletes the sanction but the response carries a warning detail.
- [ ] 4.9 Implement the delete-handler exception from 4.8 (design.md Decisión 7).
- [ ] 4.10 Add a failing test for `SaveMatchParticipation.Handler`: a finished match saved with `minutesPlayed <= minutesLimit` for a player with a `Pending` `MinutesLimit` sanction targeting that event marks it `Fulfilled`; `minutesPlayed > minutesLimit` leaves it `Pending`; an unrelated event is untouched.
- [ ] 4.11 Implement `DetectAndFulfillMinutesLimitSanctionsAsync`, called alongside `DetectAndCreateAutomaticSanctionsAsync` inside the existing `MatchPhase == "finished"` branch (unchanged from the previous revision — `MinutesLimit` does not force anything, see design.md Non-Goals).
- [ ] 4.12 Add failing tests for `UpdateConvocationStatus.Handler`'s new reverse-coupling step (design.md Decisión 11): transitioning a convocation from `Deconvoke` to `Pending`/`Accepted`/`Justified` reopens (`endDate = null`) a `Fulfilled` `Deconvocation`-type sanction for the same `TeamPlayer`/event; an unrelated player's or unrelated event's sanction is untouched; a convocation whose previous status was not `Deconvoke` never triggers the lookup; reopening succeeds even when the target event's date has already passed.
- [ ] 4.13 Implement the reverse-coupling step in `UpdateConvocationStatus.Handler.Handle`: capture `wasDeconvoke` before applying the new status, and after applying it, if `wasDeconvoke && !isNowDeconvoke`, look up and `Reopen()` a matching `Fulfilled` `Deconvocation` sanction (design.md Decisión 11). Confirm this is a direct entity mutation with no call into `ISanctionConvocationEnforcementService`/`SetPlayerSanction.cs`, so it cannot re-trigger Decisión 4's forcing/reverting path.
- [ ] 4.14 Run all handlers'/service's test suites until green; run the full existing `AddConvocations`/`SaveMatchParticipation`/automatic-sanction test suites to confirm no regression (design.md Non-Goals, and the "`AddConvocations.cs` unmodified" claim in proposal.md).

## 5. New read endpoint

- [ ] 5.1 Add a failing test for `GET /api/events/{eventId}/sanctions/minute-limits`: returns only `Pending` `MinutesLimit` sanctions targeting the event; excludes `Fulfilled` ones; empty array when none; accessible to every authenticated role.
- [ ] 5.2 Create `Features/Coaches/Convocations/GetEventMinuteLimitSanctions.cs` (inline `IFeatureModule`, same style as `SetPlayerSanction.cs`) implementing the query (design.md Decisión 9).
- [ ] 5.3 Run the new endpoint's test until green.

## 6. Backend verification

- [ ] 6.1 `dotnet build` — no errors/warnings introduced.
- [ ] 6.2 `dotnet test` — full suite green, including all tests added above.
- [ ] 6.3 `openspec validate extend-player-sanctions-enforcement-and-payments --strict` — no errors.

## 7. Frontend — sanction form (front-specialist, separate session)

- [ ] 7.1 Extend `teamplayerSanctionService.ts` types/payloads with `sportivePunishmentType`, `targetEventId`, `minutesLimit`, `amountPaid`, `pendingAmount`, `status`.
- [ ] 7.2 `Sanctions.tsx`: relabel `category` as "Naturaleza" (Deportiva/Comportamiento); add punishment-type selector (Ninguno/Desconvocatoria/Límite de minutos) with conditional event picker and minutes field; add "Importe pagado"/"Pendiente" fields next to the existing "Multa" field; render `status` as a chip (Pendiente/Cumplida); disable the Delete action (or surface the `409` as a snackbar) when `status === "Fulfilled"`.
- [ ] 7.3 Add Vitest coverage for the new form fields' validation (mirrors backend rules) and for the delete-blocked-when-fulfilled UI state, written before the implementation (Red → Green).

## 8. Frontend — convocation excuse & live-match warning (front-specialist, separate session)

- [ ] 8.1 Ensure the convocation excuse-type dropdown (wherever `ExcusesType`/excuse ids are rendered, e.g. convocation management UI) picks up the new "Sanción deportiva" value from the backend list rather than a hardcoded frontend list, if one exists — audit first.
- [ ] 8.2 `liveMatchService.ts`: add a call to `GET /api/events/{eventId}/sanctions/minute-limits`, fetched once when the live-match screen mounts (design.md Decisión 9).
- [ ] 8.3 `useLiveMatch.ts`: store the fetched minute-limit list; on each timer tick, compare each sanctioned player's live `minutesPlayed` against their cap; on first crossing, emit `rffm.show_snackbar` (severity `"warning"`) naming the player and stating they must leave the field.
- [ ] 8.4 Add Vitest coverage (in `useLiveMatch.*.test.tsx`, following the existing per-aspect test file split) asserting the snackbar event fires exactly once when the cap is reached and not before, written before the implementation (Red → Green).
- [ ] 8.5 Audit the convocation-listing component(s) that render each player's row (e.g. wherever `ExcuseTypeId`/excuse text from `GetEventConvocations`'s `ConvocationResponse` is already displayed) and add a distinct icon/label (e.g. a gavel/shield icon with tooltip "Desconvocado por sanción deportiva") for any row where `excuseTypeId === 8`, instead of the default excuse rendering used for other `Deconvoke` rows (design.md Decisión 10). No new backend field is needed — this is a pure frontend rendering change against the existing `excuseTypeId` value.
- [ ] 8.6 Add Vitest coverage for the convocation-listing component asserting the badge renders when `excuseTypeId === 8` and does not render for any other excuse/status combination, written before the implementation (Red → Green).

## 9. Documentation follow-through

- [ ] 9.1 After implementation and verification, run `openspec archive extend-player-sanctions-enforcement-and-payments` per the `openspec-archive-change` skill, updating `specs/player-sanctions/spec.md`'s Purpose section.
