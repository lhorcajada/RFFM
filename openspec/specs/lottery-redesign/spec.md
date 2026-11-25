# lottery-redesign Specification

## Purpose
TBD - created by archiving change lottery-redesign. Update Purpose after archive.
## Requirements
### Requirement: Collection progress summary
The lottery summary SHALL show the amount collected, the amount pending and a progress bar of returned books.

#### Scenario: Progress
- **WHEN** a campaign has 12 books delivered and 8 returned
- **THEN** the summary shows the progress bar at 67%

#### Scenario: No books delivered
- **WHEN** a campaign has no books delivered
- **THEN** the progress bar is at 0%

### Requirement: Visible book status
Each book SHALL show its status as a label translated to Spanish: «Sin asignar» for `Unassigned`, «Asignado» for `Assigned`, «Entregado al jugador» for `DeliveredToPlayer`, «Devuelto al entrenador» for `ReturnedToCoach` and «Entregado al club» for `DeliveredToClub`.

#### Scenario: Pending book
- **WHEN** a book is delivered to the player and not yet returned
- **THEN** its card shows the label «Entregado al jugador»

#### Scenario: Returned book
- **WHEN** a book has been returned to the coach
- **THEN** its card shows the label «Devuelto al entrenador»

#### Scenario: Book delivered to the club
- **WHEN** a book has been delivered to the club
- **THEN** its card shows the label «Entregado al club» and the club delivery date

