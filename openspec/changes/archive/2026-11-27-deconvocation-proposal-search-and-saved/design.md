## Context

- `DeconvocationProposalView` renders the funnel, the order list and the sections; each card embeds `ProposalHistory`, built by `buildProposalHistory` (league matches only).
- «Aplicar propuesta» calls `handleApplyProposal(ids)` in `ConvocationMatchDetail`, which calls `moveToNotCalled` with the technical excuse for each player not already out. `moveToNotCalled` handles its own errors: it rolls back that player and shows a notice.
- Manual order lives only in client state (`useManualDeconvocationOrder`).
- Team rules are stored as a jsonb document (`DeconvocationRulesSettings`). Event authorization is `AvailabilityAuthorization.EnsureCanManageEventTeamAsync`.

## Goals / Non-Goals

Goals:
- Search, filter and sort proposal players without changing the engine.
- Keep several candidate proposals per match in the server and apply one.

Non-goals:
- Free-text or AI queries.
- Editing or renaming a saved proposal; comparing proposals side by side.
- Publishing the convocation, re-calling players, or changes in `Mobile/`.

## Decisions

### D1. Search is a pure client-side function
`utils/proposalSearch.ts` takes the proposal (players and already deconvoked), the history data and the criteria `{ text, neverOut, noTechnical, sort }` and returns the matching entries with their situation. Figures come from `buildProposalHistory`, so cards and filters cannot disagree. A new component `ProposalSearch` renders the controls (text field, two toggle chips, sort select, «Limpiar»); `ProposalSearchResults` renders the cards. Criteria are local state of the view. Without history data the controls are hidden.

### D2. A saved proposal stores only the ordered player ids
Table `DeconvocationSavedProposals`: `Id`, `SportEventId` (FK, cascade), `Name` (max 60), `TeamPlayerIdsJson` (jsonb), `CreatedOn`; index on `SportEventId`. A child table per player was rejected: the list is always read and written whole. Scores and reasons are not stored: they age, and applying only needs the ids.

### D3. One vertical slice per operation
`Features/Coaches/DeconvocationProposals/`: `GetSavedDeconvocationProposals`, `SaveDeconvocationProposal`, `DeleteSavedDeconvocationProposal`, plus constants. Routes `GET|POST /api/events/{eventId}/deconvocation-proposals` and `DELETE /api/events/{eventId}/deconvocation-proposals/{proposalId}`, restricted to `Coach,Administrator` plus `EnsureCanManageEventTeamAsync`. The limit of 10 returns a conflict with its own error code. Player membership is checked in the handler against the event's team. Two simultaneous saves could exceed the limit by one; accepted for a single coach.

### D4. Applying reuses the existing client path
No apply endpoint: «Aplicar» calls the same `onApplyProposal(ids)` as the current proposal, with the saved ids filtered to the current squad. This keeps one set of rules for excuses, availability and rollback. «Aplicada» is derived (all available saved players are not called), not stored. The button is «Aplicar», not «Publicar», to avoid confusion with «Publicar convocatoria».

### D5. Web data access
`services/deconvocationProposalService.ts` (single Axios client), hook `useSavedProposals(eventId, enabled)` with `items`, `loading`, `error`, `save`, `remove`, loaded only when the proposal view is open. `SavedProposals` renders the cards with `ConfirmDialog` for apply and delete; `SaveProposalDialog` asks for the name. Notices use `rffm.show_snackbar`.

## Target State

Header actions: «Guardar propuesta» next to «Aplicar propuesta». Below the tabs, in the current proposal: «Propuestas guardadas» (hidden when empty and not loading or failed), then the search controls, then either the usual sections or the result list.

## Risks / Trade-offs

- Applying B after A leaves A's players out too → the confirmation lists the players who stay out.
- A partial failure while applying leaves some players deconvoked → existing per-player rollback and notice; the card stays without «Aplicada», so it can be retried.
- The apply path closes the proposal view, as today.
- `ConvocationTab.tsx` is already large → saved-proposal logic stays in its own components and hook. `ConvocationMatchDetail.tsx` has a UTF-8 BOM that must be kept.

## Migration Plan

One additive EF migration creating the table, in its own commit. No backfill. Rollback: revert the web and API commits; the unused table can be dropped by a new migration.

## Validation Strategy

- Vitest: `proposalSearch` unit tests (each filter, each sort, accents, friendlies, uniqueness); component tests for controls, saved cards, dialogs and error states; service test for routes.
- xUnit with the Postgres test container: save/list/delete, limit, validation, foreign player, other team, proposal of another match, cascade on event delete.
- Only affected tests while implementing; `npm run build` and `dotnet build` once at the end.
- Manual check at 360px.

## ADR / DDR Evaluation

Neither: it follows existing patterns (vertical slices, jsonb document, event authorization).

## Open Questions

None.
