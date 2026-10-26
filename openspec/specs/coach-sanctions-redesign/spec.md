# coach-sanctions-redesign Specification

## Purpose
TBD - created by archiving change coach-sanctions-redesign. Update Purpose after archive.
## Requirements
### Requirement: Collection progress in summary
The summary SHALL show a progress bar with the amount collected out of the total fined.

#### Scenario: Progress
- **WHEN** the total fined is 150 € and the total pending is 60 €
- **THEN** the summary shows «90 € cobrados de 150 €» and a progress bar at 60%

### Requirement: Status filter counts
Each status filter option SHALL show how many sanctions it contains without changing its accessible name.

#### Scenario: Counts
- **WHEN** there are 2 pending and 1 paid sanctions
- **THEN** «Todas» shows 3, «Pendientes» 2 and «Pagadas» 1

### Requirement: Fine progress and labelled actions on the card
A sanction card with a fine SHALL show a payment progress bar and the pending amount, and managing actions SHALL display visible text.

#### Scenario: Fine progress
- **WHEN** a sanction has a 30 € fine with 10 € paid
- **THEN** the card shows a progress bar at 33% and «Pendiente 20 €»

#### Scenario: Visible action labels
- **WHEN** the user can manage sanctions
- **THEN** the Editar and Eliminar buttons show their text

