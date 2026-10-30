## ADDED Requirements

### Requirement: The history lists the settled jornadas
The system SHALL let any member with access to the quiniela list the team's settled jornadas, most recent first and paginated, each with its round number, settlement date, collected amount, prize pool, carry-over and winners (name, ticket number, category, hits and prize). Each entry SHALL include the participant's own best result and total prize when they took part.

#### Scenario: List the history
- **WHEN** a participant requests the history of a team with two settled jornadas
- **THEN** both are returned, the most recent first, with their winners

#### Scenario: Pagination
- **WHEN** the team has more settled jornadas than the page size
- **THEN** the response returns one page and the total, with a default size of 10 and a maximum of 50

#### Scenario: Jornada without winners
- **WHEN** a settled jornada had no winners
- **THEN** it is listed with an empty winners list and its carry-over

#### Scenario: Open jornada excluded
- **WHEN** the team has an open jornada
- **THEN** it does not appear in the history

#### Scenario: Other roles and teams
- **WHEN** a Follower, or a user outside the team, requests the history
- **THEN** the request is rejected as forbidden

### Requirement: The history screen leads to the current quiniela
The history screen SHALL show the current quiniela first, with the participant's ticket state and an action to create or edit their ticket for the new jornada (or to view it when the deadline has closed), followed by the settled jornadas as cards. It SHALL be usable at 360 px wide without tables and reachable from the quiniela page and from the results card of the home.

#### Scenario: Current jornada open without ticket
- **WHEN** the participant opens the history and the current jornada is open without their ticket
- **THEN** the first card offers "Rellenar mi boleto" linking to the quiniela page

#### Scenario: Current jornada with ticket
- **WHEN** the current jornada is open and the participant has a ticket
- **THEN** the first card offers "Editar mi boleto"

#### Scenario: Deadline closed
- **WHEN** the current jornada's deadline has closed
- **THEN** the first card offers "Ver mi boleto" and states that the picks are closed

#### Scenario: No current jornada
- **WHEN** the team has no open jornada
- **THEN** the first card states that the next quiniela is not open yet, and the coach sees "Abrir quiniela"

#### Scenario: Winners per jornada
- **WHEN** the participant opens a settled jornada card
- **THEN** it lists the winners with category, hits and prize, highlighting the participant's own tickets

#### Scenario: Empty history
- **WHEN** the team has no settled jornada
- **THEN** the screen shows an empty state below the current quiniela

#### Scenario: Load error
- **WHEN** the history request fails
- **THEN** an error state with a retry action is shown

### Requirement: The history is always reachable
The history SHALL be reachable at any time, independently of the temporary results card of the home, from a "Histórico de quinielas" entry in the team menu, from a link in the quiniela card of the home whenever the team has at least one settled jornada, and from the quiniela page.

#### Scenario: Menu entry
- **WHEN** a user with access to the quiniela opens the team menu
- **THEN** it lists "Histórico de quinielas" keeping the current team in context

#### Scenario: Link on the home after the results card is hidden
- **WHEN** the results card is no longer shown and the team has settled jornadas
- **THEN** the quiniela card still offers a "Ver resultados anteriores" link to the history

#### Scenario: No settled jornadas
- **WHEN** the team has no settled jornada
- **THEN** the home does not show the history link, while the menu entry stays available

#### Scenario: Direct link
- **WHEN** the user opens the history URL directly
- **THEN** the screen loads for the team in the query string
