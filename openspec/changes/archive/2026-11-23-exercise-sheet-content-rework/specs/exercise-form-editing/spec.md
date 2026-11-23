## MODIFIED Requirements

### Requirement: Exercise form edits the structured sheet fields with stacked cards

The exercise form SHALL edit the space and the turn duration in an "Espacio y turno" section, the exercise `descripcion` as free multi-line text in a "Qué se hace" section, and the line lists in "Reglas", "Puntos", "Rotaciones" and "Montaje" sections, all as stacked cards and never as tables. Each line list SHALL offer one field per line with its own remove button and an add button. The add buttons SHALL be disabled at 30 lines per list. The form SHALL NOT show a "Jugadores y objetivos", "Secuencia", "Qué se ve sin decir nada" or "Organización" (porteros) section, and SHALL no longer edit Logística or Objetivo por rol. Opening an existing exercise SHALL show its `descripcion` as «Qué se hace», and empty Puntos, Rotaciones and Montaje when it has none.

#### Scenario: Line list reaches its cap

- **WHEN** a line list already holds 30 lines
- **THEN** its add button is disabled

#### Scenario: Coach writes Qué se hace and adds points

- **WHEN** the coach types two lines in «Qué se hace» and adds two Puntos lines
- **THEN** the form state holds that multi-line text in `descripcion` and the two lines in `puntos`

#### Scenario: Removed sections are not shown

- **WHEN** the exercise form is rendered for a new or an existing exercise
- **THEN** it shows no "Jugadores y objetivos", "Secuencia", "Qué se ve sin decir nada" or "Organización" section

### Requirement: Form drops blank sheet entries before saving

Before it sends a create or update request, the form SHALL remove blank lines from the Reglas, Puntos, Rotaciones and Montaje lists and send a blank space as null. An empty «Qué se hace» SHALL be sent as an empty `descripcion` and SHALL save without error.

#### Scenario: Blank lines are not saved

- **WHEN** the coach saves with Puntos `["Gol = +1", "  "]` and an empty Montaje line
- **THEN** the request carries Puntos `["Gol = +1"]` and an empty Montaje list
