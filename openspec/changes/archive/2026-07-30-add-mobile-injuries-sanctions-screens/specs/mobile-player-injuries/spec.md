## ADDED Requirements

### Requirement: Team-wide injuries listing
The Mobile app SHALL provide a read-only "Lesiones" screen that lists every recorded injury for
every player on the selected team, ordered by start date.

#### Scenario: Injuries load successfully
- **WHEN** the coach opens the "Lesiones" tab for a team with players that have injury records
- **THEN** the screen displays a list of injury entries ordered by `startDate`, each combined with the
  corresponding player's photo, alias, and position

#### Scenario: No injuries recorded
- **WHEN** the coach opens the "Lesiones" tab for a team whose players have no injury records
- **THEN** the screen shows an empty-state message in Spanish instead of a list

#### Scenario: Roster fails to load
- **WHEN** the roster request (`season-player-cards`) fails
- **THEN** the screen shows an error message derived from `e.response?.data?.detail` or a Spanish
  fallback message, matching the standard Mobile data-loading pattern

### Requirement: Injury entry detail
Each injury entry SHALL display its full recorded detail and an active/discharged status derived
from whether `endDate` is set.

#### Scenario: Active injury
- **WHEN** an injury record has `endDate: null`
- **THEN** the entry shows a "de baja" (active/injured) status and displays "Sin definir" as the end
  date

#### Scenario: Resolved injury
- **WHEN** an injury record has a non-null `endDate`
- **THEN** the entry shows a "de alta" (discharged) status and the formatted `endDate`

#### Scenario: Full injury detail shown
- **WHEN** an injury entry is rendered
- **THEN** it displays `injuryType`, `startDate`, `description` (if present), and
  `estimatedRecovery` (if present), in addition to status and dates
