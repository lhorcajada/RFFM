# squad-page-shell Specification

## Purpose
TBD - created by archiving change squad-tabs-redesign. Update Purpose after archive.
## Requirements
### Requirement: Tabs without horizontal scrolling
The squad page SHALL show its tabs (Plantilla, Valoraciones, Estadísticas, Ranking, Alineación ideal, according to the user's role) wrapping onto several lines when they do not fit, and SHALL NOT use horizontal scrolling or scroll buttons for them. The selected tab SHALL be visibly marked.

#### Scenario: Narrow viewport
- **WHEN** the page is shown on a narrow viewport
- **THEN** all permitted tabs are visible, wrapping onto more than one line, with no scroll buttons

#### Scenario: Role-based tabs
- **WHEN** a fan opens the page
- **THEN** only the «Plantilla» tab is shown

#### Scenario: Player or family member
- **WHEN** a player or family member opens the page
- **THEN** «Ranking» and «Alineación ideal» are not shown

