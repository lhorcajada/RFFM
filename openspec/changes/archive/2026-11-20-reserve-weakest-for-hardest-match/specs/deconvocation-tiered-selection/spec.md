## ADDED Requirements

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

## REMOVED Requirements

### Requirement: Strong players stay called when a hard match is ahead
**Reason**: Replaced by "Strong players stay called against a hard rival" and "Weakest players are reserved for the hardest match": keeping strong players in a medium match was not wanted, and the weakest are what must be saved for the hard match.
**Migration**: None; the behavior is replaced by the two new requirements.

### Requirement: Forward cover
**Reason**: Replaced by "Position cover", which applies to every position.
**Migration**: None; forwards are covered by the general rule.
