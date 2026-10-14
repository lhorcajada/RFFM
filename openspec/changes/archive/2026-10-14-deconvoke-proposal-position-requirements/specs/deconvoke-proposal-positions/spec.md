## ADDED Requirements

### Requirement: Team players expose demarcation ids
`GET /api/catalog/team/{teamId}/players` SHALL return, for each player, `activePositionId` (the `DemarcationMaster` id of the active position, or `null` when the player has none) and `possibleDemarcationIds` (the ids of all the player's possible demarcations, empty when none). Existing fields SHALL be unchanged.

#### Scenario: Player with several positions
- **WHEN** a player has active position Medio Centro (6) and possible demarcations Medio Centro (6) and Mediocampista ofensivo (8)
- **THEN** the response for that player has `activePositionId` 6, `possibleDemarcationIds` [6, 8] and `position` «Medio Centro»

#### Scenario: Player without positions
- **WHEN** a player has no demarcation
- **THEN** the response has `activePositionId` `null` and `possibleDemarcationIds` []

### Requirement: Position roles
The deconvocation proposal SHALL classify each player by the role of their active position: goalkeeper (POR), full-back (LI, LD), centre-back (DFC, LIB), central midfielder (MC, MCD), attacking midfielder (MCO), wide (MI, MD, EI, ED), forward (DC, SD). A player without a known active position SHALL have no role and SHALL NOT count towards any minimum.

#### Scenario: Libero counts as centre-back
- **WHEN** a player's active position is Líbero
- **THEN** the player counts as a centre-back

#### Scenario: Winger counts as wide
- **WHEN** a player's active position is Extremo Derecho
- **THEN** the player counts as wide, not as midfielder

### Requirement: Minimum squad structure
After applying the proposal, the players that remain called SHALL include, whenever the called squad allows it: at least 1 goalkeeper, 2 full-backs, 3 centre-backs, 3 central midfielders, 1 attacking midfielder, 3 wide players plus 1 more player able to play wide, and 1 forward plus 1 more player able to play as forward. Players SHALL count towards a minimum through their active position. A player SHALL count through a possible (non-active) demarcation only when the specialists of that role are not enough, and only if their own role stays at or above its minimum without them. That cover SHALL only fill gaps left by mandatory deconvocations or by a short squad: the proposal SHALL NOT propose a non-mandatory specialist when doing so leaves their role below its minimum counting only active positions. «Able to play wide/forward» SHALL include any remaining player whose active position or possible demarcations include a wide/forward position.

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
- **THEN** the remaining right-back is not proposed even if their score is the lowest, and their card says «Protegido: mínimo de 2 laterales»

#### Scenario: Within-line selection
- **WHEN** a line has margin over its minimum
- **THEN** the proposed player of that line is the one with the lowest score in it

### Requirement: Mandatory deconvocations and target prevail
Players whose deconvocation is mandatory (`forced`) SHALL always be proposed, even if a minimum is broken. The proposal SHALL keep its target count; when a minimum cannot be met without missing the target, it SHALL propose the lowest-scored remaining candidates and report the unmet minimums. The proposal SHALL expose the list of unmet minimums, each with the role, the required count and the count that remains.

#### Scenario: Injured centre-back breaks the minimum
- **WHEN** only 3 centre-backs are called and one of them is a mandatory deconvocation
- **THEN** that centre-back is proposed and the proposal reports «Centrales: quedan 2 de 3»

#### Scenario: Minimums cannot all be kept
- **WHEN** every remaining candidate belongs to a line at its minimum and deconvocations are still needed to reach the target
- **THEN** the lowest-scored candidates are proposed until the target is reached and every broken minimum is reported

### Requirement: Proposal shows roles and position warnings
Each proposal card SHALL show the player's role («Central», «Lateral», «Medio centro», «Mediapunta», «Banda», «Delantero», «Portero» or «Sin posición»). A player kept because of a minimum SHALL show a factor with the reason (e.g. «Protegido: mínimo de 3 centrales», «Protegido: cobertura de delantero»). When minimums are unmet, the proposal header SHALL list them. The view SHALL stay usable from 360px wide.

#### Scenario: Warning visible
- **WHEN** the proposal reports that only 2 of 3 centre-backs remain
- **THEN** the header shows «Centrales: quedan 2 de 3»

#### Scenario: No warnings
- **WHEN** all minimums are met
- **THEN** no position warning is shown
