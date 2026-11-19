## ADDED Requirements

### Requirement: The read view shows the whole model as one outline
The coach game-model read view SHALL show every phase that has principles, in ascending `gameMomentId` order with its principles in number order, as one collapsible outline instead of one phase at a time. When the model has set-piece rules, the outline SHALL end with a «Balón parado» section that shows each rule with its subtype label. The outline SHALL be built in the browser from the already loaded model, and the view SHALL NOT alter that model.

#### Scenario: All phases in one outline
- **WHEN** a model with two phases is opened
- **THEN** both phases are shown in ascending order in the same outline

#### Scenario: Set pieces section
- **WHEN** the model has set-piece rules
- **THEN** a «Balón parado» section lists each rule with its subtype label

#### Scenario: No set pieces section without rules
- **WHEN** the model has no set-piece rules
- **THEN** no «Balón parado» section is shown

### Requirement: Search finds nodes at every level
The read view SHALL offer a search field that matches, ignoring case and accents, the titles, texts, trainable texts, skills and notes of every level. A query with several words SHALL match only nodes that contain every word. A query that is exactly one node number, such as `2.3`, SHALL match the node with that number and not its descendants. Matches SHALL be listed in document order and highlighted inside the matching nodes.

#### Scenario: Accent-insensitive match
- **WHEN** the coach searches a title written with an accent by typing it without the accent
- **THEN** the node is found and the matching text is highlighted

#### Scenario: Numeric query
- **WHEN** the coach searches `2.3`
- **THEN** the node numbered 2.3 is a result and its descendants such as 2.3.1 are not

#### Scenario: All words required
- **WHEN** the query has two words that occur only in different nodes
- **THEN** no node is a result

### Requirement: Search results drive expansion and navigation
During a search, the view SHALL expand only the branches that contain a result, plus a matching node whose own text holds the match, without collapsing branches that were already expanded. It SHALL show a counter with the current position and the number of results, and next and previous buttons that move between results and scroll to the current one; Enter and Shift+Enter in the search field SHALL do the same. With no results, the view SHALL show an empty-results message, disable the navigation buttons and leave the outline as it was. Manual toggles made during a search SHALL be dropped when the query changes, and clearing the search SHALL restore the expand and collapse state from before it.

#### Scenario: Deep result is revealed
- **WHEN** a search matches a skill inside a collapsed branch
- **THEN** the branch that contains it expands and the skill is shown

#### Scenario: Result navigation
- **WHEN** the coach presses the next result button
- **THEN** the counter advances and the view scrolls to the next result

#### Scenario: No results
- **WHEN** a search has no matches
- **THEN** an empty-results message naming the query is shown, the navigation buttons are disabled and the outline is unchanged

#### Scenario: Clearing restores the state
- **WHEN** the coach clears an active search
- **THEN** the outline returns to the expand and collapse state it had before the search

### Requirement: Depth levels and collapse control the outline
The read view SHALL offer a depth selector with five levels, «Principios», «Subprincipios», «Zonas», «Sub-subprincipios» and «Habilidades y notas», and SHALL open at the «Subprincipios» level. Each phase, principle, subprincipio, zone and sub-subprincipio SHALL have a button that collapses or expands it. Changing the depth level SHALL discard the manual toggles; manual toggles SHALL be kept until the level changes again. «Expandir todo» SHALL show the complete model and «Contraer todo» SHALL collapse every node.

#### Scenario: Default level
- **WHEN** the view opens
- **THEN** principles and subprincipios are shown and zones are not

#### Scenario: Manual toggle
- **WHEN** the coach presses the button of an expanded node
- **THEN** its content is hidden, and pressing it again shows it

#### Scenario: Level change discards manual toggles
- **WHEN** the coach collapses a node manually and then changes the depth level
- **THEN** the node follows the new level

#### Scenario: Expand and collapse all
- **WHEN** the coach presses «Contraer todo» and then «Expandir todo»
- **THEN** the content is hidden and then shown down to skills and notes

### Requirement: The index lists phases down to subprincipios
The read view SHALL show an index of phases, principles and subprincipios, without zones or lower levels. On wide screens the index SHALL be a side panel; below the medium breakpoint it SHALL open in a drawer from an «Ir a…» button instead, and the drawer SHALL close when an entry is chosen. Choosing an entry SHALL expand its collapsed ancestors and scroll to the node.

#### Scenario: Index content
- **WHEN** the model has a principle with a subprincipio that has zones
- **THEN** the index lists the phase, the principle and the subprincipio but not the zones

#### Scenario: Choosing an entry
- **WHEN** the coach chooses an index entry whose ancestors are collapsed
- **THEN** the ancestors expand and the view scrolls to the node

#### Scenario: Drawer on small screens
- **WHEN** the screen is narrow and the coach presses «Ir a…» and chooses an entry
- **THEN** the index opens in a drawer, and the drawer closes after the choice

### Requirement: Direct links open the model at a section
Phases, principles and subprincipios SHALL offer a direct link that carries the node address in the `nodo` query parameter. Opening the view with that parameter SHALL expand the ancestors of the linked node and scroll to it. A link to a node that no longer exists SHALL open the model at the top with the notice «La sección enlazada ya no existe. Se muestra el modelo desde el principio.».

#### Scenario: Link to an existing node
- **WHEN** the view opens with `nodo` set to the address of a collapsed subprincipio
- **THEN** its ancestors are expanded and the view is positioned on it

#### Scenario: Link to a missing node
- **WHEN** the view opens with `nodo` set to an address that is not in the model
- **THEN** the model is shown from the top with the missing-section notice

### Requirement: One helper defines node addresses
Every game-model node address SHALL come from one helper module. Principles, subprincipios, zones and sub-subprincipios SHALL use the stable key the backend exposes when present, and otherwise the hierarchical path from the phase address through the node numbers; zones without a key SHALL be told apart by their zone keys and label. Skills and notes SHALL be addressed by their API id under their parent address, and set-piece rules under the `set-pieces` address. The read view, direct links and pending-change decorations SHALL use these addresses.

#### Scenario: Stable key preferred
- **WHEN** a principle exposes a stable key
- **THEN** its address is that key

#### Scenario: Number path fallback
- **WHEN** a sub-subprincipio and its ancestors expose no key
- **THEN** its address chains the phase, principle, subprincipio and sub-subprincipio numbers

### Requirement: Pending changes decorate nodes without altering the model
The read view SHALL accept an optional map from node address to a pending change whose operation is add, change or remove. A change or remove SHALL mark the existing node with a «Propuesta: modificar» or «Propuesta: eliminar» badge and show any proposed title or text on it; an add SHALL render a placeholder node under its parent, ordered by its number or placed before the notes of the parent. Changes that point to unknown nodes SHALL be ignored, and the saved model SHALL NOT be altered. A node with a pending change and its ancestors SHALL stay visible and expanded whatever the depth level, manual collapse or active search. The index SHALL mark such nodes with a «Propuesta» badge, and a counter SHALL let the coach jump between pending changes; without pending changes the counter SHALL NOT be shown.

#### Scenario: Pending node stays expanded
- **WHEN** a node has a pending change and the depth level is «Principios»
- **THEN** the node and its ancestors are visible and expanded

#### Scenario: Add renders a placeholder
- **WHEN** a pending add targets a subprincipio as its parent
- **THEN** a placeholder node is shown in its position and the saved model is unchanged

#### Scenario: Jump between pending changes
- **WHEN** the coach presses the next pending change button
- **THEN** the view scrolls to the next node with a pending change

#### Scenario: No counter without changes
- **WHEN** no pending changes are supplied
- **THEN** no pending-change counter is shown
