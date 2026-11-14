## MODIFIED Requirements

### Requirement: Behavior trait catalog
The system SHALL define a catalog of behavior traits per team, each with a stable key, a Spanish label, a game phase and a short descriptor for levels 1, 3 and 5. A team without customizations SHALL have the 12 default traits grouped in four phases: con balón (`traitOccupiesZone` ocupa su zona y da apoyo o amplitud, `traitBuildsUnderPressure` sale jugando bajo presión, `traitBreaksLines` rompe líneas, `traitBeatsOneOnOne` desequilibra 1vs1, `traitArrivesAndFinishes` llega al área y finaliza); sin balón (`traitCoverage` posición y cobertura, `traitPressing` presiona y orienta, `traitDuels` gana duelos); transiciones (`traitReactsToLoss` reacciona a la pérdida, `traitFirstActionAfterRecovery` primera acción tras recuperar); transversales (`traitRoleDiscipline` cumple su rol, `traitSustainedIntensity` intensidad sostenida). A team MAY edit, hide and add traits (see `team-rating-config`). The catalog of a team SHALL be the same for every field position, and hidden traits SHALL NOT be asked in new ratings.

#### Scenario: Catalog is complete and grouped by phase
- **WHEN** the coach of a team without customizations opens the trait rating
- **THEN** the 12 traits are shown grouped under their four phases

#### Scenario: Role discipline is its own trait
- **WHEN** the default catalog is listed
- **THEN** `traitRoleDiscipline` appears as a separate trait and is not merged into another trait

#### Scenario: Custom and hidden traits
- **WHEN** a team created the trait «Juego aéreo» and hid `traitDuels`
- **THEN** the trait rating of that team asks «Juego aéreo» and does not ask «Gana duelos»

### Requirement: Trait rating endpoints and authorization
The system SHALL expose `GET /api/catalog/team/{teamId}/trait-ratings/latest` returning each player's latest trait rating, and `POST /api/catalog/team/{teamId}/trait-ratings` creating a batch of ratings atomically. Both endpoints SHALL be restricted to Coach and Administrator roles of that team and SHALL return `403` to players and family members, because trait ratings are internal technical staff assessments. The POST SHALL reject players that do not belong to the team with code `RatingPlayerNotInTeam`, repeated players, trait keys that are not part of the team's effective catalog or that are hidden, and more than 100 items, and SHALL return `403` for a coach who cannot manage the team. The GET SHALL keep returning the saved levels of traits that were later hidden.

#### Scenario: Batch created
- **WHEN** a coach of the team sends ratings for two team players
- **THEN** two ratings are created with the same date and are returned

#### Scenario: Player from another team
- **WHEN** the batch includes a player of another team
- **THEN** the system returns `400` with code `RatingPlayerNotInTeam` and creates nothing

#### Scenario: Unknown trait key
- **WHEN** an item contains a trait key that is not in the team's catalog
- **THEN** the system returns `400` and creates nothing

#### Scenario: Hidden trait rejected in new ratings
- **WHEN** an item contains a trait the team has hidden
- **THEN** the system returns `400` and creates nothing

#### Scenario: Custom trait accepted
- **WHEN** an item contains a trait the team created
- **THEN** the rating is created

#### Scenario: History of a hidden trait kept
- **WHEN** a trait with saved levels is hidden
- **THEN** the latest ratings still return those levels

#### Scenario: Coach of another team
- **WHEN** a coach who cannot manage the team sends a batch
- **THEN** the system returns `403`
