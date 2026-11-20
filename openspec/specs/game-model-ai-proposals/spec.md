# game-model-ai-proposals Specification

## Purpose
TBD - created by archiving change game-model-ai-assistant. Update Purpose after archive.
## Requirements
### Requirement: Each proposed change is validated against the current model
The backend SHALL validate each proposed change against the current game model before the proposal is returned. A change that points to a node that does not exist, or that has invalid fields, SHALL be discarded, and the user SHALL be told how many changes were discarded. Field rules that already apply to saving the model, such as the closed Habilidad name vocabulary, SHALL apply to proposed changes.

#### Scenario: Change to a missing node
- **WHEN** a proposed change points to a node address that is not in the model
- **THEN** the change is discarded and does not become a card

#### Scenario: Invalid field
- **WHEN** a proposed add carries a Habilidad name outside the closed vocabulary
- **THEN** the change is discarded

#### Scenario: Count of discarded changes
- **WHEN** two of five proposed changes are discarded
- **THEN** three cards appear and the user is told that two changes were discarded

### Requirement: A node has at most one proposed change
A proposal SHALL hold at most one change per node address. When a reply holds more than one change for the same node address, the backend SHALL keep the first and discard the others, and the discarded ones SHALL be counted in the number of discarded changes told to the user.

#### Scenario: Two changes for the same node
- **WHEN** a reply holds two changes for the same subprincipio address
- **THEN** only the first becomes a card and the user is told that one change was discarded

### Requirement: The assistant never changes the model without per-card acceptance
The assistant SHALL NOT write the game model directly. A proposed change SHALL reach the saved model only after the coach accepts its card.

#### Scenario: Nothing accepted
- **WHEN** the coach rejects every card of a proposal
- **THEN** nothing is saved and the model is unchanged

#### Scenario: Partly accepted
- **WHEN** the coach accepts two of three cards and rejects one
- **THEN** only the two accepted changes are applied to the saved model

### Requirement: One card per node in the read view
The proposal SHALL appear as one card per node, shown on that node in the read view. A card SHALL show the operation (add, change or remove) and the proposed title or text, and SHALL offer actions to accept and to reject it. The read view SHALL receive the pending changes as input and SHALL hold no assistant state.

#### Scenario: Card on the affected node
- **WHEN** a proposal changes the text of a subprincipio
- **THEN** a card with the proposed text and the accept and reject actions is shown on that subprincipio

#### Scenario: Card for an add
- **WHEN** a proposal adds a node under a principle
- **THEN** a card is shown in the placeholder node under that principle

### Requirement: Cards are accepted or rejected independently
Each card SHALL be accepted or rejected independently of the others. Accepting or rejecting a card SHALL remove its decoration from the node. Accepting a card SHALL apply its change to the local copy of the model tree, and rejecting it SHALL drop the change.

#### Scenario: Accept one card
- **WHEN** the coach accepts one of two cards
- **THEN** the change is applied to the local tree, its decoration disappears and the other card stays pending

#### Scenario: Reject one card
- **WHEN** the coach rejects a card
- **THEN** its decoration disappears and the node is unchanged

### Requirement: A dependent change follows its parent
A change that depends on another proposed change, such as an add under a node that another proposed add creates, SHALL be acceptable only after its parent change is accepted. Rejecting the parent SHALL reject its dependents.

#### Scenario: Dependent before parent
- **WHEN** a pending change depends on a parent change that is not accepted yet
- **THEN** the accept action of the dependent change is not available

#### Scenario: Parent rejected
- **WHEN** the coach rejects a parent change that has two dependent changes
- **THEN** the parent and both dependents are rejected

### Requirement: A pending change whose node no longer exists is discarded
A pending change whose node no longer exists in the local tree SHALL be discarded, and the user SHALL see a notice about it.

#### Scenario: Node removed by an accepted change
- **WHEN** the coach accepts the removal of a subprincipio while a change to one of its zones is still pending
- **THEN** the pending change to the zone is discarded and a notice tells the coach

### Requirement: Accepted changes are saved in one save
The accepted changes SHALL be saved in one save through the existing game-model update, sent as the full tree with the accepted changes applied. When a save fails, the saved model SHALL stay unchanged.

#### Scenario: Several accepted changes
- **WHEN** the coach has accepted three changes and saves
- **THEN** one update request carries the tree with all three changes applied

#### Scenario: Failed save
- **WHEN** the update request fails
- **THEN** the saved model is unchanged

### Requirement: A stale proposal cannot be saved
A proposal SHALL be tied to the version marker of the game model captured when the proposal was built. When the model has changed after that moment, saving SHALL NOT overwrite it, and the user SHALL be asked to regenerate the proposal.

#### Scenario: Model changed after the proposal
- **WHEN** the model is saved by someone else after a proposal is built and the coach then saves accepted changes
- **THEN** the save is refused, the model keeps the other change and the user is asked to regenerate the proposal

#### Scenario: Model unchanged
- **WHEN** the model has not changed since the proposal was built
- **THEN** the save succeeds

