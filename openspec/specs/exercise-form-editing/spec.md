# exercise-form-editing Specification

## Purpose
TBD - created by archiving change exercise-a4-sheet-print. Update Purpose after archive.
## Requirements
### Requirement: Exercise form edits the structured sheet fields with stacked cards

The exercise form SHALL edit the space and the turn duration in an "Espacio y turno" section, the teams in a "Jugadores y objetivos" section, and the line lists in "Secuencia", "Reglas" and "Qué se ve sin decir nada" sections, all as stacked cards and never as tables. Each team card SHALL edit the palette color (Azul, Amarillo, Gris, or none), the name, the number of players, the roles and the objective lines. Each line list SHALL offer one field per line with its own remove button and an add button. The sequence lines SHALL be numbered. The add buttons SHALL be disabled at 30 lines per list and at 6 teams. The form SHALL no longer edit Logística, Descripción or Objetivo por rol.

#### Scenario: Coach adds a team with objectives

- **WHEN** the coach adds a team, selects Azul, types a name, a player count and two objective lines
- **THEN** the form state holds one team with color `blue`, that name, that count and the two objective lines

#### Scenario: Line list reaches its cap

- **WHEN** a line list already holds 30 lines
- **THEN** its add button is disabled

### Requirement: Levels editor marks the drawing level

The levels editor SHALL show a "Dibujo" toggle on each level row that marks the row whose square size and width the drawing shows; selecting the marked row again SHALL clear the marker. When the coach deletes the marked row, the form SHALL clear the marker and show a warning that asks the coach to mark another level before saving. When the coach deletes a row above the marked row, the marker SHALL follow its row to the new number.

#### Scenario: Deleting the marked row clears the marker and warns

- **WHEN** level 2 is marked as the drawing level and the coach deletes row 2
- **THEN** the drawing level becomes empty and the form shows "Has borrado el nivel que mostraba el dibujo. Marca otro nivel antes de guardar."

#### Scenario: Deleting a row above keeps the marked row

- **WHEN** level 3 is marked and the coach deletes row 1
- **THEN** the drawing level becomes 2

### Requirement: Form drops blank sheet entries before saving

Before it sends a create or update request, the form SHALL remove blank lines from every list, remove teams with no color, name, count, roles or objectives, trim team names, and send a blank space as null.

#### Scenario: Blank lines are not saved

- **WHEN** the coach saves with a sequence of `["Paso 1", "  "]` and one empty team
- **THEN** the request carries the sequence `["Paso 1"]` and no teams

### Requirement: Form blocks saving while the sheet does not fit one page

The form SHALL run the sheet fit check whenever a sheet field, the levels or the game-model relations change, and when it loads an existing exercise. When the content does not fit, the form SHALL show a warning that names the overflowing blocks and the approximate overflow, and saving SHALL fail with that reason until the coach shortens the content.

#### Scenario: Overflowing content blocks the save

- **WHEN** the fit check reports that the "Reglas" block runs past the page
- **THEN** the form shows "No cabe en una hoja A4: se sale «Reglas» (…)" and the save does not send a request

#### Scenario: Opening a migrated exercise that does not fit

- **WHEN** the coach opens an existing exercise whose content does not fit one sheet
- **THEN** the form shows the same overflow warning with its reason

