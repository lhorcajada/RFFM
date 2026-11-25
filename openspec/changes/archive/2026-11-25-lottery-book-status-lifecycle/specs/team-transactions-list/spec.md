## MODIFIED Requirements

### Requirement: Transaction sources and types
The list SHALL contain transactions of exactly these types, each projected from the source shown:

- `Sanction`: each `TeamPlayerSanction` of the team's players whose `Fine` is greater than zero.
- `Lottery`: each `LotteryBook` of a lottery campaign of the team whose status is `DeliveredToPlayer`, `ReturnedToCoach` or `DeliveredToClub`; `Unassigned` and `Assigned` books SHALL NOT be listed.
- `Quiniela`: each `QuinielaTicket` of a quiniela jornada of the team, and each `TeamFundMovement` of the team whose source is `QuinielaFund` or `QuinielaDonation`.
- `WalletTopUp`: each `QuinielaWalletMovement` of type `TopUp` in a quiniela wallet of the team.
- `WalletCharge`: each `QuinielaWalletMovement` of type `TicketCharge` in a quiniela wallet of the team.
- `QuinielaPrize`: each `QuinielaWalletMovement` of type `Prize` in a quiniela wallet of the team.

Quiniela wallet movements of any other type (`Adjustment`, `TicketRefund`, `Donation`) and sanctions without a fine SHALL NOT be listed. The person involved SHALL be the player for `Sanction` and `Lottery`, the participant for a quiniela ticket, and the wallet owner for `WalletTopUp`, `WalletCharge` and `QuinielaPrize`.

The transaction date SHALL come from the source as follows:

- `Sanction`: the sanction `StartDate`.
- `Lottery`: the book `ReturnedOn` when it is informed, otherwise the book `DeliveredOn`; a date without time counts as the start of that day for ordering.
- `Quiniela` ticket: the ticket `PaidAt` when it is paid and has one; otherwise (unpaid, or paid with no `PaidAt`) the payment deadline of its jornada's RFFM round. When no deadline can be derived, the transaction has no date and is ordered after every dated transaction.
- `Quiniela` fund movement, `WalletTopUp`, `WalletCharge` and `QuinielaPrize`: the movement `OccurredAt`.

#### Scenario: Each type takes its date from its own source field
- **WHEN** the list contains a sanction with `StartDate` 1 March, a returned lottery book with `ReturnedOn` 2 March and `DeliveredOn` 20 February, a paid ticket with `PaidAt` 3 March, and a wallet top-up with `OccurredAt` 4 March
- **THEN** their transaction dates are 1 March, 2 March, 3 March and 4 March respectively

#### Scenario: Unpaid ticket takes the payment deadline as its date
- **WHEN** a quiniela ticket is unpaid and its jornada's payment deadline is 6 March
- **THEN** its transaction date is 6 March

#### Scenario: Sanction without a fine is not listed
- **WHEN** a team has a sanction whose `Fine` is null or zero
- **THEN** the transactions list does not contain a transaction for that sanction

#### Scenario: Wallet movements other than top-ups, charges and prizes are not listed
- **WHEN** a team's wallet has movements of type `Adjustment`, `TicketRefund` and `Donation`
- **THEN** none of those movements appears in the transactions list

#### Scenario: Quiniela prize is listed as a quiniela prize transaction
- **WHEN** a team's wallet has a `Prize` movement of 25 described «Premio jornada 7»
- **THEN** the list contains one `QuinielaPrize` transaction with the wallet owner as the person involved, amount `25`, the movement `OccurredAt` as its date and description «Premio jornada 7»

#### Scenario: Quiniela prize without a description uses the default label
- **WHEN** a `Prize` movement has no description
- **THEN** its `QuinielaPrize` transaction has the description «Premio de la quiniela»

#### Scenario: Quiniela fund movements are listed as Quiniela transactions
- **WHEN** a team has a `TeamFundMovement` with source `QuinielaFund` or `QuinielaDonation`
- **THEN** the list contains a transaction of type `Quiniela` for it with status `Paid`

#### Scenario: Wallet top-up and charge are listed with their own types
- **WHEN** a team's wallet has a `TopUp` movement and a `TicketCharge` movement
- **THEN** the list contains one `WalletTopUp` and one `WalletCharge` transaction, each with the wallet owner as the person involved

#### Scenario: Ticket paid from the wallet is listed as ticket and as charge
- **WHEN** a quiniela ticket was paid from the wallet
- **THEN** the list contains one `Quiniela` transaction for the ticket and one `WalletCharge` transaction for the wallet charge

#### Scenario: Lottery books not yet delivered to a player are not listed
- **WHEN** a team's lottery campaign has an `Unassigned` book and an `Assigned` book
- **THEN** the transactions list contains no `Lottery` transaction for either book

### Requirement: Payment status is a typed two-value state computed per type
Every transaction SHALL have a status of exactly `Pending` or `Paid`, computed at query time and never persisted. No other status value, including `Partial` or `Expired`, SHALL be returned. The status SHALL be computed per type:

- `Sanction`: `Paid` when `AmountPaid` is at least `Fine`; otherwise `Pending`, including a partial payment. The outstanding amount SHALL be `Fine` minus `AmountPaid` (with a null `AmountPaid` counted as zero).
- `Lottery`: `Paid` when the book's `AmountReturned` is informed; otherwise `Pending`. The amount SHALL be `AmountReturned` when informed, and otherwise the campaign `TicketPrice` multiplied by the book's own ticket count (`LastTicketNumber − FirstTicketNumber + 1`).
- `Quiniela` ticket: `Paid` when its payment status is paid; otherwise `Pending`, including a ticket whose payment deadline has passed. The amount SHALL be the jornada `Price`.
- `Quiniela` fund movement, `WalletTopUp`, `WalletCharge` and `QuinielaPrize`: always `Paid`, because they are movements already made. The amount SHALL be the absolute value of the movement `Amount`.

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
- **THEN** its transaction has status `Pending` and an outstanding amount equal to the campaign `TicketPrice` multiplied by the book's own ticket count

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

#### Scenario: Quiniela prize is always paid
- **WHEN** a team's wallet has a `Prize` movement
- **THEN** its `QuinielaPrize` transaction has status `Paid` and its amount equals the absolute value of the movement `Amount`
