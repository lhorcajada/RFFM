## ADDED Requirements

### Requirement: Tickets are locked when the deadline closes
Once the first valid match of the jornada has started, the system SHALL NOT allow creating, editing or paying a ticket from the participant side. The team home SHALL show the quiniela as closed, with the closing time already passed and the participant's tickets read-only.

#### Scenario: Home after the deadline
- **WHEN** the first valid match has started and a participant opens the team home
- **THEN** the quiniela card shows "Pronósticos cerrados" and its closing time, and its action opens the ticket in read-only mode

#### Scenario: Editing after the deadline
- **WHEN** the participant opens the quiniela page after the deadline
- **THEN** the picks are shown without edit, save or delete actions

#### Scenario: Participant without a ticket
- **WHEN** the deadline has passed and the participant has no ticket
- **THEN** the card states that they are not taking part in this jornada

### Requirement: The jornada is settled automatically
The system SHALL settle an open jornada without coach intervention as soon as it has at least one valid match and all its valid matches are final, using the same scoring, fund contribution and carry-over as the manual settlement. Settling SHALL happen at most once per jornada, even when the coach settles manually at the same time. The coach MAY still settle manually.

#### Scenario: Last match finishes
- **WHEN** the last valid match of an open jornada becomes final
- **THEN** within the next polling cycle the jornada is settled, tickets receive hits, category and prize, and the team fund movement is created

#### Scenario: Matches still pending
- **WHEN** a valid match of the jornada is not final
- **THEN** the jornada stays open

#### Scenario: Postponed matches do not block
- **WHEN** all valid matches are final and the rest are postponed or suspended
- **THEN** the jornada is settled

#### Scenario: Settled twice
- **WHEN** the worker and the coach settle the same jornada concurrently
- **THEN** only one settlement is applied and a single team fund movement exists

#### Scenario: One jornada fails
- **WHEN** settling a jornada raises an error
- **THEN** the error is logged and the remaining teams are still processed

### Requirement: The next jornada opens automatically
After settling a jornada automatically, the system SHALL open the quiniela of the team's next round that has pending valid matches, with the carry-over of the settled jornada as the initial pot and the team's current price and prize percentage. If there is no such round, nothing is opened. The coach MAY still open it manually.

#### Scenario: Next round available
- **WHEN** a jornada is settled automatically and the next round has pending valid matches
- **THEN** a new open jornada exists with the carry-over of the settled one

#### Scenario: No next round
- **WHEN** a jornada is settled automatically and no later round has pending valid matches
- **THEN** no jornada is opened and the home shows the last results

### Requirement: The home shows the result and the prize distribution
When the last jornada has been settled, the team home SHALL show a results card with the winners, their categories, hits and prizes, and the carry-over, next to the quiniela card of the new jornada, until the new jornada's deadline closes. The card SHALL link to the quiniela history.

#### Scenario: Results with a new jornada open
- **WHEN** a jornada has been settled and the next one is open and not yet closed
- **THEN** the home shows the results card of the settled jornada and the quiniela card of the new one

#### Scenario: Participant prize
- **WHEN** the participant had a winning ticket
- **THEN** the results card highlights their category, hits and prize

#### Scenario: No winners
- **WHEN** nobody hit a prize category
- **THEN** the card states there were no winners and shows the carry-over passed on

#### Scenario: New jornada already closed
- **WHEN** the new jornada's deadline has closed
- **THEN** the results card is no longer shown on the home but stays available in the history
