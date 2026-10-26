# coach-event-detail Specification

## Purpose
TBD - created by archiving change coach-events-redesign. Update Purpose after archive.
## Requirements
### Requirement: The event can be deleted from its detail page
The event attendance page SHALL show an «Eliminar» button next to «Editar» to the roles that can edit the event. Pressing it SHALL open a confirmation dialog; confirming SHALL delete the event, show the notice «Evento eliminado» and return to the team's events list. If the event no longer exists the page SHALL notify it and return to the list; on any other error it SHALL notify the error and stay on the page.

#### Scenario: Confirm deletion
- **WHEN** the coach presses «Eliminar» and confirms
- **THEN** the event is deleted and the events list opens

#### Scenario: Cancel deletion
- **WHEN** the coach presses «Eliminar» and cancels
- **THEN** the event is kept and the page stays open

#### Scenario: Role without edit permission
- **WHEN** the user has no role that can edit events
- **THEN** the «Eliminar» button is not shown

