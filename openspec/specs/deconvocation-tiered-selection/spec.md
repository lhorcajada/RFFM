# deconvocation-tiered-selection Specification

## Purpose
TBD - created by archiving change tiered-deconvocation-algorithm. Update Purpose after archive.
## Requirements
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

### Requirement: Only league matches count as matchdays
The proposal SHALL count matchdays, calls, consecutive matchdays, protection windows, minimum of calls and technical deconvocations using league matches only. Friendlies and tournaments SHALL NOT count in any of them nor break a streak.

#### Scenario: Friendly between two league matches
- **WHEN** a player missed a friendly between two league matches he was called to
- **THEN** his consecutive matchdays are not interrupted

#### Scenario: Technical deconvocation in a friendly
- **WHEN** a player was deconvoked by technical decision in a friendly
- **THEN** he is not protected and it does not add to his technical deconvocations

#### Scenario: Window counted in league matchdays
- **WHEN** a technical deconvocation happened two league matches ago with a friendly in between
- **THEN** it counts as 2 matchdays ago

### Requirement: Protection after a deconvocation
A player deconvoked by technical decision in the last 8 league matchdays SHALL be protected and SHALL NOT be proposed. A player deconvoked for any other cause that is neither a technical decision nor an injury or illness (family problem, studies, unforeseen event...) in the last 4 league matchdays SHALL be protected too, and the card SHALL name the cause. When several protections apply, the card SHALL show the most recent deconvocation. Both windows SHALL be configurable per team.

#### Scenario: Recently deconvoked by technical decision
- **WHEN** a player was deconvoked by technical decision 3 matchdays ago
- **THEN** the card says «Protegido: desconvocado hace 3 jornadas» and the player is not proposed

#### Scenario: Technical window elapsed
- **WHEN** the last technical deconvocation was 9 matchdays ago
- **THEN** the player is eligible

#### Scenario: Deconvoked for a family problem
- **WHEN** a player was deconvoked for a family problem in the previous matchday
- **THEN** the card says «Protegido: desconvocado hace 1 jornada por problema familiar» and the player is not proposed

#### Scenario: Other-cause window elapsed
- **WHEN** a player was deconvoked for a family problem 5 matchdays ago
- **THEN** the player is eligible

#### Scenario: Most recent cause shown
- **WHEN** a player was deconvoked by technical decision 5 matchdays ago and for a family problem in the previous matchday
- **THEN** the card shows the family problem, hace 1 jornada

### Requirement: Absence by injury counts as rest
A player who missed the previous matchday through injury or illness, even mild, SHALL be protected for 1 matchday as if rested. The window SHALL be configurable per team. Absences by injury SHALL NOT count as technical deconvocations.

#### Scenario: Mild injury last matchday
- **WHEN** a player did not play the previous matchday because of a mild injury and is now available
- **THEN** the card says «Protegido: no vino la jornada anterior por lesión» and the player is not proposed

#### Scenario: Injury two matchdays ago
- **WHEN** the injury absence was 2 matchdays ago and the window is 1
- **THEN** the player is eligible

### Requirement: Compensation for missed calls
Players who were not called by technical decision or injury SHALL have priority to remain called afterwards over players with a larger call surplus.

#### Scenario: Two candidates with different call surplus
- **WHEN** two eligible players of the same position differ in calls above their minimum
- **THEN** the one with fewer calls above the minimum is kept and the other is proposed first

### Requirement: Minimum calls protection
A player SHALL NOT be proposed when doing so leaves them below their minimum number of calls, unless their deconvocation is mandatory. The minimum SHALL be the fair share of the matches already played that the player was available for: the whole number below (available matches x players called per matchday / squad size), never above the matches available.

#### Scenario: One call short
- **WHEN** a player has 9 calls and a minimum of 10
- **THEN** the card says «Protegido: le falta 1 convocatoria para llegar al mínimo exigido (10)» and the player is not proposed

#### Scenario: Fair share of the minimum
- **WHEN** a squad of 20 calls 18 players per matchday and a player was available for 7 played matches
- **THEN** the minimum of that player is 6 calls

### Requirement: Fairness order
Among eligible players the proposal SHALL order candidates by these criteria, in cascade: (1) more consecutive matchdays called without rest, (2) larger call surplus over the minimum, (3) fewer accumulated technical deconvocations, (4) lower season training attendance, compared in steps of 10%. The first criterion where two players differ SHALL decide.

#### Scenario: First criterion decides
- **WHEN** two players differ in consecutive matchdays called
- **THEN** the one with more matchdays called is proposed first, whatever the other criteria

#### Scenario: Tie on the first criteria
- **WHEN** two players tie on criteria 1 to 3 and differ in attendance
- **THEN** the one with the lower attendance is proposed first

### Requirement: Rival difficulty and level
The proposal SHALL classify the rival as easy, medium or hard from the match forecast (probability of the own team winning, thresholds configurable per team) and, without forecast, as medium. The weighted rating of the players SHALL always be the last tiebreak, so that among players tied on every other criterion the one with the lower rating is proposed first and the best players are the last to rest. Against a hard rival the rating SHALL be applied earlier, right after the call surplus and before the technical deconvocations. The order SHALL fall back to squad order only when every criterion, rating included, is tied.

#### Scenario: Hard rival
- **WHEN** the rival is hard and two eligible players tie on consecutive matchdays and call surplus but differ in rating and technical deconvocations
- **THEN** the one with the lower weighted rating is proposed

#### Scenario: Easy or medium rival
- **WHEN** the rival is easy or medium and two eligible players tie on every criterion except rating
- **THEN** the one with the lower weighted rating is proposed and the card says the level is the last tiebreak

#### Scenario: No forecast
- **WHEN** there is no forecast for the rival
- **THEN** the rival is treated as medium and the proposal shows it as «Rival medio»

### Requirement: Already deconvoked count against the target
Players already deconvoked SHALL count towards the deconvocation target and towards the availability of their position. The proposal SHALL propose only the remaining number.

#### Scenario: One already out
- **WHEN** the target is 3 and one player is already deconvoked
- **THEN** 2 more are proposed

### Requirement: Reason shown for every decision
Each player SHALL show exactly one decisive reason: for a proposed player the criterion that decided (e.g. «Elegido: es el lateral que más jornadas lleva sin descansar»), for a protected player the protecting rule, and for an eligible player not proposed the player preferred over them and why. The screen SHALL show these reasons grouped as proposed, protected and not chosen. Each proposed card SHALL have a collapsible detail listing every rule evaluated, its value and its outcome (does not protect, allows, decides, tie, no effect), and a comparison with every other eligible player not proposed, each with the criterion and values that decide between them, a tie, or the position minimum that keeps them. The proposal SHALL NOT offer a print report.

#### Scenario: Proposed player
- **WHEN** a player is proposed by fairness order
- **THEN** the card shows the deciding criterion and its value

#### Scenario: Protected by position minimum
- **WHEN** a player is kept to preserve a position minimum
- **THEN** the card says «Protegido: quedarían X de Y laterales»

#### Scenario: Comparison with every eligible player
- **WHEN** the coach opens the detail of a proposed player
- **THEN** each other eligible player appears with the deciding criterion and values (for example «Decide: jornadas seguidas (6 frente a 4)»), «Empate en todos los criterios» or «Se queda por el mínimo de su posición»

#### Scenario: Tie with other players
- **WHEN** a proposed player ties with others on every criterion, rating included
- **THEN** the reason names the tied players and says the order falls back to the squad order

#### Scenario: Rule detail
- **WHEN** the coach opens the detail of a proposed player
- **THEN** every rule appears with its value and outcome, and the deciding one is marked

#### Scenario: No print action
- **WHEN** the coach views the proposal
- **THEN** there is no "Imprimir propuesta" action

#### Scenario: Not chosen
- **WHEN** an eligible player is not proposed
- **THEN** the card names the criterion by which another player was preferred

### Requirement: Fit shown on the proposal card
When a player is proposed or kept because of position fit, the card SHALL state the position, the player's place in that position's order and their fit, for example «Encaje: 3.º de 3 en Mediocentro defensivo (3,1)».

#### Scenario: Reason shown
- **WHEN** a player is proposed for deconvocation because of fit
- **THEN** the card shows their place, the position and the fit

