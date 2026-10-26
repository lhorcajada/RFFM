## MODIFIED Requirements

### Requirement: League statistics on the squad cards
Each player card in the «Plantilla» tab SHALL show a block labelled «Solo liga» with Goles, Convocatorias, Titular, Amarillas, Rojas and Minutos, replacing the previous all-matches season row. The label «Solo liga» on every block SHALL be the only indication that the figures count league matches only; the tab SHALL NOT show a separate notice. Users with the player or family member role SHALL see the block on the cards of all the players of the team, without the «Minutos» figure (for now); coaches and administrators SHALL see all six figures; fans SHALL see no block.

#### Scenario: Coach sees league figures
- **WHEN** a coach opens the «Plantilla» tab and league data has loaded
- **THEN** every card shows the «Solo liga» label with its six figures and no separate notice is shown

#### Scenario: Player or family member
- **WHEN** a player or family member opens the tab
- **THEN** every card shows Goles, Convocatorias, Titular, Amarillas and Rojas, and no card shows «Minutos»

#### Scenario: Fan
- **WHEN** a fan opens the tab
- **THEN** no card shows the figures

#### Scenario: League data fails to load
- **WHEN** the league statistics request fails
- **THEN** the cards render without the block and the page remains usable
