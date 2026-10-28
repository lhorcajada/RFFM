## ADDED Requirements

### Requirement: Bulk delete endpoint
The API SHALL expose `DELETE /api/audit-log` accepting a list of 1 to 100 event ids and permanently deleting those events.

#### Scenario: Delete existing events
- **WHEN** a Federation user sends three existing ids
- **THEN** the response is 200 with `deleted` equal to 3 and the events no longer appear in the search

#### Scenario: Unknown ids ignored
- **WHEN** the list contains an id that does not exist
- **THEN** it is ignored and `deleted` counts only the removed events

#### Scenario: Invalid list
- **WHEN** the list is empty, has more than 100 ids, or has empty or repeated ids
- **THEN** the response is 400 ProblemDetails and nothing is deleted

### Requirement: Restricted to Federation and Administrator
Only the Federation and Administrator roles SHALL be able to delete audit events.

#### Scenario: Coach forbidden
- **WHEN** a Coach or ClubDirector calls the endpoint
- **THEN** the response is 403 and nothing is deleted

#### Scenario: Anonymous
- **WHEN** the caller is not authenticated
- **THEN** the response is 401

### Requirement: Multiple selection
For users allowed to delete, each event card SHALL have a checkbox, and the view SHALL offer «Seleccionar página», a selected counter, «Cancelar selección» and «Eliminar (N)». Other users SHALL NOT see any of these controls.

#### Scenario: Select page
- **WHEN** the user checks «Seleccionar página»
- **THEN** every event of the current page is selected and the counter shows the number of events

#### Scenario: Selection reset
- **WHEN** the user changes page or any filter
- **THEN** the selection is cleared

#### Scenario: No selection
- **WHEN** no event is selected
- **THEN** «Eliminar» is disabled

#### Scenario: No permission
- **WHEN** a Coach opens the audit log
- **THEN** no checkbox or selection bar is shown

### Requirement: Confirmed deletion
Deleting SHALL require confirmation in a `ConfirmDialog`, never a native dialog.

#### Scenario: Confirm
- **WHEN** the user confirms
- **THEN** the selected ids are sent, a snackbar reports the number deleted and the list reloads without the selection

#### Scenario: Cancel
- **WHEN** the user cancels the dialog
- **THEN** nothing is deleted and the selection is kept

#### Scenario: Error
- **WHEN** the request fails
- **THEN** an error snackbar is shown and the selection is kept

### Requirement: Responsive selection bar
The selection bar SHALL be usable on narrow screens, with actions fixed at the bottom below 600 px, and SHALL NOT use tables.

#### Scenario: Narrow screen
- **WHEN** the viewport is narrower than 600 px and events are selected
- **THEN** «Cancelar» and «Eliminar (N)» are fixed at the bottom without covering the last card
