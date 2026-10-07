## ADDED Requirements

### Requirement: Coaches manage lottery campaigns per team
The system SHALL let users with `ReadWrite` on the `Lottery` feature create, update and delete a `LotteryCampaign` for a team through `/api/teams/{teamId}/lottery-campaigns`, with a name, draw date, ticket price, tickets per book and a club delivery window. Price and tickets per book SHALL NOT change once the campaign has books, and a campaign with books SHALL NOT be deleted.

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

### Requirement: Coaches deliver numbered books to players
The system SHALL register a book delivery with `POST /{campaignId}/books` and `{ teamPlayerId, bookNumber, firstTicketNumber, deliveredOn? }`, defaulting `deliveredOn` to today. The book's last ticket number SHALL be `firstTicketNumber + ticketsPerBook − 1`. Book numbers SHALL be unique within the campaign, ticket ranges SHALL NOT overlap, and a player MAY hold several books.

#### Scenario: Deliver a book
- **WHEN** a coach delivers book 12 starting at ticket 166 to a player of the team in a 15-ticket campaign
- **THEN** the campaign shows that book with range 166–180, today's delivery date and no return

#### Scenario: Duplicated book number
- **WHEN** a coach delivers a book whose number is already used in the campaign
- **THEN** the system returns `400` with code `LotteryBookNumberDuplicated`

#### Scenario: Overlapping range
- **WHEN** a coach delivers a book whose ticket range overlaps another book of the campaign
- **THEN** the system returns `400` with code `LotteryTicketRangeOverlap`

#### Scenario: Player outside the team
- **WHEN** the `teamPlayerId` does not belong to the team
- **THEN** the system returns `404` with code `TeamPlayerNotFound`

#### Scenario: Second book for the same player
- **WHEN** a coach delivers another book to a player who already holds one
- **THEN** both books are listed for that player

### Requirement: Coaches register book returns by money collected
The system SHALL register a return with `PUT /{campaignId}/books/{bookId}/return` and `{ amount, returnedOn? }`, defaulting `returnedOn` to today. The amount SHALL be a multiple of the ticket price between `0` and `ticketPrice × ticketsPerBook`. Tickets sold SHALL be `amount / ticketPrice` and unsold tickets SHALL be `ticketsPerBook − sold`. A return SHALL be undoable with `DELETE /{campaignId}/books/{bookId}/return`, and a returned book SHALL NOT be deleted until its return is undone.

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
- **WHEN** a coach undoes the return of a returned book
- **THEN** the book is pending again with no amount and no return date

### Requirement: Campaign totals are computed
Every campaign response SHALL include totals computed from its books: books delivered, returned and pending; tickets delivered, sold, unsold and pending; amount collected (sum of returned amounts) and amount pending (pending tickets × price).

#### Scenario: Totals after deliveries and returns
- **WHEN** a 5 €, 15-ticket campaign has three books and two were returned with 75 € and 40 €
- **THEN** the totals are 3 delivered, 2 returned, 1 pending, 45 tickets delivered, 23 sold, 7 unsold, 15 pending, 115 € collected and 75 € pending

### Requirement: Coaches record the settlement with the club
The system SHALL record the delivery of the money to the club with `PUT /{campaignId}/club-delivery` and `{ amount, deliveredOn? }`, and SHALL undo it with `DELETE /{campaignId}/club-delivery`. The amount MAY differ from the amount collected.

#### Scenario: Settle with the club
- **WHEN** a coach records 115 € delivered to the club on 2026-12-10
- **THEN** the campaign shows `clubDeliveredOn = 2026-12-10` and `clubDeliveredAmount = 115`

### Requirement: Lottery access follows the Lottery feature permission
All lottery endpoints SHALL require the `Lottery` feature permission (`Read` for queries, `ReadWrite` for writes) and team membership. Users with the Player or FamilyMember role SHALL only see the books of their linked player, the totals of those books and `canEdit = false`.

#### Scenario: Player cannot write
- **WHEN** a Player calls any lottery write endpoint
- **THEN** the system returns `403`

#### Scenario: Player sees only own books
- **WHEN** a Player reads a campaign with books for several players
- **THEN** the response contains only the books of the Player's linked team player and totals computed over them

### Requirement: Lottery page is fast to use on mobile
The coach app SHALL replace the empty `coach/lottery` page with a mobile-first page without tables. It SHALL show the totals and one card per player, ordered by dorsal, with the book number and ticket range always visible. Status filters (without book, pending return, returned) SHALL show counts. The search SHALL match, in this priority order, an exact dorsal, then the alias, then the first name and surnames, ignoring case and accents, and SHALL list results grouped in that order. Bottom sheets SHALL register a delivery with suggested book and ticket numbers and today's date, and a return with one-tap «Todo vendido» and «Nada vendido» buttons and ±price steps. Read-only users SHALL see no actions.

#### Scenario: Deliver from a player card
- **WHEN** a coach taps a player without a book and confirms the delivery sheet without changes
- **THEN** the service is called with the suggested book number, the suggested first ticket and today's date, and the card shows the new book number

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
