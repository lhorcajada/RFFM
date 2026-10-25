## ADDED Requirements

### Requirement: Rounds stay reachable while scrolling
The «Resultados» page SHALL show the rounds in a navigation bar labelled «Jornadas» that stays pinned to the top of the page scroll area, instead of tabs. The bar SHALL offer «Jornada anterior» and «Jornada siguiente» buttons (disabled on the first and last round), one button per round labelled «J» followed by the round number, and a «Jornada actual» button that selects the round auto-selected when the page loaded (disabled while that round is selected). The selected round button SHALL be marked as pressed.

#### Scenario: Next round
- **WHEN** the coach is on round 7 and presses «Jornada siguiente»
- **THEN** round 8 is selected and its matches are shown

#### Scenario: First round
- **WHEN** round 1 is selected
- **THEN** «Jornada anterior» is disabled

#### Scenario: Back to the current round
- **WHEN** the page auto-selected round 8 and the coach selected round 3
- **THEN** pressing «Jornada actual» selects round 8 again

### Requirement: Round buttons show the own team's outcome
Each round button SHALL show, for a played round, the letter of the own team's outcome: «V» (win), «E» (draw) or «D» (loss), and for a round not yet played, its date. The accessible name of each round button SHALL be «Jornada N» followed by «victoria», «empate», «derrota», «jornada actual» or «por jugar». The own team's outcome SHALL come from the whole-season calendar, except for the selected round once its match day is loaded, which SHALL take precedence.

#### Scenario: Won round
- **WHEN** the own team won 2–1 in round 3
- **THEN** the button «J3» shows «V» and its accessible name is «Jornada 3, victoria»

#### Scenario: Round not played
- **WHEN** round 10 has not been played yet
- **THEN** the button «J10» shows the round date

#### Scenario: Fresher selected round
- **WHEN** the whole-season calendar still has round 7 unplayed but the loaded match day of round 7 has the own match finished 0–0
- **THEN** the button «J7» shows «E»

### Requirement: The own team's match is shown first
When the team has an RFFM team code, the page SHALL show the own team's match of the selected round first, in a «Tu partido» card, above and outside the rest of the round. The card SHALL show both teams (the own team highlighted), the score when played or the kick-off time otherwise, the date and time, the field, the outcome as «Victoria», «Empate» or «Derrota» with the score from the own team's point of view, and a «Ver acta» link when an acta link can be resolved. When the own team rests in the round, the card SHALL say «Descansa». The own match SHALL NOT appear again in the rest of the round.

#### Scenario: Played own match
- **WHEN** the own team lost 1–3 at home in the selected round
- **THEN** the «Tu partido» card shows «1 – 3» and «Derrota 1–3»
- **AND** the match is not listed under «Resto de la jornada»

#### Scenario: Away win from the own team's point of view
- **WHEN** the own team won 0–2 away
- **THEN** the card shows «Victoria 2–0»

#### Scenario: Upcoming own match
- **WHEN** the own match of the selected round has no result yet and starts at 11:00
- **THEN** the card shows «11:00» and no outcome

#### Scenario: Own team rests
- **WHEN** the own team appears in a «Descansa» entry of the selected round
- **THEN** the «Tu partido» card says «Descansa»

#### Scenario: Team without RFFM team code
- **WHEN** the team has no RFFM team code
- **THEN** no «Tu partido» card is shown and every match of the round is listed under «Partidos de la jornada»

### Requirement: The rest of the round is shown as compact cards
The page SHALL list every other match of the selected round under «Resto de la jornada» as a compact card with the home team, the score or the kick-off time, the away team and the date, plus a «Ver acta» link when an acta link can be resolved. The list SHALL NOT use tables.

#### Scenario: Acta links
- **WHEN** the selected round has the own match and two other matches with acta codes
- **THEN** three «Ver acta» links are shown

### Requirement: Team names and crests
Every team shown on the page («Tu partido», «Resto de la jornada» and the «Tu temporada» rival) SHALL show its full name, wrapping to more lines when needed and never truncated with an ellipsis, at every screen width. Each of those teams SHALL show its crest, resolving RFFM relative crest paths against `https://www.rffm.es`, with the accessible name «Escudo de» followed by the team name; a team without crest SHALL show its initials instead.

#### Scenario: Relative crest path
- **WHEN** a match of the round has the visitor crest `/escudos/visitante.png`
- **THEN** the card shows the image «Escudo de» plus the visitor name with source `https://www.rffm.es/escudos/visitante.png`

#### Scenario: Team without crest
- **WHEN** a team has no crest URL
- **THEN** its initials are shown instead of an image

### Requirement: Suspended matches are tagged
A match with RFFM status «3» SHALL be considered suspended: it SHALL NOT count as played (no outcome letter, no outcome text and not included in the season summary). The «Tu partido» card SHALL show the status «Suspendido»; each suspended match of «Resto de la jornada» SHALL show a «Suspendido» tag; the round button of a round whose own match is suspended SHALL show «Susp.» with the accessible name «Jornada N, suspendido»; and its «Tu temporada» row SHALL show «Suspendido».

#### Scenario: Own match suspended
- **WHEN** the own match of the selected round has status «3» and goals 1–0
- **THEN** the «Tu partido» card shows «Suspendido» and no «Victoria», «Empate» or «Derrota»

#### Scenario: Other match suspended
- **WHEN** another match of the selected round has status «3»
- **THEN** its card under «Resto de la jornada» shows the tag «Suspendido»

### Requirement: Season panel on desktop
On medium and larger screens, when the team has an RFFM team code, the page SHALL show a «Tu temporada» panel with the number of wins, draws and losses and the goals for and against of the played rounds, and one row per round with the rival crest and name, «Casa» or «Fuera», the date, and the score and outcome letter when played. Pressing a row SHALL select that round. The panel SHALL list every round without a scroll area of its own (the page scroll is used). On small screens the panel SHALL NOT be shown.

#### Scenario: Season summary
- **WHEN** the own team has played 7 rounds with 4 wins, 2 draws and 1 loss, scoring 12 and conceding 6
- **THEN** the panel shows 4 V, 2 E, 1 D and «12 GF · 6 GC»

#### Scenario: Select a round from the panel
- **WHEN** the coach presses the row of round 5
- **THEN** round 5 is selected in the bar and its matches are shown

#### Scenario: Season calendar fails to load
- **WHEN** the whole-season calendar request fails
- **THEN** the panel shows «No se ha podido cargar la temporada del equipo.» and the selected round is still shown
