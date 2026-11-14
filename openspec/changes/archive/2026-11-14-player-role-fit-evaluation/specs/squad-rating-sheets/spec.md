## ADDED Requirements

### Requirement: Access to trait rating and position order
The page `/coach/squad/rating-sheet` SHALL offer three views: the existing characteristic sheets («Jugadores» and «Porteros»), the trait rating and the order by position. The existing sheets and their behavior SHALL NOT change. The selected view SHALL keep the `teamId` and `seasonId` query params, and navigating between views with unsaved changes SHALL ask for confirmation with the app's confirmation dialog.

#### Scenario: Existing sheets unchanged
- **WHEN** the coach opens the «Jugadores» characteristic sheet
- **THEN** it behaves as before this change

#### Scenario: Switch view with unsaved changes
- **WHEN** the coach changes a level and switches to the order by position view
- **THEN** a confirmation dialog is shown before switching
