## Target State

When the change is complete, a team member opens the header piggy-bank icon, lands on `/coach/transactions?teamId=<id>`, and sees the team's sanctions, lottery books, quiniela tickets, wallet top-ups, wallet charges and quiniela fund movements as one filterable list of cards, each with a typed `Pending` / `Paid` status. The data comes from one new read-only endpoint that merges existing tables in memory. No table, column or migration changes.

### Architecture Snapshot

#### External Surfaces

- `GET /api/catalog/team/{teamId}/transactions?status=&type=` in `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Teams/Queries/GetTeamTransactions.cs`. Requires authentication (401 otherwise); non-members get 403 ProblemDetails; unknown `status`/`type` get 400 ProblemDetails. `status` in `Pending|Paid`; `type` in `Sanction|Lottery|Quiniela|WalletTopUp|WalletCharge`. Returns 200 with a JSON array (empty when the team has none), ordered by `date` desc, undated last. Array item shape:

```json
{
  "id": "sanction:<guid>",
  "type": "Sanction",
  "personName": "Name Surname",
  "amount": 100.0,
  "pendingAmount": 60.0,
  "date": "2026-03-01T00:00:00Z",
  "description": "text",
  "status": "Pending"
}
```

  `personName` is null when the source names nobody (quiniela fund movements); `pendingAmount` is null when `status` is `Paid`; `date` is null for an unpaid quiniela ticket whose round has no derivable deadline.
- Coach web route `/coach/transactions` (query `teamId`), lazy-loaded in `Front/src/apps/coach/routes.tsx`, guarded by `RequireFeaturePermission` with the Sanctions feature key.
- Header piggy-bank click in `Front/src/shared/components/ui/AppHeader/AppHeader.tsx` navigates to `/coach/transactions?teamId=<id>`; the sanctions badge and side menu keep `/coach/sanctions`.

#### Internal Public Surfaces

- `GetTeamTransactions : IFeatureModule` (same file as the endpoint): `TeamTransactionsQuery(string TeamId, TransactionStatus? Status, TransactionType? Type) : IQueryApp<IReadOnlyList<TeamTransactionDto>>`, `Handler(AppDbContext, FederationDbContext, ICurrentUserService)`, `TeamTransactionDto`, enums `TransactionType` and `TransactionStatus`.
- `Front/src/apps/coach/services/transactionService.ts`: `getTeamTransactions(teamId, filters)` and types `TeamTransaction`, `TransactionType`, `TransactionStatus`; throws on request failure so the page can show an error.
- `Front/src/apps/coach/pages/transactions/Transactions.tsx` (+ `Transactions.module.css`) and `components/TransactionCard.tsx` (+ module CSS): page reads `teamId` from the query string, falls back to `resolveUserTeamId()`.

### File Manifest

- M Back/ExtractionApi/Directory.Build.props (Step 1)
- A Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Teams/Queries/GetTeamTransactions.cs (Step 1)
- A Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/GetTeamTransactionsEndpointTests.cs (Step 1)
- A Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/GetTeamTransactionsHandlerTests.cs (Step 1)
- M Front/package-lock.json (Step 3)
- M Front/package.json (Step 3)
- A Front/src/apps/coach/pages/transactions/Transactions.module.css (Step 2)
- A Front/src/apps/coach/pages/transactions/Transactions.tsx (Step 2)
- A Front/src/apps/coach/pages/transactions/__tests__/Transactions.test.tsx (Step 2)
- A Front/src/apps/coach/pages/transactions/components/TransactionCard.module.css (Step 2)
- A Front/src/apps/coach/pages/transactions/components/TransactionCard.tsx (Step 2)
- M Front/src/apps/coach/routes.tsx (Step 2)
- A Front/src/apps/coach/services/transactionService.ts (Step 2)
- M Front/src/shared/components/ui/AppHeader/AppHeader.tsx (Step 3)
- M Front/src/shared/components/ui/AppHeader/__tests__/AppHeader.teamFundBalance.test.tsx (Step 3)

## Context

Money is spread over four coach screens (sanctions, lottery, quiniela, quiniela wallet) and the header piggy-bank icon opens only the sanctions page. Issue #8 asks for one window with every team transaction and its payment status. The proposal and specs are settled; this design only fixes how to build them.

Verified facts that shape the design:

- Feature shape: `GetTeamFund.cs` is a vertical-slice `IFeatureModule` with a literal route (`api/catalog/team/{teamId}/fund`, no `MapGroup`), `RequireAuthorization()` only, `AsNoTracking()` reads, SmartEnum values returned as `.Name` strings, no validator and no cache.
- Team scoping differs per source: `TeamPlayerSanction` reaches the team through `TeamPlayer.TeamId`; `LotteryCampaign.TeamId` owns books (`LotteryBook` has a plain `LotteryCampaignId` string FK and no navigation); `QuinielaJornada.TeamId` owns tickets through `QuinielaTicket.JornadaId`; `QuinielaWallet.TeamId` owns movements through `QuinielaWalletMovement.WalletId`; `TeamFundMovement.TeamId` is direct.
- Types: `LotteryBook.DeliveredOn` and `ReturnedOn` are `DateOnly`. `TeamPlayerSanction.Fine` and `AmountPaid` are nullable decimals. `QuinielaPaymentStatus`, `QuinielaPaymentMethod`, `QuinielaWalletMovementType` and `TeamFundMovementSource` are SmartEnum classes, not CLR enums. `QuinielaTicket.EffectiveStatus` derives `Expired` at read time; the persisted value is only `Pending` or `Paid`.
- The quiniela payment deadline is not a column. It is computed from the jornada's RFFM round: the earliest valid `RffmMatch.MatchDate` (federation database, `QuinielaMatchValidity.IsValid`) fed to `QuinielaSchedule.PaymentDeadlineUtc(DateOnly)`; `QuinielaLifecycle.cs` already batch-loads `RffmMatch` rows by round ids.
- Membership check: `QuinielaSupport.RequireRoleAsync(db, currentUser, teamId, allowedMemberships, ct)` throws `UnauthorizedAccessException` when anonymous and `ForbiddenAccessException` (mapped to 403 ProblemDetails in `ServiceCollectionExtensions.cs`) when the user has no `UserTeams` role in the allowed set and is not a club coach/directive of the team's club (the club path requires `Coach` in the allowed set). `ParticipantRoles` is Coach, Player, FamilyPlayer.
- Web guard: `RequireFeaturePermission` allows a non-admin only when `usePermissions().hasFeatureAccess(route)` finds a `FeaturePermission` row for the exact route string. Rows are seeded by `WebApplicationExtensions.SeedFeaturePermissionsAsync` at startup, insert-if-missing per (role, route). Sanctions rows exist for Coach, ClubDirector, Player and FamilyMember.
- Person names: participant and wallet-owner names come from `QuinielaSupport.LoadParticipantsAsync` (`UserPersonalData` first/last name with family-member fallback); the only `TeamPlayer` name join found is `tp.Player.Name`/`LastName` in `GetQuinielaWallets.cs`.
- The proposal's research note says `QuinielaRound.PaymentDeadlineUtc` is "read from the federation database". Accurate in effect: the deadline is derived from federation `RffmMatch` rows, not stored. This is not a spec defect.

## Goals / Non-Goals

Goals:

- One read-only endpoint returning the merged, filtered, date-ordered transaction array exactly as the `team-transactions-list` spec states, with membership-scoped access.
- One responsive card page and the header icon retarget required by the `team-fund` delta.
- No schema change, no write path touched, no new caching layer.

Non-Goals:

- Mobile screens, any change to sanctions/lottery/quiniela/wallet write flows.
- Out of scope: pagination of the transaction list — revisit when a single team's list grows large enough to slow the page or response.
- Out of scope: listing wallet `Adjustment`, `TicketRefund`, `Prize` and `Donation` movements and sanctions without a fine — revisit when the issue asks for a complete ledger instead of a payment-status list.
- Out of scope: a dedicated `/coach/transactions` feature-permission row and backend route constant — revisit when transactions need access rules different from sanctions.

## Decisions

### 1. One feature file, mirroring `GetTeamFund`

`Features/Coaches/Teams/Queries/GetTeamTransactions.cs` holds endpoint, query record, handler, DTO and enums. The route is a literal `api/catalog/team/{teamId}/transactions`, with `RequireAuthorization()`. The endpoint parses `status` and `type` into nullable enums and returns `Results.ValidationProblem(...)` (400 ProblemDetails) for any value outside the closed sets before sending the query, the same pattern as the `SourceCategory` parse in `SetPlayerSanction.cs`. Parsing accepts only the defined names (case-insensitive), never numeric strings.

**Provenance**: codebase-forced

### 2. Membership check through `RequireRoleAsync` with `ParticipantRoles`

The handler calls `QuinielaSupport.RequireRoleAsync` with `ParticipantRoles` (Coach, Player, FamilyPlayer). That gives the spec's access set (for a user who is not a team Coach or club coach/directive, per `QuinielaSupport.IsCoachAsync`, the handler additionally restricts every source to the user: tickets and wallet movements by user id, sanctions and lottery books by the player ids from `UserTeam.LinkedTeamPlayerId` plus `TeamPlayerFamilyMember.LinkedUserId`, and no fund movements): team members in those roles plus club coach/directive via the club path, 403 ProblemDetails for everyone else, and 401 for anonymous (additionally guarded by `RequireAuthorization()`). No new access helper is written.

**Provenance**: derived

### 3. In-memory merge with one projected query per source

The handler runs one `AsNoTracking()` projected query per source, filtered by team: sanctions with `Fine > 0`, lottery books joined to the team's campaigns, tickets joined to the team's jornadas, wallet movements of type `TopUp`/`TicketCharge` joined to the team's wallets, and fund movements with source `QuinielaFund`/`QuinielaDonation` (so `SanctionPayment` is never read, satisfying "a sanction payment is listed only once"). Each row becomes a private record, then the list is filtered by `status`/`type`, and ordered by `date` descending with undated rows last and a deterministic tie-break (type, then id). When `type` is given, the sources that cannot produce that type are not queried. Dates from `DateOnly` sources become midnight UTC `DateTime` so all sources share one ordering type.

Alternatives: a SQL `UNION` view (rejected: needs a view/migration the proposal forbids and cross-database deadline logic); a persisted ledger table (rejected: migration, write-path changes).

**Provenance**: derived

### 4. Status and amounts computed per type at query time

`TransactionStatus` is `Pending` or `Paid` and is never persisted. Per spec: sanction `Paid` when `AmountPaid >= Fine`, pending amount `Fine - AmountPaid` (null `AmountPaid` as zero); lottery book `Paid` when `AmountReturned` is set, amount `AmountReturned` else `TicketPrice * TicketsPerBook`; ticket `Paid` only when its persisted payment status is `Paid` (an `Expired` effective status never leaks: unpaid stays `Pending`), amount `Price`; fund movements, top-ups and charges always `Paid` with `Math.Abs(Amount)`. `pendingAmount` equals the full `amount` for a pending lottery book or ticket, and is null for `Paid`. A ticket paid from the wallet appears as a `Quiniela` row and as a `WalletCharge` row by design.

**Provenance**: user

### 5. Quiniela ticket date and deadline batching

For tickets with a non-null `PaidAt` the date is `PaidAt`. For unpaid tickets, and paid tickets whose `PaidAt` is null (legacy rows), the handler collects the distinct `RffmRoundId` values of their jornadas, loads the matching `RffmMatch` rows from `FederationDbContext` in one query (same pattern as `QuinielaLifecycle.cs`), keeps the valid ones per `QuinielaMatchValidity.IsValid`, takes the earliest date, and feeds it to `QuinielaSchedule.PaymentDeadlineUtc`. A round with no valid dated match gives a null date. Existing `QuinielaRound` code is reused when it can be built from those rows; no second deadline formula is created.

**Provenance**: codebase-forced

### 6. Person names and descriptions

`personName` for sanctions and lottery books comes from the `TeamPlayer` -> `Player` name join used in `GetQuinielaWallets.cs`; for quiniela tickets and wallet movements it comes from `QuinielaSupport.LoadParticipantsAsync` (batched once per request for all user ids). Quiniela fund movements have no person. `description` is the source's own text when it has one (`TeamFundMovement.Description`, `QuinielaWalletMovement.Description`, a sanction text field if the entity exposes one) and otherwise a Spanish fallback built from the type label, so the field is never empty.

**Provenance**: derived

### 7. No caching

The endpoint implements neither `ICacheRequest` nor `IInvalidateCacheRequest`. `GetTeamFund`, the sanctions, lottery and quiniela features use no cache, so no invalidation path exists for a cached list to stay correct; the payment status the coach checks must be current. The proposal's "same cache policy as `GetTeamFund`" therefore resolves to "none".

**Provenance**: codebase-forced

### 8. The web route reuses the Sanctions feature key

`/coach/transactions` is wrapped with `RequireFeaturePermission` using `COACH_FEATURE_ROUTES.Sanctions`. A new key would need a `CoachFeatureRoutes` constant, a `featureRoutes.ts` entry and seed tuples for each role, and until the seed runs `hasFeatureAccess` returns false for every non-admin. Reusing the key keeps the spec's "same feature-permission guard as the sanctions route" literal and needs no seed change; Player and FamilyMember already hold Sanctions read rows, Coach and ClubDirector hold read-write rows.

Alternative: a new `/coach/transactions` key with seeded rows for Coach, ClubDirector, Player, FamilyMember (rejected: extra seed work and a startup-order dependency for no behavior the specs ask for).

**Provenance**: derived

### 9. Frontend structure, team resolution and error behavior

- `transactionService.ts` follows `teamFundService.ts` (shared Axios `client`, exported `type`s) but throws on failure instead of returning `null`/`[]`, so the page can show the required error message.
- The page reads `teamId` from `useSearchParams`, and when absent resolves it with the default export of `shared/hooks/resolveUserTeamId.ts` (the same resolution behind the header icon: profile team, then preferred team).
- Filters are two groups of buttons (status: Todos/Pendiente de pago/Pagado; type: Todos/Sanciones/Lotería/Quiniela/Recargas/Cargos) in the style of the Sanctions filter row; each change re-requests the list with `status`/`type` so filtering is server-side, as the spec's endpoint contract states.
- `TransactionCard` is a `Paper` with the person, a type label, amount, date (`date-fns`), a status `Chip` (`Pagado` success, `Pendiente de pago` error, with the pending amount shown), in a stacked flex column; CSS Module only, tokens from the existing `--rffm-*` custom properties, no table or fixed-column grid, no inline styles. Empty list shows the `EmptyState` component; a failed load shows the error and no cards via the `rffm.show_snackbar` bus event plus an inline message.
- The header change is only the target string in `handleOpenTeamFund`; its existing test (`AppHeader.teamFundBalance.test.tsx`, asserting `/coach/sanctions?teamId=team-7`) is updated to `/coach/transactions?teamId=team-7`.

**Provenance**: derived

## Risks / Trade-offs

- [Sanctions feature key also gates transactions: a user whose role lacks a Sanctions permission row cannot open the page even though the backend would allow them] → Roles that pass the backend membership check (Coach, Player, FamilyPlayer, club coach/directive) all hold Sanctions rows today; a role change to the seed needs the transactions page re-checked.
- [Unbounded list: no pagination, a large team returns every transaction] → Spec asks for none; one projected query per source with `AsNoTracking()` keeps cost linear, and pagination is recorded as a non-goal.
- [EF translation of SmartEnum comparisons in the team-scoped queries (`QuinielaWalletMovementType`, `TeamFundMovementSource`, payment status) may not translate as written] → Compare with the SmartEnum constants as the existing wallet and fund features do, and cover each source with a real-PostgreSQL integration test.
- [`LoadParticipantsAsync` and `QuinielaRound` are internal helpers whose exact signatures were read only through call sites] → Reuse them as-is if their shape fits; if not, extract the minimal shared piece instead of duplicating the deadline or name logic.
- [Sanction/lottery description text fields were not all read] → The Spanish type-label fallback keeps `description` non-empty regardless of which source fields exist.
- [Date-only sources are normalized to midnight UTC, so same-day ordering across types depends on the tie-break] → The deterministic tie-break (type, id) keeps the order stable between calls.

## Open Questions

None. All unknowns above are implementation-time checks that do not change behavior the specs describe.

## Manual Verification

- End-to-end smoke across the real API and web app: sign in as a coach with a team that has at least one pending sanction, a delivered lottery book and a quiniela ticket, click the header piggy-bank icon, and confirm the browser lands on `/coach/transactions?teamId=<id>`, cards for each source appear with `Pendiente de pago` / `Pagado` labels, and the status and type filters narrow the list. Repeat at a 360 px viewport and confirm cards stack with no horizontal scroll and no table.
- End-to-end access check: open `/coach/transactions?teamId=<other team id>` signed in as a user of a different team and confirm the page shows the error message and no cards (the API returns 403).
- Generated-artifact drift: after the web version bump (`npm version --no-git-tag-version`), confirm the `version` fields of `Front/package.json` and `Front/package-lock.json` match, and that `Back/ExtractionApi/Directory.Build.props` `<Version>` carries the minor bump; no migration files are added.
