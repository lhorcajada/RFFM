## ADDED Requirements

### Requirement: Stackable toolbar
The «Estadísticas» toolbar (sort selector, direction toggle, position filter and PDF export) SHALL wrap or stack on narrow viewports so that every control stays reachable without horizontal scrolling and with touch targets of at least 44 px.

#### Scenario: Narrow viewport
- **WHEN** the tab is shown on a narrow viewport
- **THEN** all toolbar controls are visible and usable without horizontal scrolling

### Requirement: Statistics cards
Each player SHALL be shown as a card with avatar, jersey number, name, position, the form bars, the «Ver evolución» action and a grid of figures; the existing sorting, position filtering, PDF export and metric information dialogs SHALL keep working unchanged.

#### Scenario: Sorting is preserved
- **WHEN** the coach sorts by goals descending
- **THEN** the cards are ordered by goals, highest first
