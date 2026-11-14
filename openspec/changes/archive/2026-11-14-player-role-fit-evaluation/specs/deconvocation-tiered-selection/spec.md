## MODIFIED Requirements

### Requirement: Decision funnel order
The proposal SHALL decide in this order: (1) mandatory deconvocations and protected players, (2) position minimums, (3) among the remaining eligible players, position fit order where the team has a confirmed or proposed fit order for the player's position, and fairness order for players whose position has no fit order, (4) rival difficulty as the last tiebreak. A later step SHALL NOT override an earlier one. The proposal SHALL NOT rank players by a sum of points. In step 3, within a position with a fit order, the player with the lowest place in that order SHALL be deconvoked first, and fairness order SHALL only break ties between players with the same place.

#### Scenario: Fairness cannot override protection
- **WHEN** a protected player has the worst fairness order
- **THEN** the player is not proposed

#### Scenario: Position minimum prevails over fairness
- **WHEN** the next player in fairness order is needed to keep their position minimum
- **THEN** the next eligible player of another position is proposed instead

#### Scenario: Worst fit deconvoked first
- **WHEN** three eligible midfielders are in fit order A, B, C and one must be deconvoked
- **THEN** C is proposed

#### Scenario: Fit cannot override protection
- **WHEN** the player with the worst fit was deconvoked by technical decision in the last 8 league matchdays
- **THEN** the player is not proposed and the next worst fit is considered

#### Scenario: Position without fit order
- **WHEN** a position has no fit order
- **THEN** its players are ordered by fairness as before

## ADDED Requirements

### Requirement: Fit shown on the proposal card
When a player is proposed or kept because of position fit, the card SHALL state the position, the player's place in that position's order and their fit, for example «Encaje: 3.º de 3 en Mediocentro defensivo (3,1)».

#### Scenario: Reason shown
- **WHEN** a player is proposed for deconvocation because of fit
- **THEN** the card shows their place, the position and the fit
