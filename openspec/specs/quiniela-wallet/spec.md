# quiniela-wallet Specification

## Purpose
TBD - created by archiving change quiniela-wallet. Update Purpose after archive.
## Requirements
### Requirement: Each user has a wallet per team
The system SHALL keep one wallet per team and user, with a decimal balance that is never negative and a ledger of movements of type TopUp, Adjustment, TicketCharge or TicketRefund. A user without a wallet SHALL be treated as having a balance of 0.00.

#### Scenario: User without movements
- **WHEN** a participant requests their wallet and has never had a movement
- **THEN** the balance is 0.00 and the movement list is empty

#### Scenario: Wallets are per team
- **WHEN** a user is topped up in team A and requests the wallet in team B
- **THEN** the balance in team B is unchanged

### Requirement: The coach tops up a wallet
Only the team's coach SHALL top up the wallet of a member of the team with an amount greater than 0, at most 10.00 EUR and at most two decimals. The balance SHALL increase by the amount and a TopUp movement SHALL be recorded.

#### Scenario: Top up
- **WHEN** the coach tops up 5.00 to a player whose balance is 2.00
- **THEN** the balance is 7.00 and a TopUp movement of +5.00 is recorded

#### Scenario: Invalid amount
- **WHEN** the coach tops up 0 or a negative amount
- **THEN** the request is rejected with a validation ProblemDetails and the balance is unchanged

#### Scenario: Amount above the maximum
- **WHEN** the coach tops up 10.01
- **THEN** the request is rejected with a validation ProblemDetails and the balance is unchanged

#### Scenario: Target is not a team member
- **WHEN** the coach tops up a user who does not belong to the team
- **THEN** the request is rejected as not found

#### Scenario: Not the coach
- **WHEN** a player tops up a wallet
- **THEN** the request is rejected as forbidden

### Requirement: The coach subtracts balance with an adjustment
Only the team's coach SHALL subtract balance from a member's wallet with an adjustment of an amount greater than 0 and at most 10.00 EUR, and a reason. An adjustment SHALL NOT leave the balance negative.

#### Scenario: Adjustment within the balance
- **WHEN** the coach adjusts 3.00 on a balance of 5.00
- **THEN** the balance is 2.00 and an Adjustment movement of -3.00 with its reason is recorded

#### Scenario: Adjustment above the balance
- **WHEN** the coach adjusts 6.00 on a balance of 5.00
- **THEN** the request is rejected with a conflict ProblemDetails and the balance stays 5.00

### Requirement: The coach lists the wallets of the team
Only the team's coach SHALL list the members of the team (Coach, Player, FamilyPlayer) with their name, role and balance, and read the movements of any of them. A member without a wallet SHALL appear with balance 0.00. Each member row SHALL also carry the list of its associated players, each with the player's id and name, in the same response and without a new endpoint: the route `GET /api/teams/{teamId}/quiniela/wallets` and its parameters SHALL NOT change. Only players of the team being listed SHALL count as associated players. The associated players of a row SHALL be: for a FamilyPlayer, every player of the team that the family member is linked to through the family member link; for a Player, the player record linked to that user in the team, if any; for a Coach, none. A family member linked to several players of the team SHALL appear in one row with all of them. A player who has left the team (with a leaving date) SHALL be listed only when the row's user has something pending, meaning a wallet balance different from 0.00 or a ticket with pending payment in the team. When a user holds several participant roles in the team, the row role SHALL follow the precedence Coach, then Player, then FamilyPlayer.

#### Scenario: List
- **WHEN** the coach requests the wallets of the team
- **THEN** every participant of the team appears with their balance

#### Scenario: Not the coach
- **WHEN** a family member requests the wallets of the team
- **THEN** the request is rejected as forbidden

#### Scenario: Family member linked to several players
- **WHEN** the coach requests the wallets and a family member is linked to two players of the team
- **THEN** that family member appears in one row whose associated players are both players

#### Scenario: Family member linked to players of other teams
- **WHEN** a family member is linked to one player of the requested team and to one player of another team
- **THEN** the row of that family member lists only the player of the requested team

#### Scenario: Family member without linked players
- **WHEN** a family member of the team has no linked player in the requested team
- **THEN** the row still appears, with an empty list of associated players

#### Scenario: Family member without wallet
- **WHEN** a family member has no wallet
- **THEN** the row appears with balance 0.00 and with its associated players

#### Scenario: Player row
- **WHEN** the coach requests the wallets and a player user is linked to a player record of the team
- **THEN** the row of that user has that player as its only associated player

#### Scenario: Player user without a linked player record
- **WHEN** a player user of the team has no linked player record
- **THEN** the row appears with an empty list of associated players

#### Scenario: Coach row
- **WHEN** the coach requests the wallets
- **THEN** the rows with the role Coach have an empty list of associated players, even if that user is linked as family member of a player

#### Scenario: Departed player with nothing pending
- **WHEN** a family member is linked to a player who left the team, and has balance 0.00 and no unpaid ticket
- **THEN** that player is not listed among the associated players

#### Scenario: Departed player with something pending
- **WHEN** a family member is linked to a player who left the team, and has a non-zero balance or an unpaid ticket
- **THEN** that player is still listed

#### Scenario: User with several roles
- **WHEN** a user holds both the Coach and the FamilyPlayer role in the team
- **THEN** the row shows the role Coach and an empty list of associated players

### Requirement: A participant sees their own wallet
A participant (Coach, Player or FamilyPlayer) SHALL see their current balance and their movements, newest first and paginated. Nobody except the coach SHALL see the wallet of another user.

#### Scenario: Own history
- **WHEN** a player requests their wallet after a top up and a ticket charge
- **THEN** the balance reflects both and the movements list both, newest first

#### Scenario: Other roles
- **WHEN** a Follower requests a wallet
- **THEN** the request is rejected as forbidden

### Requirement: Saving a new ticket charges the wallet all or nothing
When a participant creates a ticket and the wallet balance is greater than or equal to the jornada price, the system SHALL subtract the price, mark the ticket as Paid with method Wallet and record a TicketCharge movement linked to the ticket, all in the same transaction. If the balance is lower, the ticket SHALL stay Pending and the balance SHALL NOT change (no partial charge). The response SHALL state whether and how much was charged and the resulting balance.

#### Scenario: Enough balance
- **WHEN** a participant with balance 3.00 saves a new ticket in a jornada priced 1.00
- **THEN** the ticket is Paid with method Wallet, the balance is 2.00 and the response reports a charge of 1.00

#### Scenario: Exact balance
- **WHEN** a participant with balance 1.00 saves a new ticket priced 1.00
- **THEN** the ticket is Paid and the balance is 0.00

#### Scenario: Insufficient balance
- **WHEN** a participant with balance 0.50 saves a new ticket priced 1.00
- **THEN** the ticket is Pending, the balance stays 0.50 and the response reports no charge

#### Scenario: No wallet
- **WHEN** a participant without a wallet saves a ticket
- **THEN** the ticket is Pending and no wallet is created

#### Scenario: Ticket rejected
- **WHEN** the save is rejected (picks closed, invalid ticket)
- **THEN** the balance is unchanged and no movement is recorded

### Requirement: Editing a pending ticket also tries to charge the wallet
When a participant replaces the picks of a ticket that is Pending and not expired, the system SHALL apply the same all-or-nothing charge. A ticket that is already Paid SHALL NOT be charged again, and an expired ticket SHALL NOT be charged.

#### Scenario: Pending ticket after a top up
- **WHEN** a participant with a pending ticket is topped up and then edits that ticket
- **THEN** the ticket is charged once and becomes Paid with method Wallet

#### Scenario: Already paid
- **WHEN** a participant edits a ticket already Paid
- **THEN** the balance is unchanged

#### Scenario: Expired
- **WHEN** a participant edits a ticket that is expired
- **THEN** it is not charged and stays expired

### Requirement: A participant pays a pending ticket from the wallet
A participant SHALL be able to pay one of their own tickets that is Pending, not expired and whose picks are still open, with an explicit action. The charge SHALL be all or nothing: with enough balance the price is subtracted, the ticket becomes Paid with method Wallet and a TicketCharge movement is recorded; otherwise the request SHALL be rejected with a conflict ProblemDetails and the ticket SHALL stay Pending. A ticket that is Paid or expired, or whose picks are closed, SHALL be rejected.

#### Scenario: Pay with enough balance
- **WHEN** a participant with balance 2.00 pays a pending ticket priced 1.00 from the wallet
- **THEN** the ticket is Paid with method Wallet, the balance is 1.00 and the response reports the charge

#### Scenario: Insufficient balance
- **WHEN** a participant with balance 0.50 pays a pending ticket priced 1.00 from the wallet
- **THEN** the request is rejected with a conflict ProblemDetails, the ticket stays Pending and the balance stays 0.50

#### Scenario: Already paid
- **WHEN** a participant pays from the wallet a ticket that is already Paid
- **THEN** the request is rejected and the balance is unchanged

#### Scenario: Expired ticket
- **WHEN** a participant pays from the wallet an expired ticket
- **THEN** the request is rejected and the balance is unchanged

#### Scenario: Picks closed
- **WHEN** the first valid match has started and a participant pays a pending ticket from the wallet
- **THEN** the request is rejected and the balance is unchanged

#### Scenario: Someone else's ticket
- **WHEN** a participant pays from the wallet a ticket that belongs to another user
- **THEN** the request is rejected as not found

#### Scenario: Double click
- **WHEN** the same pay request is sent twice at the same time
- **THEN** the ticket is charged once

### Requirement: Two simultaneous saves cannot spend the same balance twice
The system SHALL guarantee that concurrent charges on the same wallet never make the balance negative nor charge more than the balance covers. A save that loses the race SHALL be retried against the updated balance; if the balance no longer covers the price the ticket stays Pending.

#### Scenario: Two tickets, balance for one
- **WHEN** a participant with balance 1.00 saves two tickets at the same time
- **THEN** exactly one ticket is Paid, the other is Pending and the balance is 0.00

#### Scenario: Persistent conflict
- **WHEN** the retries are exhausted because of continuous concurrent changes
- **THEN** the request is rejected with a conflict ProblemDetails and nothing is charged

### Requirement: Deleting a wallet-paid ticket refunds the wallet
When a ticket paid with method Wallet is deleted by the coach, or discarded when the coach resets the jornada, the system SHALL add the amount that was charged to the owner's wallet and record one TicketRefund movement. A ticket SHALL be refunded at most once. Deleting a ticket paid by Cash or Bizum, or a pending ticket, SHALL NOT touch any wallet.

#### Scenario: Coach deletes a wallet-paid ticket
- **WHEN** the coach deletes a ticket that was paid from the wallet
- **THEN** the owner's balance increases by the charged amount and a TicketRefund movement is recorded

#### Scenario: Cash ticket deleted
- **WHEN** the coach deletes a ticket paid in cash
- **THEN** no wallet changes

#### Scenario: Reset of the jornada
- **WHEN** the coach resets a jornada with two wallet-paid tickets
- **THEN** each owner is refunded their charge

#### Scenario: Settled jornada
- **WHEN** the coach deletes a ticket of a settled jornada
- **THEN** the request is rejected and no refund is made

### Requirement: A participant deletes their own ticket while picks are open
A participant SHALL be able to delete their own ticket when it is pending, expired or paid with the wallet, while the picks of the jornada are still open (before the first valid kickoff) and the jornada is not settled. If the ticket was paid with the wallet, the charged amount SHALL be refunded to the wallet in the same operation. A ticket paid with Cash or Bizum SHALL NOT be deletable by the participant: the request SHALL be rejected with a conflict ProblemDetails and only the coach can delete it and return the money.

#### Scenario: Delete a wallet-paid ticket
- **WHEN** a participant deletes their ticket paid from the wallet before the first kickoff
- **THEN** the ticket is deleted and the charged amount is refunded with one TicketRefund movement

#### Scenario: Delete a pending ticket
- **WHEN** a participant deletes their pending ticket before the first kickoff
- **THEN** the ticket is deleted and no wallet changes

#### Scenario: Delete a cash or Bizum ticket
- **WHEN** a participant deletes their ticket paid in cash or by Bizum before the first kickoff
- **THEN** the request is rejected with a conflict ProblemDetails, the ticket is kept and no wallet changes

#### Scenario: Coach deletes a cash ticket
- **WHEN** the coach deletes a ticket paid in cash
- **THEN** the ticket is deleted and no wallet changes

#### Scenario: Picks closed
- **WHEN** a participant deletes a ticket after the first valid match has started
- **THEN** the request is rejected and no refund is made

#### Scenario: Someone else's ticket
- **WHEN** a participant deletes a ticket that belongs to another user
- **THEN** the request is rejected as not found

#### Scenario: Double delete
- **WHEN** the same delete request is sent twice
- **THEN** the refund is made only once

### Requirement: The wallet is shown in the quiniela pages
The Coach app SHALL show the participant a «Monedero» card with the balance and a movements history, and the coach a page with a card per user showing balance, top up and adjustment actions. All screens SHALL be responsive and use cards, never tables. After saving a ticket charged from the wallet, the participant SHALL see a notice with the amount charged and the remaining balance.

#### Scenario: Pay button on pending tickets
- **WHEN** a participant opens a pending ticket whose picks are open
- **THEN** a «Pagar con monedero» button is shown, disabled with the reason when the balance is lower than the price

#### Scenario: Notice after saving
- **WHEN** a participant saves a ticket that is charged from the wallet
- **THEN** a notice shows the amount charged and the new balance

#### Scenario: Participant history on mobile
- **WHEN** a participant opens the movements at a width of 360 px
- **THEN** the movements are shown as cards without horizontal scroll

#### Scenario: Coach adjusts with confirmation
- **WHEN** the coach confirms an adjustment in the confirmation dialog
- **THEN** the card of that user shows the new balance

### Requirement: The wallet balance is shown in the Coach app header
The Coach app header SHALL show the current user's wallet balance next to the team fund (piggy bank) indicator, visually distinct from it, whenever the quiniela is available for their team. The indicator SHALL NOT be shown in the Federation app, when indicators are hidden, or when the wallet cannot be loaded.

#### Scenario: Wallet and piggy bank are distinguishable
- **WHEN** a user whose team has the quiniela enabled opens the Coach app
- **THEN** the header shows a wallet button labelled «Monedero: X,XX €» (tooltip «Mi monedero») and, separately, the piggy bank button labelled «Hucha del equipo: X €» (tooltip «Hucha del equipo»)

#### Scenario: Wallet unavailable
- **WHEN** the wallet request fails (quiniela disabled, 403/404) or no team resolves
- **THEN** no wallet button is shown and the rest of the header is unaffected

#### Scenario: Hidden in Federation and selector
- **WHEN** the header is rendered in the Federation app or with indicators hidden
- **THEN** the wallet button is not shown

#### Scenario: Navigation
- **WHEN** the user presses the wallet button
- **THEN** the app navigates to the team's quiniela screen (`/coach/quiniela?teamId=...`)

#### Scenario: Balance refreshes after an operation
- **WHEN** a ticket is saved with a wallet charge, paid with the wallet, deleted with a refund, or the wallet is topped up or adjusted
- **THEN** the screen dispatches `rffm.quiniela_wallet_updated` and the header reloads the balance

### Requirement: The wallets list shows the associated players of each row
Each row of the coach's wallets list of a team SHALL show the associated players of that row inside its existing card. The card SHALL use the same responsive card layout as today, never a table. A row without associated players SHALL show no players area.

#### Scenario: Family member with one player
- **WHEN** the coach opens the wallets list and a family member row has one associated player
- **THEN** the card of that row shows the name of that player

#### Scenario: Family member with several players
- **WHEN** a family member row has three associated players
- **THEN** the card of that row shows the names of all three players, and the family member appears in a single card

#### Scenario: Player row
- **WHEN** a player user with a linked player record appears in the list
- **THEN** the card of that row shows the player's own name as associated player

#### Scenario: Coach row
- **WHEN** a coach row appears in the list
- **THEN** its card shows no associated players

#### Scenario: Family member without players
- **WHEN** a family member row has no associated players
- **THEN** its card is shown with its name, role and balance and without a players area

#### Scenario: Narrow screen
- **WHEN** the coach opens the list at a width of 360 px and a family member has several players
- **THEN** all the player names are readable inside the card and there is no horizontal scroll

### Requirement: The coach searches the wallets list by player or family member name
The coach's wallets list SHALL offer a search box that filters the rows already loaded, without any new call to the API. A row SHALL match when the text matches the name of the row's user or the name of any of the row's associated players. The comparison SHALL ignore upper and lower case, accents, and leading, trailing and repeated spaces in the text, except that the letter "ñ" SHALL be a different letter from "n" and SHALL NOT match it in either direction. The result SHALL be the union of all matching rows, each row shown once, in the order of the unfiltered list. A row that matches SHALL keep showing all of its associated players, not only the one that matched the text. With an empty search box (or only spaces) the list SHALL show every row. When the text matches no row, the list SHALL show a "no results" message that is different from the message "No hay participantes en el equipo" shown for a team without participants.

#### Scenario: Search by player name
- **WHEN** the coach searches the name of a player who has a user in the team and two family members
- **THEN** the list shows the row of that player and the rows of the two family members, and no other row

#### Scenario: Search by player name when the player has no user
- **WHEN** the coach searches the name of a player who has no user in the team but has one family member
- **THEN** the list shows the row of that family member only

#### Scenario: Search by family member name
- **WHEN** the coach searches the name of a family member linked to two players
- **THEN** the list shows the row of that family member with both players, not only the player whose name was typed or matched

#### Scenario: Text matching a player and a family member of another player
- **WHEN** the text matches the name of player A and the name of a family member of player B
- **THEN** the list shows the rows that match player A, the row of that family member, and each row only once even if it matches in more than one way

#### Scenario: Case, accents and spaces are ignored
- **WHEN** the coach types "  jOSE   perez " and a player is named "José Pérez"
- **THEN** the rows tied to "José Pérez" are shown

#### Scenario: The letter ñ is distinct from n
- **WHEN** the coach types "nino" and a player is named "Niño", or types "niño" and a player is named "Nino"
- **THEN** that player's rows are not shown

#### Scenario: Result count is announced
- **WHEN** the coach types text in the search box
- **THEN** the number of visible rows ("N resultados", or "0 resultados" when none) is announced to assistive technology through a status region

#### Scenario: Empty search box
- **WHEN** the coach clears the search box or it contains only spaces
- **THEN** every row of the list is shown

#### Scenario: No matches
- **WHEN** the text matches no row and the team has participants
- **THEN** the list shows a "no results" message, and it does not show "No hay participantes en el equipo"

#### Scenario: Team without participants
- **WHEN** the team has no participants
- **THEN** the list shows "No hay participantes en el equipo", with or without text in the search box

#### Scenario: Typing does not call the API
- **WHEN** the coach types and changes the search text
- **THEN** no additional request is sent to the API

