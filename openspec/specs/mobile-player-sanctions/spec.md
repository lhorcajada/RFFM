# mobile-player-sanctions Specification

## Purpose
TBD - created by archiving change add-mobile-injuries-sanctions-screens. Update Purpose after archive.
## Requirements
### Requirement: Team-wide sanctions listing by category
The Mobile app SHALL provide a read-only "Sanciones" screen that lists every recorded sanction for
every player on the selected team, split into two separate views by category: "En competición"
(`Competition`) and "Por normas internas" (`InternalDiscipline`).

#### Scenario: Sanctions load successfully for a category
- **WHEN** the coach opens the "Sanciones" tab and selects the "En competición" section for a team
  with players that have `Competition` sanction records
- **THEN** the screen displays a list of sanction entries for that category, each combined with the
  corresponding player's photo, alias, and position

#### Scenario: Switching between categories does not require a full reload error
- **WHEN** the coach switches from "En competición" to "Por normas internas"
- **THEN** the screen displays the `InternalDiscipline` sanctions for the same team without showing
  a loading error for the previously loaded category

#### Scenario: No sanctions recorded for a category
- **WHEN** the selected category has no sanction records for any player on the team
- **THEN** the screen shows an empty-state message in Spanish for that category

#### Scenario: Roster fails to load
- **WHEN** the roster request (`season-player-cards`) fails
- **THEN** the screen shows an error message derived from `e.response?.data?.detail` or a Spanish
  fallback message, matching the standard Mobile data-loading pattern

### Requirement: Sanction entry detail
Each sanction entry SHALL display its full recorded detail and an active/resolved status derived
from whether `endDate` is set.

#### Scenario: Active sanction
- **WHEN** a sanction record has `endDate: null`
- **THEN** the entry shows an active status and displays "Sin definir" as the end date

#### Scenario: Resolved sanction
- **WHEN** a sanction record has a non-null `endDate`
- **THEN** the entry shows a resolved status and the formatted `endDate`

#### Scenario: Full sanction detail shown
- **WHEN** a sanction entry is rendered
- **THEN** it displays `sanctionType`, `startDate`, `description` (if present), and `estimatedEnd`
  (if present), in addition to status and dates

