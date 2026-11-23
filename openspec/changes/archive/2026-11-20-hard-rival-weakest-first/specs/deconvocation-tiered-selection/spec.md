## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Strong players stay called when a hard match is ahead
Strong players are those strictly above the rating that closes the top third of the called players; nobody is strong when all ratings are equal. Against a hard rival, or when the rival is not hard and one of the next 5 league matches is hard, the proposal SHALL NOT propose strong players while other eligible players can reach the target. In the second case non-strong players SHALL go first after consecutive matchdays and call surplus. The proposal SHALL state the matches considered.

#### Scenario: Hard match ahead
- **WHEN** the rival is medium, the third next match is hard and a strong player is the first by fairness order
- **THEN** a non-strong eligible player is proposed instead

#### Scenario: Not enough alternatives
- **WHEN** only strong players remain eligible and the target is not reached
- **THEN** strong players are proposed to reach the target

#### Scenario: No hard match ahead
- **WHEN** the current and the next 5 matches are not hard
- **THEN** strong players are limited to half of the target, at least one, and no preference applies

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

### Requirement: Forward cover
When a forward would be proposed, at least 2 of the remaining called players SHALL be able to play forward, through their active or a possible position. Otherwise the forward SHALL stay called, the card SHALL say how many remain, and the rule SHALL give way only to a mandatory deconvocation or when the target cannot be reached otherwise.

#### Scenario: Only two forwards
- **WHEN** the squad has only two players able to play forward
- **THEN** neither forward is proposed

#### Scenario: Cover by a possible position
- **WHEN** a winger has forward among his possible positions
- **THEN** he counts as forward cover

#### Scenario: Three forwards
- **WHEN** the squad has three forwards
- **THEN** one of them can be proposed
