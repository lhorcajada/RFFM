## Step 1: Team transactions endpoint with the API version bump

**Interfaces**: In `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Teams/Queries/GetTeamTransactions.cs`:
- `public class GetTeamTransactions : IFeatureModule` with `AddRoutes(IEndpointRouteBuilder app)` mapping `GET api/catalog/team/{teamId}/transactions` with query parameters `status` and `type` (strings), `RequireAuthorization()`.
- `public enum TransactionType { Sanction, Lottery, Quiniela, WalletTopUp, WalletCharge }`
- `public enum TransactionStatus { Pending, Paid }`
- `public record TeamTransactionsQuery(string TeamId, TransactionStatus? Status, TransactionType? Type) : IQueryApp<IReadOnlyList<TeamTransactionDto>>`
- `public record TeamTransactionDto(string Id, string Type, string? PersonName, decimal Amount, decimal? PendingAmount, DateTime? Date, string Description, string Status)` — `Type` and `Status` carry the enum names.
- `public class Handler(AppDbContext db, FederationDbContext fed, ICurrentUserService currentUser, IdentityDbContext identityDb) : IRequestHandler<TeamTransactionsQuery, IReadOnlyList<TeamTransactionDto>>`.
- `Back/ExtractionApi/Directory.Build.props` `<Version>` is raised by one minor.
- The handler returns rows of all five types: `Sanction`, `Lottery`, `Quiniela` (tickets and quiniela fund movements), `WalletTopUp` and `WalletCharge`.

**Test assertions**: Authored against `openspec/changes/team-transactions-window/specs/team-transactions-list/spec.md`.
- Requirement "Access is limited to members of the team, and players and family members see only their own transactions": a user linked to the team as Player gets only their own transactions (own quiniela tickets and wallet movements, and the sanctions and lottery books of the player linked through `UserTeam.LinkedTeamPlayerId` or `TeamPlayerFamilyMember.LinkedUserId`, no fund movements); a team Coach gets the whole list; a coach of the team's club gets the list; an authenticated user of another team makes the handler throw `ForbiddenAccessException` and no transaction is returned.
- Requirement "A team without transactions returns an empty list": a team with no data returns an empty list (not null).
- Requirement "Transaction sources and types", scenario "Sanction without a fine is not listed": sanctions with `Fine` null or 0 produce no row; a sanction with `Fine: 100` produces one row of type `Sanction` with the sanction `StartDate` as `Date` and the player's name as `PersonName`.
- Requirement "Payment status is a typed two-value state computed per type": `Fine: 100, AmountPaid: 40` -> `Status` `Pending`, `PendingAmount` 60; `Fine: 100, AmountPaid: 100` -> `Paid`, `PendingAmount` null; `Fine: 50, AmountPaid` null -> `Pending`, `PendingAmount` 50.
- Same requirement, lottery: book with `AmountReturned` null, campaign `TicketPrice` 2 and `TicketsPerBook` 10 -> `Pending`, `Amount` 20, `PendingAmount` 20; book with `AmountReturned: 15` -> `Paid`, `Amount` 15.
- Requirement "Transaction sources and types", scenario "Each type takes its date from its own source field": lottery book with `ReturnedOn` 2 March and `DeliveredOn` 20 February -> `Date` is 2 March at 00:00 UTC; with `ReturnedOn` null -> `Date` is `DeliveredOn` at 00:00 UTC.
- Requirement "A sanction payment is listed only once": a sanction with `AmountPaid: 40` and a linked `SanctionPayment` fund movement yields exactly one row.
- Requirement "Transactions are ordered by date and filterable": rows dated 1, 5 and 3 March come back as 5, 3, 1 March; with `Status` `Pending` only pending rows return; with `Type` `Lottery` only lottery rows return; `Status` `Paid` with `Type` `Sanction` returns only paid sanction rows.

- Requirement "Transaction sources and types", scenario "Quiniela fund movements are listed as Quiniela transactions": a `TeamFundMovement` with source `QuinielaFund` or `QuinielaDonation` yields a `Quiniela` row with `Status` `Paid`, `Date` equal to `OccurredAt`, `Amount` equal to the absolute `Amount`, and `PersonName` null.
- Same requirement, scenario "Wallet top-up and charge are listed with their own types": a `TopUp` and a `TicketCharge` movement yield one `WalletTopUp` and one `WalletCharge` row, each with `Status` `Paid`, `Date` equal to `OccurredAt`, and the wallet owner's name as `PersonName`.
- Same requirement, scenario "Wallet movements other than top-ups and charges are not listed": movements of type `Prize`, `Adjustment`, `TicketRefund` and `Donation` yield no row.
- Same requirement, scenario "Ticket paid from the wallet is listed as ticket and as charge": a ticket paid from the wallet yields one `Quiniela` row and one `WalletCharge` row.
- Same requirement, scenario "A sanction payment is listed only once" (second clause): a `TeamFundMovement` with source `SanctionPayment` never yields a row.
- Requirement "Payment status is a typed two-value state computed per type", scenario "Paid quiniela ticket is paid": a ticket with `PaymentStatus` paid and `PaidAt` set -> `Status` `Paid`, `Amount` equal to the jornada `Price`, `Date` equal to `PaidAt`.
- Same requirement, scenario "Unpaid quiniela ticket past its deadline stays pending": an unpaid ticket whose deadline passed -> `Status` `Pending` (never `Expired`), `PendingAmount` equal to the jornada `Price`.
- Requirement "Transaction sources and types", scenario "Unpaid ticket takes the payment deadline as its date": an unpaid ticket whose jornada round has a valid dated match -> `Date` equals `QuinielaSchedule.PaymentDeadlineUtc` of that round's earliest valid match date.
- Requirement "Transactions are ordered by date and filterable", scenario "Transaction without a date is ordered last": an unpaid ticket whose round has no valid dated match has `Date` null and is listed after a dated sanction.
- Same requirement, scenario "Ordering mixes transaction types by their source dates": sanction 1 March, paid ticket 5 March, wallet top-up 3 March come back ticket, top-up, sanction.
- Same requirement, filters: `Type` `Quiniela` returns tickets and fund movements only; `Type` `WalletCharge` returns charges only.

**Endpoint-level test assertions** (class `GetTeamTransactionsEndpointTests` in `Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/GetTeamTransactionsEndpointTests.cs`, over the real HTTP pipeline with an in-test authentication handler; the handler-level assertions above live in `GetTeamTransactionsHandlerTests`):
- `openspec/changes/team-transactions-window/specs/team-transactions-list/spec.md`, requirement "Transactions are ordered by date and filterable", scenario "Unknown filter value is rejected": `GET /api/catalog/team/{teamId}/transactions?status=Expired` responds `400` with a ProblemDetails body; the same for `type=Unknown` and for numeric values such as `status=1` and `type=2`.
- Same requirement, scenarios "Filter by status" and "Filter by type": `?status=Pending` and `?type=Lottery` (case-insensitive names) respond `200` with the filtered array.
- Requirement "Access is limited to members of the team, and players and family members see only their own transactions", scenario "Unauthenticated request is rejected": a request without credentials responds `401`.
- Same requirement, scenario "User of another team is denied": an authenticated user who is not in the team receives `403` with a ProblemDetails body and no transaction data.
- Requirement "A team without transactions returns an empty list", scenario "Endpoint returns an empty list": the endpoint responds `200` with the JSON array `[]`.

## Step 2: Coach transactions page, service and route

**Interfaces**: In `Front/src/apps/coach/services/transactionService.ts`:
- `export type TransactionType = "Sanction" | "Lottery" | "Quiniela" | "WalletTopUp" | "WalletCharge"`
- `export type TransactionStatus = "Pending" | "Paid"`
- `export type TeamTransaction = { id: string; type: TransactionType; personName?: string | null; amount: number; pendingAmount?: number | null; date?: string | null; description: string; status: TransactionStatus }`
- `export type TransactionFilters = { status?: TransactionStatus; type?: TransactionType }`
- `export async function getTeamTransactions(teamId: string, filters?: TransactionFilters): Promise<TeamTransaction[]>` — calls `GET /api/catalog/team/{teamId}/transactions` with the filters as query parameters through the shared client; rejects when the request fails.
- `export default { getTeamTransactions }`

In `Front/src/apps/coach/pages/transactions/components/TransactionCard.tsx`: `export default function TransactionCard(props: { transaction: TeamTransaction }): JSX.Element`.
In `Front/src/apps/coach/pages/transactions/Transactions.tsx`: `export default function Transactions(): JSX.Element`, routed at `/coach/transactions` and lazy-loaded from `Front/src/apps/coach/routes.tsx`.

**Test assertions**: Authored against `openspec/changes/team-transactions-window/specs/team-transactions-list/spec.md`, requirement "The coach app shows transactions in a responsive card list", with the service module mocked.
- Scenario "Transactions are shown as cards with translated status": the mocked list holds a paid `Quiniela` ticket and a pending `Sanction` with `pendingAmount` 60; the page renders two cards, the first containing the text «Pagado», the second containing «Pendiente de pago» and the amount 60.
- Scenario "Status filter narrows the cards": clicking the pending status filter calls `getTeamTransactions` with `{ status: "Pending" }` and the page shows only cards labelled «Pendiente de pago».
- Scenario "Type filter narrows the cards": clicking the lottery type filter calls `getTeamTransactions` with `{ type: "Lottery" }`.
- Scenario "Layout works on a narrow screen": the rendered page contains no `table` role and no element with role `columnheader`.
- Scenario "Load failure shows an error": when `getTeamTransactions` rejects, the page shows an error message and zero transaction cards.
- Requirement "A team without transactions returns an empty list", scenario "Page shows an empty-list message": a mocked empty list renders the empty-list message and no error message.
- Team resolution: with `?teamId=team-9` in the URL the service is called with `"team-9"`; with no `teamId` and `resolveUserTeamId` resolving `"team-3"`, it is called with `"team-3"`.

## Step 3: Header piggy-bank opens the transactions page with the web version bump

**Interfaces**: No new signatures; the existing `handleOpenTeamFund` in `Front/src/shared/components/ui/AppHeader/AppHeader.tsx` navigates to `/coach/transactions?teamId=<teamFund.teamId>` instead of `/coach/sanctions?teamId=<teamFund.teamId>`. `Front/package.json` and `Front/package-lock.json` carry the same raised minor `version`.

**Test assertions**: Authored against `openspec/changes/team-transactions-window/specs/team-fund/spec.md`, requirement "Team fund balance icon is visible to every user in the app header".
- Scenario "Clicking the fund balance icon opens the team transactions page": with the mocked fund hook returning team id `team-7`, clicking the team-fund-balance button calls `navigate` with `/coach/transactions?teamId=team-7` and never with a `/coach/sanctions` path.
- Scenario "Sanctions entry points keep going to sanctions": clicking the pending-sanctions notification icon still navigates to `/coach/sanctions` (existing `AppHeader.pendingSanctionsBadge.test.tsx` stays green unchanged).
