## Purpose
Permite valorar cada semana lo que cada jugador de campo hace en partido, mediante un catálogo común de rasgos de conducta agrupados por fase del juego, para complementar las características de capacidad existentes y alimentar el encaje por puesto.

## ADDED Requirements

### Requirement: Behavior trait catalog
The system SHALL define a single catalog of 12 behavior traits, each with a stable key, a Spanish label, a game phase and a short descriptor for levels 1, 3 and 5. The phases and traits SHALL be: con balón (`traitOccupiesZone` ocupa su zona y da apoyo o amplitud, `traitBuildsUnderPressure` sale jugando bajo presión, `traitBreaksLines` rompe líneas, `traitBeatsOneOnOne` desequilibra 1vs1, `traitArrivesAndFinishes` llega al área y finaliza); sin balón (`traitCoverage` posición y cobertura, `traitPressing` presiona y orienta, `traitDuels` gana duelos); transiciones (`traitReactsToLoss` reacciona a la pérdida, `traitFirstActionAfterRecovery` primera acción tras recuperar); transversales (`traitRoleDiscipline` cumple su rol, `traitSustainedIntensity` intensidad sostenida). The catalog SHALL be the same for every field position.

#### Scenario: Catalog is complete and grouped by phase
- **WHEN** the coach opens the trait rating
- **THEN** the 12 traits are shown grouped under their four phases

#### Scenario: Role discipline is its own trait
- **WHEN** the catalog is listed
- **THEN** `traitRoleDiscipline` appears as a separate trait and is not merged into another trait

### Requirement: Trait scale
Each trait SHALL be rated on a scale of 5 levels (1 to 5) describing how often the player does it in matches. A player SHALL have at most one level per trait in a given rating. Goalkeepers SHALL NOT be rated with the trait catalog in this version.

#### Scenario: Level out of range rejected
- **WHEN** a rating contains level 6 for a trait
- **THEN** the system rejects it with `400` ProblemDetails and stores nothing

#### Scenario: Goalkeeper excluded
- **WHEN** the coach opens the trait rating
- **THEN** goalkeepers are not listed

### Requirement: Weekly trait rating with carry-over
The system SHALL store trait ratings per team player and per week, with the date of the rating. When the coach opens the trait rating, every player SHALL start from their latest stored trait levels and the coach SHALL only need to change what differs. Saving SHALL create new ratings only for players whose levels changed or whose trend was set, and SHALL keep the previous ratings unchanged. A player without any previous trait rating SHALL start with no level in any trait.

#### Scenario: Carry-over from previous week
- **WHEN** a player had `traitCoverage` 4 last week and the coach opens the rating
- **THEN** the player appears with level 4 in `traitCoverage`

#### Scenario: Only changed players saved
- **WHEN** the coach changes one trait of one player and saves
- **THEN** exactly one new rating is created and the other players keep their previous rating

#### Scenario: History preserved
- **WHEN** a player with a stored rating is saved with a changed level
- **THEN** the player has two ratings and the earlier one is unchanged

### Requirement: Weekly trend
For each player the coach SHALL be able to mark a weekly trend of «sube», «igual» or «baja». The trend SHALL be stored with the weekly rating, SHALL default to «igual», and SHALL NOT alter any trait level.

#### Scenario: Trend stored
- **WHEN** the coach marks a player as «baja» and saves
- **THEN** the new rating stores the trend «baja» and the trait levels are unchanged

### Requirement: Trait rating endpoints and authorization
The system SHALL expose `GET /api/catalog/team/{teamId}/trait-ratings/latest` returning each player's latest trait rating, and `POST /api/catalog/team/{teamId}/trait-ratings` creating a batch of ratings atomically. Both endpoints SHALL be restricted to Coach and Administrator roles of that team and SHALL return `403` to players and family members, because trait ratings are internal technical staff assessments. The POST SHALL reject players that do not belong to the team with code `RatingPlayerNotInTeam`, repeated players, unknown trait keys and more than 100 items, and SHALL return `403` for a coach who cannot manage the team.

#### Scenario: Batch created
- **WHEN** a coach of the team sends ratings for two team players
- **THEN** two ratings are created with the same date and are returned

#### Scenario: Player from another team
- **WHEN** the batch includes a player of another team
- **THEN** the system returns `400` with code `RatingPlayerNotInTeam` and creates nothing

#### Scenario: Unknown trait key
- **WHEN** an item contains a trait key that is not in the catalog
- **THEN** the system returns `400` and creates nothing

#### Scenario: Coach of another team
- **WHEN** a coach who cannot manage the team sends a batch
- **THEN** the system returns `403`

### Requirement: Trait rating UI
The Coach app SHALL provide the trait rating at `/coach/squad/rating-sheet` preserving `teamId` and `seasonId`, showing for each field player a card with the 12 traits grouped by phase, the 1–5 selector for each, the previous level marked, and the trend selector. The page SHALL be usable from 360px wide without tables or horizontal scrolling. Users without the Coach or Administrator role SHALL see it read-only. Leaving with unsaved changes SHALL ask for confirmation with the app's confirmation dialog.

#### Scenario: Mobile layout
- **WHEN** the page is opened at 360px wide
- **THEN** player cards are stacked and there is no horizontal scroll

#### Scenario: Read-only for other roles
- **WHEN** a user without the Coach or Administrator role opens the page
- **THEN** there is no save button and the selectors are disabled

#### Scenario: Unsaved changes confirmation
- **WHEN** the coach changes a level and tries to leave
- **THEN** a confirmation dialog is shown before leaving

### Requirement: Trait board view
The trait rating page SHALL offer two views, «Por rasgo» (default) and «Por jugador». «Por rasgo» SHALL list the 12 traits grouped by phase with the progress of players rated in each, and for the selected trait SHALL show the 5 levels with their descriptor and the players placed in each level, plus a «Sin colocar» tray with the players without a level for that trait, as the characteristic sheet does. A Coach or Administrator SHALL place players by selecting one or more player chips and then a level; selecting «Sin colocar» removes their level. Both views SHALL share the same unsaved changes, and goalkeepers SHALL NOT appear.

#### Scenario: Players start in their latest level
- **WHEN** a player's latest trait rating has level 4 for «Posición y cobertura» and the coach selects that trait
- **THEN** the player appears in level 4

#### Scenario: Unrated player starts unplaced
- **WHEN** a player has no level for the selected trait
- **THEN** the player appears in «Sin colocar»

#### Scenario: Place several players at once
- **WHEN** the coach taps two players and then level 5
- **THEN** both players appear in level 5 and the save button counts them

#### Scenario: Progress per trait
- **WHEN** 2 of the 3 players have a level for a trait
- **THEN** that trait shows «2/3»

#### Scenario: Changes are shared between views
- **WHEN** the coach places a player in level 5 in «Por rasgo» and switches to «Por jugador»
- **THEN** the player's card shows level 5 selected for that trait

