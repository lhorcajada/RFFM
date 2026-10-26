# squad-ideal-lineup-tab Specification

## Purpose
TBD - created by archiving change squad-tabs-redesign. Update Purpose after archive.
## Requirements
### Requirement: Responsive ideal lineup
The «Alineación ideal» tab SHALL present the formation selector as chips that wrap and SHALL lay out the pitch and the available-players list in a single column on narrow viewports, without horizontal scrolling. Dragging, saving and the component's public API SHALL remain unchanged, and the lineup used in the call-up tab SHALL keep working.

#### Scenario: Formation selector
- **WHEN** the coach presses a formation chip
- **THEN** that chip is marked as pressed and the pitch shows the formation

#### Scenario: Call-up tab unaffected
- **WHEN** the lineup is rendered in the call-up tab with an extra panel
- **THEN** it still shows the pitch, the player list and the extra panel

