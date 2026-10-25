## MODIFIED Requirements

### Requirement: League match convocation screen shows availability lists
For league matches, the convocation tab SHALL show, in addition to the existing groups, the groups «Pendientes de respuesta» (players without convocation whose request is `Requested`) and «Disponibles» (players without convocation whose request is `Available`). A player with a convocation SHALL always be shown in the group of their convocation status, except the own player of a Player or FamilyMember, who is shown in the «Tu jugador» card. The waiting list SHALL show the button «Pedir disponibilidad» instead of «Convocar toda la lista de espera». For non-league events the screen SHALL behave as before.

#### Scenario: Request availability button on league match
- **WHEN** a coach opens the convocation tab of a league match with players on the waiting list
- **THEN** the button «Pedir disponibilidad» is shown and «Convocar toda la lista de espera» is not

#### Scenario: Friendly keeps bulk convocation
- **WHEN** a coach opens the convocation tab of a friendly match
- **THEN** the button «Convocar toda la lista de espera» is shown and no availability groups are shown

#### Scenario: Player answers from the event screen
- **WHEN** a player opens a league match where their request is `Requested`
- **THEN** the «Tu jugador» card shows «Sí, disponible» and «No disponible», and «No disponible» asks for a mandatory reason that excludes «Decisión técnica» and «Sanción deportiva»

#### Scenario: Coach convokes from available
- **WHEN** the coach clicks «Convocar» on a player in «Disponibles»
- **THEN** the player moves to «Convocados»

#### Scenario: Coach deconvokes from available
- **WHEN** the coach clicks «Desconvocar» on a player in «Disponibles» and confirms
- **THEN** the player moves to «Desconvocados» with reason «Decisión técnica»

### Requirement: Player lists are grouped by position
Every player list in the convocation tab SHALL order its players by position group, in this order: «Porteros», «Defensas» (centrales, laterales, carrileros, líbero), «Medios» (all midfielders, including the attacking midfielder), «Extremos», «Delanteros» (delantero centro and segundo delantero) and players without position last, keeping the original order within a group. Each row SHALL show the tag of its group: «POR», «DEF», «MED», «EXT» or «DEL», and no tag for players without position. The lists SHALL NOT show position headings.

#### Scenario: Grouping order
- **WHEN** a list contains a Delantero Centro, a Portero, a Lateral Derecho and an Extremo Izquierdo
- **THEN** the rows appear in the order Portero, Lateral Derecho, Extremo Izquierdo, Delantero Centro with the tags POR, DEF, EXT and DEL, and no position heading is shown

#### Scenario: Attacking midfielder and second striker
- **WHEN** a list contains a «Mediocampista ofensivo» and a «Segundo Delantero»
- **THEN** the first shows the tag «MED» and the second the tag «DEL»

#### Scenario: Player without position
- **WHEN** a player has no position
- **THEN** the player is shown last, without a position tag
