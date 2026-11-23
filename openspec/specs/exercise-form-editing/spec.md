# exercise-form-editing Specification

## Purpose
TBD - created by archiving change exercise-a4-sheet-print. Update Purpose after archive.
## Requirements
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

### Requirement: Levels editor marks the drawing level

The levels editor SHALL show a "Dibujo" toggle on each level row that marks the row whose square size and width the drawing shows; selecting the marked row again SHALL clear the marker. When the coach deletes the marked row, the form SHALL clear the marker and show a warning that asks the coach to mark another level before saving. When the coach deletes a row above the marked row, the marker SHALL follow its row to the new number.

#### Scenario: Deleting the marked row clears the marker and warns

- **WHEN** level 2 is marked as the drawing level and the coach deletes row 2
- **THEN** the drawing level becomes empty and the form shows "Has borrado el nivel que mostraba el dibujo. Marca otro nivel antes de guardar."

#### Scenario: Deleting a row above keeps the marked row

- **WHEN** level 3 is marked and the coach deletes row 1
- **THEN** the drawing level becomes 2

### Requirement: Form drops blank sheet entries before saving

Before it sends a create or update request, the form SHALL remove blank lines from the Reglas, Puntos, Rotaciones and Montaje lists and send a blank space as null. An empty «Qué se hace» SHALL be sent as an empty `descripcion` and SHALL save without error.

#### Scenario: Blank lines are not saved

- **WHEN** the coach saves with Puntos `["Gol = +1", "  "]` and an empty Montaje line
- **THEN** the request carries Puntos `["Gol = +1"]` and an empty Montaje list

### Requirement: Form blocks saving while the sheet does not fit one page

The form SHALL run the sheet fit check whenever a sheet field or the levels change, and when it loads an existing exercise. The form's sheet SHALL carry no game-model content. When the content does not fit, the form SHALL show a warning that names the overflowing blocks and the approximate overflow, and saving SHALL fail with that reason until the coach shortens the content.

#### Scenario: Overflowing content blocks the save

- **WHEN** the fit check reports that the "Reglas" block runs past the page
- **THEN** the form shows "No cabe en una hoja A4: se sale «Reglas» (…)" and the save does not send a request

#### Scenario: Opening a migrated exercise that does not fit

- **WHEN** the coach opens an existing exercise whose content does not fit one sheet
- **THEN** the form shows the same overflow warning with its reason

