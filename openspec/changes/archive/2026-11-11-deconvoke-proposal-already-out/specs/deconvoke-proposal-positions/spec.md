## ADDED Requirements

### Requirement: Already deconvoked players are out of the proposal
The deconvocation proposal SHALL treat as already out every squad player that is already deconvoked, whatever the reason, including a technical decision or no reason at all. Players already out SHALL NOT be proposed again, SHALL NOT count towards any position minimum or cover, and SHALL NOT count towards the number of players still available. The target count SHALL be the larger of the number of mandatory deconvocations and the available players minus 18, never less than 0. Players who have not answered yet SHALL NOT be treated as out.

#### Scenario: Technical decision counts as already out
- **WHEN** a squad of 25 has 3 players already deconvoked by technical decision and none of them is mandatory
- **THEN** the target is 4 deconvocations, and none of those 3 players is proposed

#### Scenario: Deconvoked without reason
- **WHEN** a player is deconvoked and has no reason
- **THEN** the player is not proposed again and does not count as available for any minimum

#### Scenario: Pending players stay available
- **WHEN** a player has not answered yet and is not deconvoked
- **THEN** the player counts as available

#### Scenario: Already out reduces position counts
- **WHEN** 6 central midfielders are in the squad and 3 of them are already deconvoked by technical decision
- **THEN** only 3 central midfielders count as available and none of them is proposed

## MODIFIED Requirements

### Requirement: Position roles
The deconvocation proposal SHALL classify each player by the role of their active position: goalkeeper (POR), full-back (LI, LD), centre-back (DFC, LIB), central midfielder (MC, MCD and Mediocampista ofensivo), wide (Mediocampista izquierdo, Mediocampista derecho, EI, ED), forward (DC, SD). There SHALL be no separate attacking-midfielder role or minimum. A player without a known active position SHALL have no role and SHALL NOT count towards any minimum.

#### Scenario: Libero counts as centre-back
- **WHEN** a player's active position is Líbero
- **THEN** the player counts as a centre-back

#### Scenario: Winger counts as wide
- **WHEN** a player's active position is Extremo Derecho
- **THEN** the player counts as wide, not as midfielder

#### Scenario: Offensive midfielder counts as central midfielder
- **WHEN** a player's active position is Mediocampista ofensivo
- **THEN** the player counts as a central midfielder

#### Scenario: Side midfielder counts as wide
- **WHEN** a player's active position is Mediocampista derecho
- **THEN** the player counts as wide, not as central midfielder

### Requirement: Minimum squad structure
After applying the proposal, the players that remain called SHALL include, whenever the available squad allows it: at least 1 goalkeeper, 2 full-backs, 3 centre-backs, 3 central midfielders, 3 wide players plus 1 more player able to play wide, and 1 forward plus 1 more player able to play as forward. Only available players (squad minus those already deconvoked) SHALL count. Players SHALL count towards a minimum through their active position. A player SHALL count through a possible (non-active) demarcation only when the specialists of that role are not enough, and only if their own role stays at or above its minimum without them. That cover SHALL only fill gaps left by mandatory deconvocations, by players already out or by a short squad: the proposal SHALL NOT propose a non-mandatory specialist when doing so leaves their role below its minimum counting only active positions. «Able to play wide/forward» SHALL include any remaining player whose active position or possible demarcations include a wide/forward position.

#### Scenario: Four defenders among the lowest scores
- **WHEN** 22 players are called with exactly 2 full-backs and 4 centre-backs, the target is 4 deconvocations and the 4 lowest scores are 3 centre-backs and a full-back
- **THEN** only 1 centre-back is proposed, the other three proposals are the next-lowest players of lines with margin, and no full-back is proposed

#### Scenario: Only one forward called
- **WHEN** only one forward is called and the only other player able to play as forward is an attacking midfielder with the lowest score
- **THEN** the attacking midfielder is not proposed and their card says they are protected as forward cover

#### Scenario: Wide cover
- **WHEN** 4 wide players are called and nobody else can play wide
- **THEN** no wide player is proposed

#### Scenario: Specialists missing, versatile player covers
- **WHEN** only 1 full-back is called and a centre-back has Lateral Derecho among their possible demarcations, with 4 centre-backs called
- **THEN** that centre-back is protected as full-back cover and the full-back minimum counts as met

#### Scenario: Versatile player does not replace an available specialist
- **WHEN** 2 right-backs and 2 left-backs are called, one right-back is injured and one left-back is a mandatory deconvocation, and a centre-back has Lateral Derecho among their possible demarcations
- **THEN** the remaining right-back is not proposed even if their score is the lowest, and their card says «Protegido: quedan 2 de 2 laterales disponibles»

#### Scenario: Within-line selection
- **WHEN** a line has margin over its minimum
- **THEN** the proposed player of that line is the one with the lowest score in it

#### Scenario: Players already out do not count
- **WHEN** 4 centre-backs are in the squad and 2 are already deconvoked by technical decision
- **THEN** only 2 centre-backs count as available and the centre-back minimum is reported as unmet «Centrales: quedan 2 de 3»

### Requirement: Proposal shows roles and position warnings
Each proposal card SHALL show the player's role («Central», «Lateral», «Medio centro», «Banda», «Delantero», «Portero» or «Sin posición»). A player kept because of a minimum SHALL show a factor with the reason and the real count of available players of that position that would remain, e.g. «Protegido: quedan 3 de 3 medios centro disponibles» or «Protegido: cobertura de delantero». The factor value SHALL be that remaining count. When minimums are unmet, the proposal header SHALL list them. The view SHALL stay usable from 360px wide.

#### Scenario: Warning visible
- **WHEN** the proposal reports that only 2 of 3 centre-backs remain
- **THEN** the header shows «Centrales: quedan 2 de 3»

#### Scenario: No warnings
- **WHEN** all minimums are met
- **THEN** no position warning is shown

#### Scenario: Protected card shows remaining count
- **WHEN** exactly 3 central midfielders are available and removing one would leave 2
- **THEN** the card of each of them says «Protegido: quedan 3 de 3 medios centro disponibles» and the factor value is 3

#### Scenario: Protected card with a larger pool
- **WHEN** 6 central midfielders are in the squad, 3 are already deconvoked and 3 remain available
- **THEN** the card of each remaining one says «Protegido: quedan 3 de 3 medios centro disponibles»
