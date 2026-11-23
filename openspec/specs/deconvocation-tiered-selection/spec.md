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
The proposal SHALL classify the rival as easy, medium or hard from the match forecast (thresholds configurable per team) and, without forecast, as medium. Against a hard rival the weighted rating SHALL be the first fairness criterion, in steps of half a point, so the weakest eligible players are proposed first; the other criteria only break ties. Against an easy or medium rival the rating SHALL be the last tiebreak. The order SHALL fall back to squad order only when every criterion is tied.

#### Scenario: Hard rival
- **WHEN** the rival is hard and two eligible players differ in rating by more than half a point
- **THEN** the one with the lower weighted rating is proposed, whatever their consecutive matchdays and call surplus

#### Scenario: Hard rival, near-equal rating
- **WHEN** the rival is hard and two eligible players differ in rating by less than half a point
- **THEN** the order falls back to consecutive matchdays, call surplus, fit, technical deconvocations and attendance

#### Scenario: Hard rival, protected weakest player
- **WHEN** the rival is hard and the weakest player is protected
- **THEN** the weakest player is not proposed and the next weakest eligible player is considered

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

### Requirement: Deconvocations are spread over lines
The lines are defence (centre-backs and full-backs), midfield, wide players and forwards. While other lines have eligible candidates, the proposal SHALL NOT propose two players of the same line, counting mandatory deconvocations; a second per line is allowed only after every line has one. Position minimums SHALL prevail, and this rule SHALL give way only when the target cannot be reached otherwise.

#### Scenario: Centre-back and full-back
- **WHEN** a centre-back and a full-back lead the order and a midfielder follows
- **THEN** the centre-back and the midfielder are proposed

#### Scenario: Two wide players or two forwards
- **WHEN** two wide players, or two forwards, lead the order and another line has candidates
- **THEN** only one of them is proposed

#### Scenario: Mandatory deconvocation takes the line
- **WHEN** a centre-back is deconvoked by a mandatory rule
- **THEN** no full-back is proposed while other lines have candidates

#### Scenario: More deconvocations than lines
- **WHEN** six deconvocations are needed
- **THEN** each line gets one before any line gets a second

### Requirement: Weakest players are reserved for the hardest match
When one of the next 5 league matches is harder than the current one, the proposal SHALL NOT deconvoke now the N lowest-rated deconvokable players, N being the number of players deconvoked per match, unless the target cannot be reached otherwise, and SHALL order the current match by the fairness criteria of a non-hard match. In the hardest match the weakest players go first. The proposal SHALL name the reserved players and how many matches ahead that match is.

#### Scenario: Harder match two matches ahead
- **WHEN** the current rival is hard with a win probability of 35% and the match two matches ahead is hard with 15%
- **THEN** the 3 lowest-rated players are not proposed now and the text says they are reserved for the match in 2 matches

#### Scenario: Current match is the hardest
- **WHEN** the current rival is hard with 15% and the next hard match has 35%
- **THEN** the weakest players are proposed now

#### Scenario: Current rival is not hard
- **WHEN** the current rival is medium and a hard match is among the next 5
- **THEN** the weakest players are reserved for it

#### Scenario: Probabilities unknown
- **WHEN** the current and a later match are both hard and a probability is missing
- **THEN** nothing is reserved and the weakest go first now

#### Scenario: Reserved players are used when needed
- **WHEN** the target cannot be reached without them
- **THEN** reserved players are proposed, the first of them in the order

#### Scenario: Reserved player card
- **WHEN** a reserved player is not proposed
- **THEN** the card says he stays because he is one of the weakest and is reserved for a harder match, with the number of matches ahead

### Requirement: Hardest match of the window
The hardest match SHALL be the hard match with the lowest win probability. A hard match SHALL be harder than a non-hard one; between two hard matches the later one SHALL be harder only when both probabilities are known and its probability is lower.

#### Scenario: Two hard matches
- **WHEN** the current match has 35% and a later hard match 15%
- **THEN** the later match is the hardest

#### Scenario: Missing probability
- **WHEN** a probability of two hard matches is missing
- **THEN** the later match is not harder than the current one

### Requirement: Strong players stay called against a hard rival
Strong players are those strictly above the rating that closes the top third of the called players; nobody is strong when all ratings are equal. Against a hard rival the proposal SHALL NOT propose strong players while other eligible players can reach the target. Against an easy or medium rival there SHALL be no protection of strong players beyond a cap of half the target, at least one.

#### Scenario: Hard rival
- **WHEN** the rival is hard and a strong player leads the fairness order
- **THEN** a non-strong eligible player is proposed instead

#### Scenario: Not enough alternatives
- **WHEN** only strong players remain eligible and the target is not reached
- **THEN** strong players are proposed to reach the target

#### Scenario: Medium rival
- **WHEN** the rival is medium
- **THEN** at most half the target, at least one, are strong players

### Requirement: Position cover
When a player would be proposed, at least 2 of the remaining called players SHALL be able to play his position, through their active or a possible position. Otherwise the player SHALL stay called, the card SHALL say how many remain, and the rule SHALL give way only to a mandatory deconvocation or when the target cannot be reached otherwise. This applies to every position.

#### Scenario: Only two forwards
- **WHEN** the squad has only two players able to play forward
- **THEN** neither forward is proposed

#### Scenario: Only two wide players
- **WHEN** the squad has only two players able to play wide
- **THEN** neither is proposed

#### Scenario: Cover by a possible position
- **WHEN** a full-back has centre-back among his possible positions
- **THEN** he counts as cover for the centre-backs
