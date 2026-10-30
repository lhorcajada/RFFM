# convocation-tabs-redesign Specification

## Purpose
TBD - created by archiving change convocation-tabs-redesign. Update Purpose after archive.
## Requirements
### Requirement: The match tab bar is a scrollable pill selector with counters
The match detail screen SHALL show its tabs «Desconvocatorias», «Convocatoria», «Alineación» and «Simular Partido», in that order, as a pill selector that scrolls horizontally when it does not fit, with touch targets of at least 44px. «Desconvocatorias» SHALL show the number of players with at least one deconvocation and «Convocatoria» the number of called players. The counters SHALL NOT change the accessible name of their tab.

#### Scenario: Order and names
- **WHEN** the user opens the match screen
- **THEN** the tabs are «Desconvocatorias», «Convocatoria», «Alineación» and «Simular Partido» in that order, each reachable by its name

#### Scenario: Counters
- **WHEN** 8 players are called and 4 players have been deconvoked at least once
- **THEN** the «Convocatoria» tab shows 8 and the «Desconvocatorias» tab shows 4
- **AND** the tabs are still found by the names «Convocatoria» and «Desconvocatorias»

### Requirement: The Convocatoria tab shows a summary and compact player rows
The «Convocatoria» tab SHALL show, above the zones, one counter per visible zone (Lista de espera and Pendientes de respuesta only in league matches; Disponibles; Convocados; Desconvocados). Every player of every zone SHALL be shown as a compact row with a circular photo (or default avatar), the dorsal, the name, the position, the average rating with its colour, the streak, the form bars and the tags «Lesionado» or «En recuperación» when they apply, instead of a large card. The rows SHALL NOT be laid out as a table.

#### Scenario: Summary in a league match
- **WHEN** a league match has 1 player waiting, 2 pending an answer, 3 available, 8 called and 2 deconvoked
- **THEN** the summary shows 1, 2, 3, 8 and 2 under the names of their zones

#### Scenario: Summary in a friendly
- **WHEN** a friendly is opened
- **THEN** the summary shows no counter for Lista de espera nor Pendientes de respuesta

#### Scenario: Injured player row
- **WHEN** a player is injured
- **THEN** their row shows «Lesionado»

### Requirement: Players can be moved with buttons as well as by dragging
In the «Convocados» zone each row SHALL offer a «Desconvocar a {nombre}» button that deconvokes the player, and in the «Desconvocados» zone each row SHALL offer a «Convocar a {nombre}» button that calls the player. Dragging between zones SHALL keep working. The buttons SHALL have a touch target of at least 44px and SHALL NOT be shown when the screen does not provide the corresponding action.

#### Scenario: Deconvoke with the button
- **WHEN** the coach presses «Desconvocar a Ana Uno» on a called player
- **THEN** the player is deconvoked and moves to «Desconvocados»

#### Scenario: Call with the button
- **WHEN** the coach presses «Convocar a Bea Dos» on a deconvoked player
- **THEN** the player is called and moves to «Convocados»

### Requirement: The current convocation behaviour is preserved
The redesigned «Convocatoria» tab SHALL keep the zone order, the collapse of each zone, the grouping of called players by position, the bulk call («Seleccionar {nombre}», «Seleccionar todos», «Quitar selección», «Convocar seleccionados (n)»), the «Disponible» action for players pending an answer in league matches, the «Motivo» selector of deconvoked players and the automatic deconvocation proposal flow.

#### Scenario: Bulk call
- **WHEN** the coach selects two available players and presses «Convocar seleccionados (2)»
- **THEN** both players are called

#### Scenario: Zone order
- **WHEN** a league match is opened
- **THEN** the zones appear as Lista de espera, Pendientes de respuesta, Disponibles, Convocados and Desconvocados

### Requirement: Empty zones of the Convocatoria tab are folded
In the «Convocatoria» tab a zone with no players SHALL NOT take a column: it SHALL be shown as a compact button (touch target of at least 44px, `aria-expanded="false"`) with the zone name and a counter of 0, in a row above the columns. Pressing it, or dropping a player on it, SHALL unfold the zone as a normal column. A zone with players SHALL be shown as a column as before.

#### Scenario: Empty zones as buttons
- **WHEN** a league match has no players in Lista de espera, Pendientes de respuesta and Disponibles
- **THEN** those three zones are shown as folded buttons with a counter of 0 and no column
- **AND** Convocados and Desconvocados share the available width

#### Scenario: Unfold an empty zone
- **WHEN** the coach presses the folded «Disponibles» button
- **THEN** the button reports `aria-expanded="true"` and the zone is shown as a column

#### Scenario: Zone with players
- **WHEN** a zone has at least one player
- **THEN** it is shown as a column and not as a folded button

#### Scenario: Drop on a folded zone
- **WHEN** the coach drags a player over a folded zone and drops it
- **THEN** the player is moved to that zone and the zone is shown as a column

### Requirement: The Desconvocatorias tab shows one card per player, without tables
The «Desconvocatorias» tab SHALL list the players with at least one deconvocation as cards, ordered by total deconvocations descending, and SHALL NOT use a table. Each card SHALL show the player name, three figures labelled «Desconvocatorias», «Decisión técnica» and «Jornadas sin técnica», and a history of the matches in which the player was deconvoked whose height stays bounded however many there are. The tab SHALL show a chip per cause with its count and an «Imprimir resumen» action.

#### Scenario: Player card
- **WHEN** a player was deconvoked in 3 matches, 2 of them by technical decision
- **THEN** their card shows «Desconvocatorias» 3, «Decisión técnica» 2 and three match rows each with its cause

#### Scenario: Season strip
- **WHEN** a player was deconvoked in 14 of 20 matches
- **THEN** their card shows one season cell per match, 14 of them marked with the colour of their cause, and the text «Temporada · 20 partidos»

#### Scenario: Last three shown, the rest folded
- **WHEN** a player has 14 deconvocations
- **THEN** their card lists the 3 most recent matches, newest first, each with label, date and cause
- **AND** a «Ver las 11 restantes» control that reveals the other 11 in a scrollable list

#### Scenario: Few deconvocations
- **WHEN** a player has 3 deconvocations or fewer
- **THEN** all of them are listed and there is no «Ver las N restantes» control

#### Scenario: Filter by cause
- **WHEN** a player was deconvoked 6 times for «Enfermedad» out of 14 and the coach presses the «Enfermedad 6» cause button
- **THEN** the button is pressed, only the 6 «Enfermedad» matches are listed and the card says «Mostrando 6 de 14»
- **AND** pressing «Quitar filtro» lists the matches as before

#### Scenario: Cause counters
- **WHEN** the team has 4 technical-decision and 3 injury deconvocations
- **THEN** a chip «Decisión técnica 4» and a chip «Lesión 3» are shown

#### Scenario: No table
- **WHEN** the tab has deconvocations
- **THEN** no table element is rendered

#### Scenario: Sporting sanction
- **WHEN** a deconvocation was forced by a sporting sanction
- **THEN** its match row shows the accessible badge «Desconvocado por sanción deportiva»

#### Scenario: Empty and loading
- **WHEN** the grid is loading, has no matches or has no deconvocations
- **THEN** the loading indicator or the corresponding empty message is shown, as today

### Requirement: Deconvoke a player from the Desconvocatorias tab
Each card SHALL offer «Desconvocar» for a player who is not deconvoked in the current match, and SHALL show «Desconvocado» instead when the player is already deconvoked in it or is injured.

#### Scenario: Deconvoke from the card
- **WHEN** the coach presses «Desconvocar» on the card of a player called in the current match
- **THEN** the player is deconvoked in the current match

#### Scenario: Already deconvoked
- **WHEN** a player is already deconvoked in the current match
- **THEN** their card shows «Desconvocado» and no «Desconvocar» button

