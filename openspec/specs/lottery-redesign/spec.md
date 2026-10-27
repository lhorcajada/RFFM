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
Each delivered book SHALL show its status as a label.

#### Scenario: Pending book
- **WHEN** a book has no returned amount
- **THEN** its card shows the label «Por devolver»

#### Scenario: Returned book
- **WHEN** a book has been returned
- **THEN** its card shows the label «Devuelto»

