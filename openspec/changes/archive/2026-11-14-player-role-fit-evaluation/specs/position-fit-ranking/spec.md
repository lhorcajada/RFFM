## Purpose
Calcula y ordena el encaje de cada jugador en cada puesto unificado combinando sus rasgos de conducta con el peso que cada puesto da a cada rasgo, y permite al entrenador corregir el orden semanal que decide convocar y desconvocar.

## ADDED Requirements

### Requirement: Unified positions
The system SHALL evaluate fit over 8 unified positions: Portero, Central, Lateral/Carrilero, Mediocentro defensivo, Mediocentro, Mediapunta, Extremo and Delantero. Each of the 14 existing demarcations (`DemarcationMaster`) SHALL map to exactly one unified position: Portero is POR; Central includes DFC and LIB; Lateral/Carrilero includes LI and LD; Mediocentro defensivo is MCD; Mediocentro includes MC, MI and MD; Mediapunta is MCO; Extremo includes EI and ED; Delantero includes DC and SD. Carrilero, interior and media punta are not demarcations: they SHALL be covered by Lateral/Carrilero, Mediocentro and Mediapunta respectively, and this version SHALL NOT add demarcations. Side (left or right) SHALL NOT create a different position. Portero SHALL be excluded from fit ranking in this version.

#### Scenario: Mediocampista derecho maps to Mediocentro
- **WHEN** a player's possible demarcation is Mediocampista Derecho (MD)
- **THEN** the player is a candidate for the Mediocentro position

#### Scenario: Side does not split positions
- **WHEN** the team has a Lateral izquierdo and a Lateral derecho
- **THEN** both are candidates of the single position Lateral/Carrilero

#### Scenario: Goalkeeper excluded
- **WHEN** the fit ranking is built
- **THEN** no goalkeeper appears in any position

### Requirement: Candidates by possible positions
A player SHALL be a candidate of every unified position that at least one of their possible demarcations maps to, and of the position of their active demarcation. A player without known demarcations SHALL NOT be a candidate of any position.

#### Scenario: Player competing in two positions
- **WHEN** a player has possible demarcations MC and Mediocampista ofensivo
- **THEN** the player is a candidate of Mediocentro and of Mediapunta and is rated once

#### Scenario: Player without demarcation
- **WHEN** a player has no possible demarcation
- **THEN** the player is not a candidate of any position

### Requirement: Trait weights per position
Each unified position SHALL define a weight for each of the 12 traits with three values: clave, suma and indiferente. Default weights SHALL be provided for every position, and the same weights SHALL apply to left and right sides. The coach SHALL be able to change the weights per team. A trait with weight indiferente SHALL NOT contribute to the fit.

#### Scenario: Default weights exist
- **WHEN** a team has never configured weights
- **THEN** every position has the default weight for every trait

#### Scenario: Team override
- **WHEN** the coach sets `traitPressing` as clave for Mediocentro defensivo
- **THEN** the fit of Mediocentro defensivo candidates uses that weight for the team

### Requirement: Fit score
The fit of a player in a position SHALL be the weighted average of the player's trait levels, using the position's weights, ignoring traits with weight indiferente and traits without a level, with clave counting more than suma. A player with no level in any trait that counts for the position SHALL have no fit. The fit SHALL be shown as a value from 1 to 5 with one decimal.

#### Scenario: Clave counts more than suma
- **WHEN** two players have the same levels except that one is better in a clave trait and the other in a suma trait
- **THEN** the player better in the clave trait has the higher fit

#### Scenario: Indifferent trait ignored
- **WHEN** a trait is indiferente for the position
- **THEN** changing a player's level in it does not change the fit

#### Scenario: No data
- **WHEN** a candidate has no level in any counting trait
- **THEN** the player appears without fit at the end of the list

### Requirement: Proposed order and manual correction
For each position the system SHALL propose an order of its candidates from highest to lowest fit, breaking ties with the weekly trend (sube before igual before baja) and then alphabetically. The coach SHALL be able to reorder the candidates by dragging cards, and the confirmed order SHALL be stored per team, position and week. The page SHALL work from 360px wide with cards, not tables, and reordering SHALL also be possible without dragging. Users without the Coach or Administrator role SHALL see the order read-only.

#### Scenario: Order proposed by fit
- **WHEN** the coach opens a position with candidates of fit 4.2, 3.8 and 4.0
- **THEN** they are listed as 4.2, 4.0, 3.8

#### Scenario: Trend breaks a tie
- **WHEN** two candidates have the same fit and one has trend «sube»
- **THEN** the one with trend «sube» is listed first

#### Scenario: Manual correction stored
- **WHEN** the coach drags the third candidate to the first place and saves
- **THEN** the stored order for that week and position lists that player first

#### Scenario: Keyboard reordering
- **WHEN** the coach moves a candidate with the move up and move down buttons
- **THEN** the order changes without dragging

### Requirement: Latest confirmed order exposed
The system SHALL expose `GET /api/catalog/team/{teamId}/position-fit` returning, for each position, the candidates in their latest confirmed order, with their fit and a flag telling whether the order was corrected manually, and `PUT /api/catalog/team/{teamId}/position-fit/{position}` storing a confirmed order for the current week. Both endpoints SHALL be restricted to Coach and Administrator roles of that team and SHALL return `403` to players and family members. The PUT SHALL reject players that are not candidates of the position and SHALL be atomic. When a position has no confirmed order, the GET SHALL return the proposed order.

#### Scenario: No confirmed order
- **WHEN** a position has no confirmed order
- **THEN** the response contains the proposed order and the manual flag is false

#### Scenario: Non-candidate rejected
- **WHEN** the PUT includes a player who is not a candidate of that position
- **THEN** the system returns `400` and stores nothing

#### Scenario: Coach of another team
- **WHEN** a coach who cannot manage the team sends the PUT
- **THEN** the system returns `403`
