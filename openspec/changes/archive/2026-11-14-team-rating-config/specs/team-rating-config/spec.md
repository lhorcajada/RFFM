## Purpose
Permite a cada equipo adaptar las capacidades y los rasgos de conducta con los que valora a sus jugadores: añadir, editar y ocultar elementos, partiendo de los valores por defecto y conservando el historial de valoraciones.

## ADDED Requirements

### Requirement: Effective catalog per team
The effective catalog of a team SHALL be made of the default capacities and traits, the team's customizations of them (edited text, hidden) and the elements the team created. Defaults SHALL keep their keys. A team without customizations SHALL see exactly the default catalog. Customizations of a team SHALL NOT affect other teams. The server SHALL resolve the effective set of trait keys for validation and fit; the client SHALL combine the default texts it owns with the team's customizations.

#### Scenario: Team without customizations
- **WHEN** a team has never configured anything
- **THEN** its effective catalog has the 12 default traits and all the default capacities

#### Scenario: Customization is per team
- **WHEN** a team renames a default trait
- **THEN** another team still sees the default name

### Requirement: Read the rating configuration
The system SHALL expose `GET /api/catalog/team/{teamId}/rating-config` returning the team's customizations of capacities (field and goalkeeper) and traits: for each one its key, whether it is custom or a customized default, whether it is hidden and the texts the team changed (label, level texts of capacities, phase and descriptors of traits). Hidden elements SHALL be included, marked as hidden, and defaults the team never touched SHALL NOT be returned. The endpoint SHALL be restricted to Coach and Administrator roles of that team and SHALL return `403` to players and family members and `404` for an unknown team.

#### Scenario: Default configuration
- **WHEN** a coach reads the configuration of a team without customizations
- **THEN** no customization is returned and the client shows the default catalog

#### Scenario: Hidden element is marked
- **WHEN** the team hid a trait
- **THEN** it is returned with `hidden` true

#### Scenario: Player cannot read it
- **WHEN** a player or family member requests the configuration
- **THEN** the system returns `403`

### Requirement: Create a capacity
A Coach or Administrator of the team SHALL be able to create a capacity with a label (required, up to 80 characters), a category among `physical`, `technical`, `tactical` and `competitiveness`, the sheet (`field` or `goalkeeper`) and exactly 10 level texts (each required, up to 200 characters). The system SHALL generate a stable key `custom-<id>` and SHALL NOT allow changing the category, the sheet or the key afterwards.

#### Scenario: Capacity created
- **WHEN** a coach creates the capacity «Juego aéreo ofensivo» in category `technical` for the `field` sheet with 10 level texts
- **THEN** it is part of the team's effective catalog with a generated key and is not hidden

#### Scenario: Missing level texts
- **WHEN** the request has fewer than 10 level texts or one is empty
- **THEN** the system returns `400` and creates nothing

#### Scenario: Unknown category
- **WHEN** the category is not one of the four existing ones
- **THEN** the system returns `400`

### Requirement: Edit a capacity
A Coach or Administrator SHALL be able to change the label and the 10 level texts of any capacity of the team, default or custom. Editing a default capacity SHALL store the customization for that team only; the request carries the key, sheet and category of the default capacity because the server does not own the default texts. Valuations already saved SHALL keep the texts they were saved with.

#### Scenario: Default capacity renamed
- **WHEN** a coach edits the label of the default capacity «Regate»
- **THEN** the team sees the new label and other teams keep «Regate»

#### Scenario: Saved ratings keep their text
- **WHEN** a level text is edited after ratings were saved
- **THEN** the saved ratings still show the text they were saved with

### Requirement: Hide and restore a capacity
A Coach or Administrator SHALL be able to hide and restore any capacity of the team. A hidden capacity SHALL NOT be asked in the characteristic sheet, SHALL NOT count in new ratings, and its saved valuations SHALL be kept and be restorable.

#### Scenario: Hidden capacity not asked
- **WHEN** a capacity is hidden
- **THEN** the characteristic sheet no longer lists it

#### Scenario: Restore
- **WHEN** the coach restores the hidden capacity
- **THEN** it is listed again and its previous valuations are still there

### Requirement: Create a trait
A Coach or Administrator of the team SHALL be able to create a trait with a label (required, up to 80 characters), a phase among `withBall`, `withoutBall`, `transitions` and `transversal`, and descriptors for levels 1, 3 and 5 (each required, up to 200 characters). The system SHALL generate a stable key `custom-<id>` that fits the stored key length. A new trait SHALL have weight «suma» in every unified position until the coach changes it.

#### Scenario: Trait created with default weights
- **WHEN** a coach creates the trait «Juego aéreo»
- **THEN** it appears in the trait rating and in the weights of every position as «Suma»

#### Scenario: Missing descriptor
- **WHEN** a descriptor is empty
- **THEN** the system returns `400` and creates nothing

### Requirement: Edit, hide and restore a trait
A Coach or Administrator SHALL be able to change the label, the phase and the descriptors of any trait of the team, and to hide and restore any trait. A hidden trait SHALL NOT be asked in new ratings, SHALL NOT appear in the weights of the positions and SHALL NOT count in the fit, while its saved levels SHALL be kept.

#### Scenario: Hidden trait does not count in the fit
- **WHEN** a trait is hidden
- **THEN** the fit of every candidate ignores it

#### Scenario: Restored trait counts again
- **WHEN** the trait is restored
- **THEN** its saved levels count again in the fit

### Requirement: Configuration endpoints and authorization
The system SHALL expose `POST` and `PUT` `/api/catalog/team/{teamId}/rating-config/capacities` and `.../traits` to create and edit, and `PUT .../capacities/{key}/visibility` and `.../traits/{key}/visibility` with a `hidden` flag to hide and restore. All SHALL be restricted to Coach and Administrator roles of that team and SHALL return `403` to players, family members and coaches who cannot manage the team, and `404` for an unknown team or for an unknown custom key (a default key is accepted and stored as a customization).

#### Scenario: Coach of another team
- **WHEN** a coach who cannot manage the team creates a trait
- **THEN** the system returns `403` and creates nothing

#### Scenario: Unknown key
- **WHEN** a coach edits a key that does not exist for the team
- **THEN** the system returns `404`

### Requirement: Configure view
The Coach app SHALL provide a view «Configurar» at `/coach/squad/rating-sheet?view=config` (keeping `teamId` and `seasonId`) with the tabs «Capacidades» and «Rasgos». Each tab SHALL list its elements as cards, marking the hidden and the custom ones, with actions to add, edit, hide and restore. Hiding SHALL ask for confirmation with the app's confirmation dialog, and the edit form SHALL validate the required texts before saving. The view SHALL be usable from 360px wide without tables or horizontal scrolling and SHALL be read-only for users without the Coach or Administrator role.

#### Scenario: Add a trait
- **WHEN** the coach fills the form of a new trait and saves
- **THEN** the trait appears in the list and a success message is shown

#### Scenario: Hide asks for confirmation
- **WHEN** the coach hides a trait
- **THEN** a confirmation dialog is shown and the trait is hidden only after confirming

#### Scenario: Hidden shown apart
- **WHEN** a capacity is hidden
- **THEN** its card is marked as hidden and offers «Restaurar»

#### Scenario: Read-only for other roles
- **WHEN** a user without the Coach or Administrator role opens the view
- **THEN** there are no add, edit or hide actions
