## ADDED Requirements

### Requirement: Lottery books move through a five-step status lifecycle
Every `LotteryBook` SHALL store a `Status` with exactly five values in this order: `Unassigned`, `Assigned`, `DeliveredToPlayer`, `ReturnedToCoach`, `DeliveredToClub`. The status SHALL be persisted as text and SHALL NOT be derived from the returned amount. A book SHALL advance only one step at a time with `PUT /{campaignId}/books/{bookId}/status` and `{ date?, amount? }`, where `date` defaults to today: from `Assigned` to `DeliveredToPlayer` storing the delivery date, from `DeliveredToPlayer` to `ReturnedToCoach` storing the return date and the returned amount, and from `ReturnedToCoach` to `DeliveredToClub` storing the club delivery date. An unassigned book SHALL have no player, and a book in `Assigned` or any later status SHALL always have a player. Each move made from the wrong status SHALL fail with `400` and its own error code.

#### Scenario: Deliver an assigned book to its player
- **WHEN** a coach advances an `Assigned` book with date 2026-12-01
- **THEN** the book is `DeliveredToPlayer` with `deliveredOn = 2026-12-01`

#### Scenario: Return a delivered book to the coach
- **WHEN** a coach advances a `DeliveredToPlayer` book of a 5 €, 15-ticket campaign with amount 60
- **THEN** the book is `ReturnedToCoach` with 60 € returned, 12 tickets sold, 3 unsold and today's return date

#### Scenario: Deliver a returned book to the club
- **WHEN** a coach advances a `ReturnedToCoach` book with date 2026-12-10
- **THEN** the book is `DeliveredToClub` with `clubDeliveredOn = 2026-12-10`

#### Scenario: An unassigned book cannot skip the assignment
- **WHEN** a coach advances an `Unassigned` book
- **THEN** the system returns `400` with code `LotteryBookNotAssigned`

#### Scenario: A book delivered to the club has no next step
- **WHEN** a coach advances a `DeliveredToClub` book
- **THEN** the system returns `400` with code `LotteryBookNoNextStatus`

#### Scenario: Return before delivery is rejected
- **WHEN** a coach advances a `DeliveredToPlayer` book delivered on 2026-12-05 with return date 2026-12-01
- **THEN** the system returns `400` with code `LotteryReturnBeforeDelivery`

### Requirement: Undoing a book step removes only that step's data
The system SHALL move a book back exactly one step with `DELETE /{campaignId}/books/{bookId}/status`. Undoing `Assigned` SHALL remove the player and return the book to `Unassigned`; undoing `DeliveredToPlayer` SHALL remove the delivery date; undoing `ReturnedToCoach` SHALL remove the return date and the returned amount; undoing `DeliveredToClub` SHALL remove the club delivery date. Undoing an `Unassigned` book SHALL fail with `400` and code `LotteryBookNothingToUndo`.

#### Scenario: Undo a club delivery
- **WHEN** a coach undoes a `DeliveredToClub` book
- **THEN** the book is `ReturnedToCoach` with no club delivery date and its returned amount and return date unchanged

#### Scenario: Undo an assignment
- **WHEN** a coach undoes an `Assigned` book
- **THEN** the book is `Unassigned` with no player

#### Scenario: Nothing to undo on an unassigned book
- **WHEN** a coach undoes an `Unassigned` book
- **THEN** the system returns `400` with code `LotteryBookNothingToUndo`

### Requirement: Coaches create unassigned books in bulk
The system SHALL create books with `POST /{campaignId}/books/batch` and `{ count }`, returning `201` with the campaign. `count` SHALL be between 1 and 200. The books SHALL be `Unassigned`, numbered consecutively after the highest existing book number (starting at 1), and their ranges SHALL start after the highest existing last ticket (starting at ticket 1), each with the campaign's tickets per book.

#### Scenario: Create books in an empty campaign
- **WHEN** a coach creates 3 books in a 15-ticket campaign without books
- **THEN** the campaign has unassigned books 1, 2 and 3 with ranges 1–15, 16–30 and 31–45

#### Scenario: Create books after existing ones
- **WHEN** a coach creates 2 books in a 10-ticket campaign whose last book is number 4 ending at ticket 52
- **THEN** books 5 and 6 are created with ranges 53–62 and 63–72

#### Scenario: Count out of range
- **WHEN** a coach asks to create 0 or 201 books
- **THEN** the system returns `400`

### Requirement: Coaches assign numbered books to players
The system SHALL assign a book with `POST /{campaignId}/books` and `{ bookId?, teamPlayerId, bookNumber, firstTicketNumber, lastTicketNumber }`. With `bookId` it SHALL assign that `Unassigned` book and store the given numbers; without `bookId` it SHALL create the book already `Assigned`. The last ticket SHALL be stored and SHALL NOT be lower than the first ticket. Book numbers SHALL be unique within the campaign, ticket ranges SHALL NOT overlap, and books of one campaign MAY have different sizes. A player MAY hold any number of books and MAY receive another book at any time, including after returning a previous one.

#### Scenario: Assign an unassigned book
- **WHEN** a coach assigns unassigned book 12 with range 166–180 to a player of the team
- **THEN** the book is `Assigned` to that player with range 166–180 and no delivery date

#### Scenario: Assign a new book of a different size
- **WHEN** a coach assigns, without `bookId`, book 13 with range 181–190 in a 15-ticket campaign
- **THEN** the campaign shows book 13 `Assigned` with range 181–190 and 10 tickets

#### Scenario: Last ticket lower than the first
- **WHEN** a coach assigns a book with first ticket 50 and last ticket 40
- **THEN** the system returns `400`

#### Scenario: Assigning an already assigned book
- **WHEN** a coach assigns a book that is not `Unassigned`
- **THEN** the system returns `400` with code `LotteryBookNotUnassigned`

#### Scenario: Duplicated book number
- **WHEN** a coach assigns a book whose number is already used in the campaign
- **THEN** the system returns `400` with code `LotteryBookNumberDuplicated`

#### Scenario: Overlapping range
- **WHEN** a coach assigns a book whose stored ticket range overlaps another book of the campaign
- **THEN** the system returns `400` with code `LotteryTicketRangeOverlap`

#### Scenario: Player outside the team
- **WHEN** the `teamPlayerId` does not belong to the team
- **THEN** the system returns `404` with code `TeamPlayerNotFound`

#### Scenario: Another book after a return
- **WHEN** a coach assigns a new book to a player whose previous book is `ReturnedToCoach`
- **THEN** both books are listed for that player

### Requirement: Book numbers are editable only before delivery and only unassigned books are deleted
The system SHALL edit a book's number, first ticket and last ticket with `PUT /{campaignId}/books/{bookId}` only while the book is not yet delivered to the player, applying the same range, uniqueness and overlap rules as the assignment; otherwise it SHALL return `400` with code `LotteryBookNumbersLocked`. The system SHALL delete a book with `DELETE /{campaignId}/books/{bookId}` only when it is `Unassigned`; otherwise it SHALL return `400` with code `LotteryBookNotUnassigned`.

#### Scenario: Edit an assigned book
- **WHEN** a coach changes the last ticket of an `Assigned` book from 180 to 175
- **THEN** the book keeps its player and shows range 166–175

#### Scenario: Numbers locked after delivery
- **WHEN** a coach edits the numbers of a `DeliveredToPlayer` book
- **THEN** the system returns `400` with code `LotteryBookNumbersLocked`

#### Scenario: Delete an assigned book
- **WHEN** a coach deletes an `Assigned` book
- **THEN** the system returns `400` with code `LotteryBookNotUnassigned`

### Requirement: Club delivery is tracked per book
The system SHALL record the club delivery on each book as its `ClubDeliveredOn` through the `DeliveredToClub` step, and SHALL NOT keep a campaign-level club delivery date or amount. Every campaign response SHALL include a `clubDelivery` summary computed from the books in `ReturnedToCoach` or `DeliveredToClub`: books delivered to the club, books pending delivery, the returned amount of the books delivered, the returned amount of the books pending, and the latest club delivery date.

#### Scenario: Club delivery summary
- **WHEN** a campaign has one book `DeliveredToClub` with 75 € on 2026-12-10 and one book `ReturnedToCoach` with 40 €
- **THEN** `clubDelivery` shows 1 book delivered for 75 €, 1 book pending for 40 € and `lastDeliveredOn = 2026-12-10`

### Requirement: Existing lottery data is migrated to the status lifecycle
The `LotteryBookStatusLifecycle` migration SHALL set each existing book's last ticket to `firstTicketNumber + ticketsPerBook − 1` of its campaign, SHALL set the status to `ReturnedToCoach` when the book has a returned amount and to `DeliveredToPlayer` otherwise, and, when the campaign had a club delivery date, SHALL set its returned books to `DeliveredToClub` with that date. It SHALL then drop the campaign's club delivery date and amount.

#### Scenario: Migrate a settled campaign
- **WHEN** the migration runs on a 15-ticket campaign settled with the club on 2026-12-10 that has a returned book starting at ticket 1 and a pending book
- **THEN** the returned book becomes `DeliveredToClub` with range 1–15 and `clubDeliveredOn = 2026-12-10`, and the pending book becomes `DeliveredToPlayer`

## MODIFIED Requirements

### Requirement: Coaches manage lottery campaigns per team
The system SHALL let users with `ReadWrite` on the `Lottery` feature create, update and delete a `LotteryCampaign` for a team through `/api/teams/{teamId}/lottery-campaigns`, with a name, draw date, ticket price, tickets per book and a club delivery window. Tickets per book SHALL be only the suggested size for new books and MAY change when the campaign has books. The ticket price SHALL NOT change once the campaign has books. A campaign SHALL NOT be deleted while any of its books is in a status other than `Unassigned`.

#### Scenario: Create a campaign
- **WHEN** a coach creates «Lotería de Navidad 2026» with draw date 2026-12-22, price 5, 15 tickets per book and club window 2026-12-09 to 2026-12-15
- **THEN** the system returns `201` with the campaign, no books and all totals at zero

#### Scenario: Invalid club window
- **WHEN** the club window ends after the draw date or starts after it ends
- **THEN** the system returns `400` with code `LotteryInvalidClubDeliveryWindow`

#### Scenario: Club window can change mid-campaign
- **WHEN** a coach changes the club window of a campaign that already has books to 2026-12-12 to 2026-12-19
- **THEN** the system returns `200` with the new window and the books unchanged

#### Scenario: Price locked once books exist
- **WHEN** a coach changes the ticket price of a campaign that already has a book
- **THEN** the system returns `400` with code `LotteryCampaignHasBooks`

#### Scenario: Tickets per book can change once books exist
- **WHEN** a coach changes the tickets per book of a campaign that already has books from 15 to 10
- **THEN** the system returns `200` with 10 tickets per book and the existing books keep their stored ranges

#### Scenario: Delete a campaign with only unassigned books
- **WHEN** a coach deletes a campaign whose books are all `Unassigned`
- **THEN** the campaign is deleted

#### Scenario: Campaign with assigned books cannot be deleted
- **WHEN** a coach deletes a campaign that has an `Assigned` book
- **THEN** the system returns `400` with code `LotteryCampaignHasBooks`

### Requirement: Coaches register book returns by money collected
The system SHALL register a return as the `DeliveredToPlayer` → `ReturnedToCoach` step of `PUT /{campaignId}/books/{bookId}/status` with `{ amount, date? }`, defaulting the return date to today. The amount SHALL be a multiple of the ticket price between `0` and `ticketPrice × ticketCount`, where `ticketCount` is `lastTicketNumber − firstTicketNumber + 1` of that book. Tickets sold SHALL be `amount / ticketPrice` and unsold tickets SHALL be `ticketCount − sold`. A return SHALL be undoable with `DELETE /{campaignId}/books/{bookId}/status` while the book is `ReturnedToCoach`.

#### Scenario: Return with money
- **WHEN** a coach registers 60 € for a book of a 5 €, 15-ticket campaign
- **THEN** the book shows 12 tickets sold, 3 unsold and today's return date

#### Scenario: Amount not multiple of price
- **WHEN** a coach registers 62 € for a 5 € campaign
- **THEN** the system returns `400` with code `LotteryInvalidReturnAmount`

#### Scenario: Amount above book value
- **WHEN** a coach registers 80 € for a 5 €, 15-ticket book
- **THEN** the system returns `400` with code `LotteryInvalidReturnAmount`

#### Scenario: Undo a return
- **WHEN** a coach undoes the return of a `ReturnedToCoach` book
- **THEN** the book is `DeliveredToPlayer` again with no amount and no return date

### Requirement: Campaign totals are computed
Every campaign response SHALL include totals computed from its books, counting as delivered every book in `DeliveredToPlayer` or a later status and as returned every book in `ReturnedToCoach` or `DeliveredToClub`: books delivered, returned and pending; tickets delivered, sold, unsold and pending, using each book's own ticket count; amount collected (sum of returned amounts) and amount pending (pending tickets × price). `Unassigned` and `Assigned` books SHALL NOT count in the totals.

#### Scenario: Totals after deliveries and returns
- **WHEN** a 5 €, 15-ticket campaign has three books delivered to players and two were returned with 75 € and 40 €
- **THEN** the totals are 3 delivered, 2 returned, 1 pending, 45 tickets delivered, 23 sold, 7 unsold, 15 pending, 115 € collected and 75 € pending

#### Scenario: Books not yet delivered are not counted
- **WHEN** a campaign has one `Unassigned` book and one `Assigned` book
- **THEN** all totals are zero

### Requirement: Lottery page is fast to use on mobile
The coach app SHALL replace the empty `coach/lottery` page with a mobile-first page without tables. It SHALL show the totals, a list of unassigned books with assign and delete actions, and one card per player, ordered by dorsal, with the book number, ticket range and status of each book always visible. Status filters (without book, assigned, delivered to player, returned to coach, delivered to club, keyed by the least advanced book of each player) SHALL show counts. The search SHALL match, in this priority order, an exact dorsal, then the alias, then the first name and surnames, ignoring case and accents, and SHALL list results grouped in that order. A «Crear tacos» dialog SHALL create books in bulk. An «Asignar taco» sheet SHALL ask for the player, the book number, the first ticket and the last ticket, suggesting the next book number, the ticket after the highest last ticket and the first ticket plus tickets per book minus one, all editable. Each book card SHALL offer only its next step: a delivery sheet with today's date, a return sheet with one-tap «Todo vendido» and «Nada vendido» buttons and ±price steps, and a club delivery sheet with today's date; undoing a step SHALL ask for confirmation with `ConfirmDialog`. Read-only users SHALL see no actions.

#### Scenario: Assign from a player card
- **WHEN** a coach taps «Asignar» on a player without a book and confirms the assign sheet without changes
- **THEN** the service is called with that player, the suggested book number, the suggested first ticket and the suggested last ticket, and the card shows the new book as «Asignado»

#### Scenario: Quick full return
- **WHEN** a coach opens the return sheet of a book in a 5 €, 15-ticket campaign and taps «Todo vendido · 75 €»
- **THEN** the service is called with `amount = 75` and the card shows the book as returned with 15 tickets sold

#### Scenario: Search priority
- **WHEN** a coach types «7» and the roster has a player with dorsal 7 and another whose alias contains «7»
- **THEN** the player with dorsal 7 is listed first

#### Scenario: Search by surname
- **WHEN** a coach types «garci» and no dorsal or alias matches
- **THEN** players whose first name or surnames start with «García» are listed

#### Scenario: No campaign yet
- **WHEN** the team has no lottery campaign
- **THEN** the page shows an empty state with «Crear campaña», prefilled with the Christmas defaults

#### Scenario: Read-only view
- **WHEN** a Player opens the page
- **THEN** only their own books are shown and there are no delivery, return or club actions

#### Scenario: Undo asks for confirmation
- **WHEN** a coach chooses to undo the step of a book from its card menu
- **THEN** a `ConfirmDialog` names the data that will be removed and the status the book returns to, and the service is called only after confirming

#### Scenario: Last ticket follows the first ticket
- **WHEN** a coach changes the first ticket in the assign sheet of a 15-ticket campaign to 200 without having edited the last ticket
- **THEN** the last ticket shows 214

## REMOVED Requirements

### Requirement: Coaches deliver numbered books to players
**Reason**: Books now exist before they have a player and are handed out through the status lifecycle; the last ticket is stored per book instead of computed from the campaign size.
**Migration**: Use `Coaches assign numbered books to players` to assign a book and the `DeliveredToPlayer` step of `PUT /{campaignId}/books/{bookId}/status` to record the delivery date.

### Requirement: Coaches record the settlement with the club
**Reason**: Club delivery is tracked per book; the single campaign-level record and its `club-delivery` endpoints were removed.
**Migration**: Use the `DeliveredToClub` step of each book and the computed `clubDelivery` summary described in `Club delivery is tracked per book`; existing campaign club delivery dates are moved onto their returned books by the migration.
