## ADDED Requirements

### Requirement: The session list can be filtered by season
`GET /api/trainings/sessions` SHALL accept an optional `seasonId`. When it is sent, the response SHALL include only the team's sessions assigned to a microciclo whose season plan belongs to that season, the team's sessions without a microciclo whose date falls within the season's start and end dates (inclusive), and the team's sessions without a microciclo and without a date. Without `seasonId` it SHALL return all the team's sessions.

#### Scenario: Session assigned to a plan of the season
- **WHEN** a session is assigned to a microciclo of the season plan of season S and the list is requested with `seasonId=S`
- **THEN** the session is returned

#### Scenario: Session assigned to a plan of another season
- **WHEN** a session is assigned to a microciclo of the season plan of season T and the list is requested with `seasonId=S`
- **THEN** the session is not returned

#### Scenario: Free session inside the season dates
- **WHEN** a session without microciclo is dated within the dates of season S and the list is requested with `seasonId=S`
- **THEN** the session is returned

#### Scenario: Free session outside the season dates
- **WHEN** a session without microciclo is dated after the end of season S and the list is requested with `seasonId=S`
- **THEN** the session is not returned

#### Scenario: Unscheduled free session
- **WHEN** a session has neither microciclo nor date and the list is requested with `seasonId=S`
- **THEN** the session is returned

#### Scenario: No season
- **WHEN** the list is requested without `seasonId`
- **THEN** all the team's sessions are returned

### Requirement: Each listed session carries its plan hierarchy
Each item of `GET /api/trainings/sessions` assigned to a microciclo SHALL include the microciclo's start and end dates and order, and the id, name and order of its mesociclo and macrociclo. Items without microciclo SHALL have those fields empty.

#### Scenario: Hierarchy of a planned session
- **WHEN** a session is assigned to microciclo «Semana 1» of mesociclo «Mesociclo 1.1» of macrociclo «Macrociclo 1»
- **THEN** its item includes «Semana 1», «Mesociclo 1.1» and «Macrociclo 1» with their ids

### Requirement: The sessions tab groups sessions by the season plan
The «Sesiones» tab SHALL offer a season selector (default: the club's active season) with an extra «Todas» option, and request the sessions of the selected season (without `seasonId` for «Todas»). It SHALL group them, collapsibly, by Macrociclo › Mesociclo › Microciclo, with groups and sessions ordered from most recent to oldest, followed by a «Sesiones libres» group with the sessions without microciclo: first the unscheduled ones, then the dated ones from most recent to oldest. The «Sesiones libres» group SHALL show 10 sessions and a «Ver más» button that shows 10 more.

#### Scenario: Default season
- **WHEN** the coach opens the «Sesiones» tab and the active season is «2026-2027»
- **THEN** «2026-2027» is selected and sessions are requested with its id

#### Scenario: Changing the season
- **WHEN** the coach selects another season
- **THEN** sessions are requested again with that season's id

#### Scenario: All seasons
- **WHEN** the coach selects «Todas»
- **THEN** sessions are requested without `seasonId`

#### Scenario: Planned sessions are grouped
- **WHEN** two sessions belong to microciclo «Semana 1» of «Mesociclo 1.1» of «Macrociclo 1»
- **THEN** both appear under the headings «Macrociclo 1», «Mesociclo 1.1» and «Semana 1»

#### Scenario: Most recent first
- **WHEN** a microciclo has sessions on 2 and 5 September
- **THEN** the session of 5 September is listed before the one of 2 September

#### Scenario: Free sessions group
- **WHEN** there are sessions without microciclo, one unscheduled and one dated
- **THEN** both appear under «Sesiones libres», the unscheduled one first

#### Scenario: See more free sessions
- **WHEN** there are 12 free sessions
- **THEN** 10 are shown and pressing «Ver más» shows the other 2
