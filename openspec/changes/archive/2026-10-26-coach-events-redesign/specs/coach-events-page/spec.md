## ADDED Requirements

### Requirement: Events are grouped by week
The «Eventos deportivos» page SHALL group the loaded events by calendar week (Monday to Sunday), each group with a heading («Esta semana», «Próxima semana», «Semana pasada» or «Semana del» followed by the Monday date) and its date range, keeping the order the events were loaded in. Pagination SHALL remain.

#### Scenario: Current and next week
- **WHEN** the page shows events dated this week and the following week
- **THEN** they appear under «Esta semana» and «Próxima semana» respectively

#### Scenario: No events
- **WHEN** no event matches the filters
- **THEN** the page shows the empty state instead of group headings

### Requirement: Compact filter bar
The page SHALL replace the always-visible date form with a segmented control «Próximos» / «Pasados» / «Toda la temporada» (the selected segment marked as pressed, «Próximos» by default), type chips «Partidos», «Entrenamientos» and «Torneos», and a button that opens a dropdown with «Desde», «Hasta» and «Aplicar». Applying a custom range SHALL leave no segment pressed. Type chips SHALL filter the loaded page by event type; with none active every type is shown.

#### Scenario: Default segment
- **WHEN** the page opens without a saved filter
- **THEN** «Próximos» is pressed and the events from today onwards are listed

#### Scenario: Custom range
- **WHEN** the coach applies a range from the dropdown
- **THEN** no segment is pressed and the events of that range are listed

#### Scenario: Type chip
- **WHEN** the coach presses «Partidos»
- **THEN** only match events of the loaded page are shown

#### Scenario: Chip leaves the page empty
- **WHEN** a type chip matches none of the loaded events
- **THEN** the empty state is shown with a «Quitar filtros» action
