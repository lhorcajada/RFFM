## MODIFIED Requirements

### Requirement: Access to trait rating and position order
The page `/coach/squad/rating-sheet` SHALL offer four views: the characteristic sheets («Jugadores» and «Porteros»), the trait rating, the order by position and the configuration of capacities and traits. The characteristic sheets SHALL list the capacities of the team's effective catalog, without the hidden ones, and otherwise SHALL keep their behavior. The selected view SHALL keep the `teamId` and `seasonId` query params, and navigating between views with unsaved changes SHALL ask for confirmation with the app's confirmation dialog.

#### Scenario: Existing sheets unchanged
- **WHEN** the coach of a team without customizations opens the «Jugadores» characteristic sheet
- **THEN** it behaves as before this change

#### Scenario: Custom capacity in the sheet
- **WHEN** the team created the capacity «Juego aéreo ofensivo» for the field sheet
- **THEN** the «Jugadores» sheet lists it and shows its 10 level texts

#### Scenario: Hidden capacity not listed
- **WHEN** the team hid a capacity
- **THEN** the sheet does not list it

#### Scenario: Switch view with unsaved changes
- **WHEN** the coach changes a level and switches to another view
- **THEN** a confirmation dialog is shown before switching
