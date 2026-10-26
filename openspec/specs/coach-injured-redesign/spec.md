# coach-injured-redesign Specification

## Purpose
TBD - created by archiving change coach-injured-redesign. Update Purpose after archive.
## Requirements
### Requirement: The injured tab shows an injuries summary
The «Lesionados» tab SHALL show two counters: «Activas», the number of injuries without discharge date, and «Altas este mes», the number of injuries whose discharge date falls in the current month.

#### Scenario: Active counter
- **WHEN** the team has two injuries without discharge date and one discharged
- **THEN** the «Activas» counter shows 2

#### Scenario: Discharges this month
- **WHEN** one injury has a discharge date in the current month and another in a previous month
- **THEN** the «Altas este mes» counter shows 1

### Requirement: Injuries can be filtered by active or history
The tab SHALL offer the filter chips «Activas» and «Historial», each at least 44 px tall, with «Activas» selected by default. «Activas» SHALL list the injuries without discharge date and «Historial» the injuries with discharge date. When the selected filter has no injuries, an empty state SHALL be shown.

#### Scenario: Default filter
- **WHEN** the tab loads with one active and one discharged injury
- **THEN** only the active injury is listed

#### Scenario: History filter
- **WHEN** the coach selects «Historial»
- **THEN** only the discharged injury is listed

#### Scenario: Empty filter
- **WHEN** there are injuries but none is active and the «Activas» filter is selected
- **THEN** the empty state «Sin lesiones activas» is shown

### Requirement: Injury cards show the player and the injury status
Each injury SHALL be shown as a card (never a table) with the dorsal of the player in a circle, name, position and alias when available, injury type, a status chip («Activa» or «Alta»), the start date, the discharge date when present, and «Rec.: » followed by the estimated recovery text when present.

#### Scenario: Active injury card
- **WHEN** an injury has no discharge date
- **THEN** its card shows the «Activa» chip and no discharge date

#### Scenario: Discharged injury card
- **WHEN** an injury has a discharge date
- **THEN** its card shows the «Alta» chip and the discharge date

### Requirement: Recovery progress is shown only when reliable
An active injury card SHALL show a recovery percentage bar only when its estimated recovery text is a number or range followed by a unit (días, semanas or meses). The percentage SHALL be the elapsed time since the start date over the upper bound of the estimate, between 0 and 99. Otherwise the bar SHALL be omitted.

#### Scenario: Interpretable estimate
- **WHEN** an active injury started 7 days ago with estimated recovery «2 semanas»
- **THEN** the card shows a recovery progress of 50 %

#### Scenario: Range estimate
- **WHEN** an active injury started 14 days ago with estimated recovery «3-4 semanas»
- **THEN** the card shows a recovery progress of 50 %

#### Scenario: Free-text estimate
- **WHEN** an active injury has estimated recovery «hasta nueva revisión»
- **THEN** the card shows the text «Rec.: hasta nueva revisión» and no progress bar

### Requirement: Coach actions are update and discharge
For a coach, each card SHALL offer an «Actualizar» button that opens the injury edit dialog, and, for active injuries, a «Dar de alta» button that opens a confirmation dialog before saving the discharge. Both buttons SHALL be at least 44 px tall. Users who are not coaches SHALL see neither button.

#### Scenario: Update opens the dialog
- **WHEN** the coach presses «Actualizar»
- **THEN** the injury edit dialog opens

#### Scenario: Discharge needs confirmation
- **WHEN** the coach presses «Dar de alta» on an active injury
- **THEN** a confirmation dialog is shown and the injury is updated only after confirming

#### Scenario: Non-coach
- **WHEN** the user is not a coach
- **THEN** no «Actualizar» or «Dar de alta» button is shown

