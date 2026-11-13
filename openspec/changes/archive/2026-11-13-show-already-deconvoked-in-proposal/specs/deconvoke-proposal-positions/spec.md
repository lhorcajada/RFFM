## ADDED Requirements

### Requirement: Proposal returns already deconvoked players as flagged entries
The deconvocation proposal SHALL return, next to the new proposals, the list of already-deconvoked players: every squad player listed in the not-called list of the convocation (`mgmtNotCalled`) before the proposal is generated, whatever the reason. The list SHALL be built from that existing data with no new data source and SHALL be separate from, and flagged differently to, the players evaluated for deconvocation.

#### Scenario: Every player already out is returned
- **WHEN** two squad players are in `mgmtNotCalled` when the proposal is generated
- **THEN** the proposal returns both of them in its already-deconvoked list

#### Scenario: Reason does not matter
- **WHEN** a player is in `mgmtNotCalled` by technical decision and another has no reason
- **THEN** both are in the already-deconvoked list

#### Scenario: Pending players are not returned
- **WHEN** a player has not answered yet and is not in `mgmtNotCalled`
- **THEN** the player is not in the already-deconvoked list

### Requirement: Already deconvoked players do not alter the proposal
Already-deconvoked players SHALL NOT be proposed again, SHALL NOT count as available, SHALL NOT change the target number of deconvocations, and SHALL be subtracted from their position when the position minimum is evaluated, exactly as a player the algorithm already deconvoked. Applying the proposal SHALL NOT deconvoke them again. The score order and the results for new proposals SHALL be the same as when the already-deconvoked players are not shown.

#### Scenario: Never proposed again
- **WHEN** a player is already deconvoked
- **THEN** the player is not among the players proposed for deconvocation and is not among the remaining evaluated players

#### Scenario: Target unchanged
- **WHEN** a squad of 25 has 3 already-deconvoked players and none is mandatory
- **THEN** the target is 4 deconvocations, the same as when those 3 are not shown

#### Scenario: Position minimum still subtracts them
- **WHEN** 4 centre-backs are in the squad and 2 are already deconvoked
- **THEN** only 2 centre-backs count as available and the centre-back minimum is reported as unmet «Centrales: quedan 2 de 3»

#### Scenario: Applying the proposal leaves them as they are
- **WHEN** the coach applies a proposal that lists an already-deconvoked player
- **THEN** no deconvocation is requested for that player and their existing reason is kept

### Requirement: Proposal panel shows already deconvoked players at the top
The proposal panel SHALL show the already-deconvoked players at the top, in the same block as the players proposed for deconvocation. Inside that block, the new proposals SHALL come first, ordered by score, followed by the already-deconvoked players. Each already-deconvoked player SHALL carry the mark «Ya desconvocado».

#### Scenario: All already-deconvoked players are marked
- **WHEN** the panel is shown with 2 already-deconvoked players
- **THEN** each of them appears with the mark «Ya desconvocado»

#### Scenario: Same block as the proposals
- **WHEN** the panel is shown with 2 proposed players and 1 already-deconvoked player
- **THEN** the 3 players are in the same block at the top of the proposal

#### Scenario: Order inside the block
- **WHEN** the block contains 2 proposed players and 1 already-deconvoked player
- **THEN** the 2 proposed players come first, by score, and the already-deconvoked player comes after them

#### Scenario: No already deconvoked players
- **WHEN** no player is already deconvoked
- **THEN** the panel looks and works as it did before this change and shows no «Ya desconvocado» mark

#### Scenario: Only already deconvoked players remain
- **WHEN** every deconvokable player is already deconvoked and there are no new proposals
- **THEN** the block shows only the already-deconvoked players with the mark «Ya desconvocado» and no empty-list notice
