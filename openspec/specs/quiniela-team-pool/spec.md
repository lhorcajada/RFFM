# quiniela-team-pool Specification

## Purpose
TBD - created by archiving change quiniela-team-pool. Update Purpose after archive.
## Requirements
### Requirement: The coach opens the quiniela of a round
The system SHALL let the team's coach open one quiniela per team and RFFM round. Players and family members SHALL see a "not open yet" state until it is opened.

#### Scenario: Coach opens the next round
- **WHEN** the coach opens the quiniela and the team has a next round
- **THEN** a jornada is created with price 1.00 and the previous jornada's carry-over as its initial pot

#### Scenario: Round already open
- **WHEN** the coach opens a round that already has a quiniela
- **THEN** the request is rejected with a conflict ProblemDetails

#### Scenario: Participant before opening
- **WHEN** a player requests the current quiniela and none is open
- **THEN** the response indicates it is not open

### Requirement: Players, family members and the coach fill a ticket
A member with role Player, FamilyPlayer or Coach SHALL save one ticket per jornada with a sign (1, X or 2) for each valid match and the goals (0, 1, 2 or M) of each team in the Pleno, which is the last valid match by date and time. Saving again SHALL replace the previous picks.

#### Scenario: Save a ticket
- **WHEN** a participant saves picks for the valid matches before the first kickoff
- **THEN** the ticket is stored as pending payment

#### Scenario: Edit before kickoff
- **WHEN** the participant saves again before the first kickoff
- **THEN** the picks are replaced and the payment status is unchanged

#### Scenario: Locked after kickoff
- **WHEN** the first valid match has started and a participant saves a ticket
- **THEN** the request is rejected

#### Scenario: Other roles
- **WHEN** a Follower saves a ticket
- **THEN** the request is rejected as forbidden

### Requirement: Postponed or suspended matches do not count
Matches that are postponed or suspended SHALL NOT be pickable and SHALL NOT count as hit or miss, even if played on another date.

#### Scenario: Postponed match listed
- **WHEN** a participant opens the quiniela and a match is postponed
- **THEN** the match is shown as not counting and has no pick

#### Scenario: Postponed after saving
- **WHEN** a match with a saved pick is postponed
- **THEN** it is ignored when counting hits

### Requirement: Tickets cost 1 euro and must be paid before Friday
Each ticket SHALL cost 1.00 EUR. A ticket still pending after Friday 23:59 (Madrid time) of the week of the first match SHALL be shown as expired and SHALL NOT take part in the prize distribution.

#### Scenario: Pending within the deadline
- **WHEN** a ticket is pending on Wednesday
- **THEN** it is shown as pending payment with the deadline

#### Scenario: Expired
- **WHEN** a ticket is pending after Friday 23:59
- **THEN** it is shown as expired and excluded from the distribution

### Requirement: The coach manages the pot and payments
Only the team's coach SHALL list the jornada's tickets with totals (collected, pending, prizes, team fund), mark a ticket as paid (Cash or Bizum) or pending, and see the pot movements. A ticket paid from the wallet SHALL count as collected. Marking a wallet-paid ticket as pending, or as paid by another method, SHALL refund the wallet charge to its owner.

#### Scenario: Mark as paid
- **WHEN** the coach marks a pending ticket as paid
- **THEN** the collected total increases by 1.00 and the pending total decreases by 1.00

#### Scenario: Not the coach
- **WHEN** a player requests the payments of the jornada
- **THEN** the request is rejected as forbidden

#### Scenario: Wallet-paid ticket counts as collected
- **WHEN** a ticket is paid from the wallet
- **THEN** the collected total includes its price and the ticket shows the method Wallet

#### Scenario: Wallet-paid ticket back to pending
- **WHEN** the coach marks a wallet-paid ticket as pending
- **THEN** the ticket is pending and the owner is refunded the charge

#### Scenario: Wallet is not a manual method
- **WHEN** the coach marks a ticket as paid with method Wallet
- **THEN** the request is rejected with a validation ProblemDetails

### Requirement: Settlement follows the official quiniela
The coach SHALL settle a jornada once all valid matches are final. Prize categories are: Especial (all valid signs and exact Pleno), 1st (all valid signs), 2nd (one miss) and 3rd (two misses). The prize pool SHALL equal 55 % of the collected amount plus the carry-over, and each category SHALL receive pool x weight / 38.5 with the official weights adapted to four categories and rescaled (Especial 7.5, 1st 16, 2nd 7.5, 3rd 7.5). Each category's prize is split equally among its paid, non-expired winners and truncated to the cent; rounding remainders become the carry-over. An empty Especial or 1st category SHALL become carry-over; an empty 2nd category SHALL add its amount to the 3rd; an empty 3rd category (including what it received from the 2nd) SHALL become carry-over. The prize of a category SHALL NOT exceed the prize of a higher category with winners: when it would, both funds are added and split among the winners of both categories. The remaining 45 % SHALL be added to the team fund.

#### Scenario: Winner in first category
- **WHEN** one paid ticket hits all valid signs and no ticket hits the exact Pleno, with 20.00 EUR collected
- **THEN** that ticket receives 4.57 EUR (16/38.5 of the 11.00 pool) and the rest is carry-over

#### Scenario: Empty Especial or first category
- **WHEN** no ticket qualifies for the Especial or the 1st category
- **THEN** its prize becomes carry-over for the next jornada

#### Scenario: Empty second category
- **WHEN** no ticket qualifies for the 2nd category and a ticket qualifies for the 3rd
- **THEN** the 2nd category amount is added to the 3rd category prize

#### Scenario: Empty third category
- **WHEN** no ticket qualifies for the 3rd category
- **THEN** its prize, including any amount received from the 2nd category, becomes carry-over

#### Scenario: Lower prize would exceed a higher one
- **WHEN** one ticket qualifies for Especial (2.14 EUR) and one for the 1st (4.57 EUR) with an 11.00 pool
- **THEN** both funds are added and each ticket receives 3.35 EUR

#### Scenario: Unfinished matches
- **WHEN** the coach settles while a valid match is not final
- **THEN** the request is rejected

#### Scenario: Team fund
- **WHEN** a jornada with 8.00 EUR collected is settled
- **THEN** a team fund movement of 3.60 EUR is created

### Requirement: The quiniela pages are responsive and show the rules
The participant page SHALL show the rules in a dialog opened from a "Ver reglas" button, and both pages SHALL be usable at 360 px wide using cards instead of tables.

#### Scenario: Open the rules
- **WHEN** the participant activates "Ver reglas"
- **THEN** a dialog lists the rules and prize categories and can be closed

### Requirement: The quiniela is reachable from the team menu and the team dashboard
The team navigation SHALL include a "Quiniela" entry for every user with access, and a "Bolsa de la quiniela" entry only for non-player users (coach). The team dashboard at `/coach/team-dashboard` SHALL show "Quiniela" among its quick actions. Both entries SHALL keep the current team in context.

#### Scenario: Menu entry for a player
- **WHEN** a player with access opens the team menu
- **THEN** it lists "Quiniela" and does not list "Bolsa de la quiniela"

#### Scenario: Menu entries for the coach
- **WHEN** the coach opens the team menu
- **THEN** it lists "Quiniela" and "Bolsa de la quiniela"

#### Scenario: Quick action on the dashboard
- **WHEN** a user with access opens `/coach/team-dashboard`
- **THEN** the quick actions include "Quiniela" linking to the quiniela page of that team

#### Scenario: No access
- **WHEN** a user without access to the feature opens the menu or the dashboard
- **THEN** no quiniela entry is shown

### Requirement: The team home highlights the quiniela as a novelty
The team home at `/coach/team-dashboard` SHALL show a "Quiniela" card as its first element, for every user with access to the feature, whenever the team has an open quiniela. The card SHALL show the pot, the closing time, the state of the user's ticket (not filled, pending payment, paid, closed) and a primary action to the quiniela page. The card SHALL carry a highlighted "Novedad" label until the user opens the quiniela for the first time or 14 days have passed since launch, whichever happens first; afterwards the card remains without the label.

#### Scenario: Open quiniela, ticket not filled
- **WHEN** a player opens the team home and the team has an open quiniela without their ticket
- **THEN** the first card is "Quiniela del equipo" with the "Novedad" label and a "Rellenar mi boleto" action to `/coach/quiniela`

#### Scenario: Ticket pending payment
- **WHEN** the player's ticket is saved and pending payment
- **THEN** the card shows "Pendiente de pago" with the Friday 23:59 deadline and a "Ver mi boleto" action

#### Scenario: Label disappears after opening
- **WHEN** the user has already opened the quiniela page once
- **THEN** the card is shown without the "Novedad" label

#### Scenario: Label disappears after 14 days
- **WHEN** more than 14 days have passed since launch
- **THEN** the card is shown without the "Novedad" label

#### Scenario: No open quiniela for a player
- **WHEN** the team has no open quiniela and the user is a player or family member
- **THEN** the card is not shown

#### Scenario: No open quiniela for the coach
- **WHEN** the team has no open quiniela and the user is the coach
- **THEN** the home shows a discreet "Abrir quiniela" access instead of the card

#### Scenario: Storage unavailable
- **WHEN** the browser storage cannot be read or written
- **THEN** the card still renders and the label depends only on the launch date

