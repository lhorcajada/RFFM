## Purpose
Gives a team a single read-only view of its money movements: sanctions, lottery books, quiniela tickets and quiniela wallet movements, each with a two-value payment status, so the coach can see what is paid and what is still owed without visiting four separate screens.

## ADDED Requirements

### Requirement: Team transactions are exposed by a read-only endpoint
The system SHALL expose `GET /api/catalog/team/{teamId}/transactions`, returning the team's transactions as one list merged in memory from existing data. Each transaction SHALL carry a type, an amount, a date, a description, a payment status and, when the source identifies one, the player or user involved. For a transaction whose status is `Pending`, the response SHALL also carry the outstanding amount. The endpoint SHALL NOT create, change or delete any data, and the change SHALL NOT add tables, columns or migrations.

#### Scenario: Team with transactions from several sources returns one merged list
- **WHEN** an authorized user calls `GET /api/catalog/team/{teamId}/transactions` for a team that has a sanction with a fine, a delivered lottery book and a quiniela ticket
- **THEN** the system returns `200 OK` with one list containing a transaction for each of them, every item carrying type, amount, date, description and status

#### Scenario: Endpoint does not modify data
- **WHEN** an authorized user calls the endpoint repeatedly for the same team
- **THEN** no row of any table is created, changed or deleted

### Requirement: Transaction sources and types
The list SHALL contain transactions of exactly these types, each projected from the source shown:

- `Sanction`: each `TeamPlayerSanction` of the team's players whose `Fine` is greater than zero.
- `Lottery`: each `LotteryBook` delivered in a lottery campaign of the team.
- `Quiniela`: each `QuinielaTicket` of a quiniela jornada of the team, and each `TeamFundMovement` of the team whose source is `QuinielaFund` or `QuinielaDonation`.
- `WalletTopUp`: each `QuinielaWalletMovement` of type `TopUp` in a quiniela wallet of the team.
- `WalletCharge`: each `QuinielaWalletMovement` of type `TicketCharge` in a quiniela wallet of the team.

Quiniela wallet movements of any other type (`Adjustment`, `TicketRefund`, `Prize`, `Donation`) and sanctions without a fine SHALL NOT be listed. The person involved SHALL be the player for `Sanction` and `Lottery`, the participant for a quiniela ticket, and the wallet owner for `WalletTopUp` and `WalletCharge`.

The transaction date SHALL come from the source as follows:

- `Sanction`: the sanction `StartDate`.
- `Lottery`: the book `ReturnedOn` when it is informed, otherwise the book `DeliveredOn`; a date without time counts as the start of that day for ordering.
- `Quiniela` ticket: the ticket `PaidAt` when it is paid and has one; otherwise (unpaid, or paid with no `PaidAt`) the payment deadline of its jornada's RFFM round. When no deadline can be derived, the transaction has no date and is ordered after every dated transaction.
- `Quiniela` fund movement, `WalletTopUp` and `WalletCharge`: the movement `OccurredAt`.

#### Scenario: Each type takes its date from its own source field
- **WHEN** the list contains a sanction with `StartDate` 1 March, a returned lottery book with `ReturnedOn` 2 March and `DeliveredOn` 20 February, a paid ticket with `PaidAt` 3 March, and a wallet top-up with `OccurredAt` 4 March
- **THEN** their transaction dates are 1 March, 2 March, 3 March and 4 March respectively

#### Scenario: Unpaid ticket takes the payment deadline as its date
- **WHEN** a quiniela ticket is unpaid and its jornada's payment deadline is 6 March
- **THEN** its transaction date is 6 March

#### Scenario: Sanction without a fine is not listed
- **WHEN** a team has a sanction whose `Fine` is null or zero
- **THEN** the transactions list does not contain a transaction for that sanction

#### Scenario: Wallet movements other than top-ups and charges are not listed
- **WHEN** a team's wallet has movements of type `Prize`, `Adjustment`, `TicketRefund` and `Donation`
- **THEN** none of those movements appears in the transactions list

#### Scenario: Quiniela fund movements are listed as Quiniela transactions
- **WHEN** a team has a `TeamFundMovement` with source `QuinielaFund` or `QuinielaDonation`
- **THEN** the list contains a transaction of type `Quiniela` for it with status `Paid`

#### Scenario: Wallet top-up and charge are listed with their own types
- **WHEN** a team's wallet has a `TopUp` movement and a `TicketCharge` movement
- **THEN** the list contains one `WalletTopUp` and one `WalletCharge` transaction, each with the wallet owner as the person involved

#### Scenario: Ticket paid from the wallet is listed as ticket and as charge
- **WHEN** a quiniela ticket was paid from the wallet
- **THEN** the list contains one `Quiniela` transaction for the ticket and one `WalletCharge` transaction for the wallet charge

### Requirement: Payment status is a typed two-value state computed per type
Every transaction SHALL have a status of exactly `Pending` or `Paid`, computed at query time and never persisted. No other status value, including `Partial` or `Expired`, SHALL be returned. The status SHALL be computed per type:

- `Sanction`: `Paid` when `AmountPaid` is at least `Fine`; otherwise `Pending`, including a partial payment. The outstanding amount SHALL be `Fine` minus `AmountPaid` (with a null `AmountPaid` counted as zero).
- `Lottery`: `Paid` when the book's `AmountReturned` is informed; otherwise `Pending`. The amount SHALL be `AmountReturned` when informed, and the campaign `TicketPrice` multiplied by `TicketsPerBook` otherwise.
- `Quiniela` ticket: `Paid` when its payment status is paid; otherwise `Pending`, including a ticket whose payment deadline has passed. The amount SHALL be the jornada `Price`.
- `Quiniela` fund movement, `WalletTopUp` and `WalletCharge`: always `Paid`, because they are movements already made. The amount SHALL be the absolute value of the movement `Amount`.

#### Scenario: Partially paid sanction is pending and shows the missing amount
- **WHEN** a sanction has `Fine: 100` and `AmountPaid: 40`
- **THEN** its transaction has status `Pending` and an outstanding amount of `60`

#### Scenario: Fully paid sanction is paid
- **WHEN** a sanction has `Fine: 100` and `AmountPaid: 100`
- **THEN** its transaction has status `Paid`

#### Scenario: Sanction with no payment recorded is pending for the whole fine
- **WHEN** a sanction has `Fine: 50` and a null `AmountPaid`
- **THEN** its transaction has status `Pending` and an outstanding amount of `50`

#### Scenario: Lottery book not returned is pending
- **WHEN** a lottery book has no `AmountReturned`
- **THEN** its transaction has status `Pending` and an outstanding amount equal to the campaign `TicketPrice` multiplied by `TicketsPerBook`

#### Scenario: Lottery book with a returned amount is paid
- **WHEN** a lottery book has `AmountReturned` informed
- **THEN** its transaction has status `Paid` and its amount equals `AmountReturned`

#### Scenario: Unpaid quiniela ticket past its deadline stays pending
- **WHEN** a quiniela ticket is unpaid and its payment deadline has passed
- **THEN** its transaction has status `Pending` and the response contains no `Expired` status

#### Scenario: Paid quiniela ticket is paid
- **WHEN** a quiniela ticket is paid by cash, Bizum or wallet
- **THEN** its transaction has status `Paid` and its amount equals the jornada `Price`

#### Scenario: Wallet top-ups and charges are always paid
- **WHEN** a team's wallet has a `TopUp` and a `TicketCharge` movement
- **THEN** both transactions have status `Paid`

### Requirement: A sanction payment is listed only once
A payment recorded on a sanction SHALL appear as part of that sanction's transaction only. A `TeamFundMovement` whose source is `SanctionPayment` SHALL NOT be listed as a separate transaction.

#### Scenario: Sanction payment fund movement is excluded
- **WHEN** a sanction has `AmountPaid: 40` and a linked `TeamFundMovement` with source `SanctionPayment`
- **THEN** the list contains exactly one transaction for the sanction and none for the fund movement

### Requirement: Transactions are ordered by date and filterable
The list SHALL be ordered by transaction date, from the most recent to the oldest. The endpoint SHALL accept optional `status` (`Pending` or `Paid`) and `type` (`Sanction`, `Lottery`, `Quiniela`, `WalletTopUp` or `WalletCharge`) query filters, applied together when both are given. A `status` or `type` value outside those sets SHALL return `400 Bad Request` as `ProblemDetails`.

#### Scenario: Newest transaction comes first
- **WHEN** a team has transactions dated 1 March, 5 March and 3 March
- **THEN** the list orders them 5 March, 3 March, 1 March

#### Scenario: Ordering mixes transaction types by their source dates
- **WHEN** a team has a sanction with `StartDate` 1 March, a paid ticket with `PaidAt` 5 March and a wallet top-up with `OccurredAt` 3 March
- **THEN** the list orders them as the ticket, the top-up and the sanction

#### Scenario: Transaction without a date is ordered last
- **WHEN** a quiniela ticket is unpaid and no payment deadline can be derived for its round, and the team also has a dated sanction
- **THEN** the sanction is listed before the ticket

#### Scenario: Filter by status
- **WHEN** a user calls the endpoint with `status=Pending`
- **THEN** the list contains only transactions with status `Pending`

#### Scenario: Filter by type
- **WHEN** a user calls the endpoint with `type=Lottery`
- **THEN** the list contains only `Lottery` transactions

#### Scenario: Filters combine
- **WHEN** a user calls the endpoint with `status=Paid` and `type=Sanction`
- **THEN** the list contains only paid sanction transactions

#### Scenario: Unknown filter value is rejected
- **WHEN** a user calls the endpoint with `status=Expired`
- **THEN** the system returns `400 Bad Request` with a `ProblemDetails` body

### Requirement: A team without transactions returns an empty list
When the team has no transaction, the endpoint SHALL return `200 OK` with an empty list, and the page SHALL show an empty-list message instead of an error.

#### Scenario: Endpoint returns an empty list
- **WHEN** an authorized user calls the endpoint for a team with no sanctions, lottery books, quiniela tickets, wallet movements or quiniela fund movements
- **THEN** the system returns `200 OK` with an empty list

#### Scenario: Page shows an empty-list message
- **WHEN** the transactions page loads a team with no transactions
- **THEN** it shows an empty-list message and no error message

### Requirement: Access is limited to members of the team, and players and family members see only their own transactions
The endpoint SHALL require authentication and SHALL return the list only to a user who belongs to the requested team: a user linked to the team as Coach, Player or Family member, or a coach or directive of the team's club. For any other team the system SHALL return `403 Forbidden` as `ProblemDetails`, without revealing any transaction. An unauthenticated request SHALL return `401 Unauthorized`.

A user who reaches the team only as Player or Family member (not as Coach of the team and not as coach or directive of the team's club) SHALL receive only their own transactions: the `Quiniela` tickets and the `WalletTopUp` and `WalletCharge` movements whose participant or wallet owner is that user, and the `Sanction` and `Lottery` transactions of the player they are linked to (for a Player, their own player record; for a Family member, the players they are linked to as family). Quiniela fund movements, which identify no person, SHALL NOT be returned to them. The status and type filters SHALL apply on top of this restriction. A Coach of the team and a coach or directive of the team's club SHALL receive the whole team's transactions.

#### Scenario: Member of the team can read the list
- **WHEN** a user linked to the team as Player calls the endpoint for that team
- **THEN** the system returns `200 OK` with only that player's own transactions

#### Scenario: Player does not see other players' transactions
- **WHEN** a team has a sanction of player A and a sanction of player B, and the user linked as Player A calls the endpoint
- **THEN** the system returns only the transactions of player A and none of player B

#### Scenario: Player sees their own quiniela and wallet transactions only
- **WHEN** a team has a quiniela ticket and a wallet top-up of the calling user and the same of another participant
- **THEN** the system returns the calling user's ticket and top-up and none of the other participant's

#### Scenario: Family member sees the transactions of the linked player
- **WHEN** a user linked to the team as Family member of player A calls the endpoint and the team has sanctions of players A and B
- **THEN** the system returns the sanction of player A and not the sanction of player B

#### Scenario: Player and family members do not receive fund movements
- **WHEN** the team has quiniela fund movements and a user linked as Player or Family member calls the endpoint
- **THEN** the response contains no fund movement

#### Scenario: Team coach sees the whole team
- **WHEN** a user linked to the team as Coach calls the endpoint
- **THEN** the system returns the transactions of every player and participant of the team

#### Scenario: Coach of the team's club can read the list
- **WHEN** a coach of the club that owns the team calls the endpoint for that team
- **THEN** the system returns `200 OK`

#### Scenario: User of another team is denied
- **WHEN** an authenticated user who does not belong to the requested team calls the endpoint
- **THEN** the system returns `403 Forbidden` with a `ProblemDetails` body and no transaction data

#### Scenario: Unauthenticated request is rejected
- **WHEN** a request without credentials calls the endpoint
- **THEN** the system returns `401 Unauthorized`

### Requirement: The coach app shows transactions in a responsive card list
The coach web app SHALL provide a page at the route `/coach/transactions`, loaded lazily and protected by the same feature-permission guard as the sanctions route. The page SHALL read the team from the `teamId` query parameter and fall back to the current user's resolved team when it is absent. It SHALL show each transaction as a stacked card with the person involved, the type, the amount, the date and the status, and SHALL NOT use a table or fixed-column grid. The status SHALL be shown as «Pendiente de pago» for `Pending` and «Pagado» for `Paid`; a `Pending` card SHALL show the outstanding amount. The page SHALL offer status and type filters. The page SHALL read the data through a service module and SHALL NOT call Axios directly. When loading fails, the page SHALL show an error message.

#### Scenario: Transactions are shown as cards with translated status
- **WHEN** the page loads a team with a paid quiniela ticket and a pending sanction
- **THEN** it shows one card per transaction, the first labelled «Pagado» and the second labelled «Pendiente de pago» with its outstanding amount

#### Scenario: Status filter narrows the cards
- **WHEN** the user selects the pending status filter
- **THEN** only cards labelled «Pendiente de pago» are shown

#### Scenario: Type filter narrows the cards
- **WHEN** the user selects the lottery type filter
- **THEN** only lottery cards are shown

#### Scenario: Layout works on a narrow screen
- **WHEN** the page is viewed on a viewport of about 360 px
- **THEN** the cards stack vertically with no horizontal scrolling and no table is rendered

#### Scenario: Load failure shows an error
- **WHEN** the transactions request fails, including with access denied
- **THEN** the page shows an error message and no transaction cards
