## ADDED Requirements

### Requirement: Summary counters
The team users page SHALL show the total number of users and the number pending approval.

#### Scenario: Counters
- **WHEN** the team has three users and one is pending approval
- **THEN** the page shows 3 users and 1 pending

### Requirement: Approval filter
The page SHALL let the user filter the list by «Todos», «Pendientes» and «Aprobados», marking the active filter as pressed.

#### Scenario: Pending filter
- **WHEN** the user presses «Pendientes»
- **THEN** only users pending approval are listed and the button is pressed

#### Scenario: Empty filter
- **WHEN** the chosen filter matches no user
- **THEN** a message says there are no users for that filter

### Requirement: User cards
Each user SHALL be shown as a card with avatar initial, alias, email, role, approval status, linked player and join date, never as a table.

#### Scenario: Linked player
- **WHEN** a user has a linked player
- **THEN** the card shows «Jugador vinculado» with the player's name

### Requirement: Existing rules preserved
Approval and deletion permissions SHALL NOT change.

#### Scenario: Own card
- **WHEN** the card belongs to the caller
- **THEN** it has no approve or delete action
