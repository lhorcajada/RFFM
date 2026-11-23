# exercise-a4-sheet-print Specification

## Purpose
TBD - created by archiving change exercise-a4-sheet-print. Update Purpose after archive.
## Requirements
### Requirement: Exercise prints as one landscape A4 sheet in the reference layout

Printing one exercise SHALL produce a document with `@page { size: A4 landscape }` and exactly one sheet. The sheet SHALL show a header with the exercise name, a subtitle and pills for type, subtype and duration; the drawing on the left; a fixed side panel on the right; and a footer. The side panel SHALL print, in order, the blocks "Qué se hace", "Reglas", "Puntos", "Rotaciones", "Montaje" and "Niveles", and SHALL NOT print any game-model content. The "Qué se hace" block SHALL print the exercise `descripcion` as one paragraph per non-blank line, so its line breaks are kept. "Reglas", "Puntos", "Rotaciones" and "Montaje" SHALL print as bulleted lists. The side panel SHALL NOT print a "Jugadores" block, a per-team "Objetivos" block, a "Secuencia" block or a "Qué se ve sin decir nada" block. The "Montaje" block and the material legend under the drawing SHALL print independently, and neither SHALL be derived from the other. A sheet printed for a single exercise SHALL carry no game-model line, because the exercise carries no game model. The panel SHALL be clipped to its fixed height, so printing content that does not fit cuts it. Printing SHALL use generated HTML and `window.print()`, without jsPDF or html2canvas. The marked level row SHALL print with `print-color-adjust: exact`. The legacy Dibujo text SHALL NOT be printed.

#### Scenario: Single exercise prints on one landscape page

- **WHEN** the coach prints one exercise
- **THEN** the print document declares A4 landscape and contains exactly one sheet with the exercise name in its header

#### Scenario: Single exercise sheet has no game-model line

- **WHEN** the coach prints one exercise
- **THEN** the sheet shows no "Modelo de juego" line, neither in the header nor in the side panel

#### Scenario: Side panel blocks follow the reference order

- **WHEN** an exercise has Qué se hace text, rules, points, rotations, setup lines and level rows
- **THEN** the side panel prints "Qué se hace", "Reglas", "Puntos", "Rotaciones", "Montaje" and "Niveles" in that order

#### Scenario: Qué se hace keeps its line breaks

- **WHEN** an exercise's `descripcion` has two non-blank lines separated by a line break
- **THEN** the "Qué se hace" block prints two separate paragraphs

#### Scenario: Removed blocks are not printed

- **WHEN** the coach prints any exercise
- **THEN** the side panel has no "Jugadores", "Objetivos", "Secuencia" or "Qué se ve sin decir nada" block

### Requirement: Empty sheet blocks and subtitle segments are omitted

A side-panel block with no content SHALL NOT print, nor its title. The subtitle SHALL join "Espacio: {space}", "Turno: {n} min" and "Nivel {n}" with " · ", and SHALL omit any missing segment together with its separator. The level segment SHALL appear only when the drawing level is one of the printable level rows. When the exercise has no level row with content, the "Niveles" block SHALL NOT print. The marked level row SHALL be highlighted and labelled "Dibujo".

#### Scenario: Missing turn duration

- **WHEN** an exercise has a space "20x30 m", no turn duration and drawing level 2
- **THEN** the subtitle reads "Espacio: 20x30 m · Nivel 2"

#### Scenario: Empty rules block

- **WHEN** an exercise has no rule lines
- **THEN** the sheet has no "Reglas" block and no "Reglas" title

### Requirement: Drawing area crops the board to the pitch it uses

The drawing area SHALL show the uploaded image when the exercise has one. Otherwise, when the board has placed objects, it SHALL render the board through the existing `detectBoardViewport` helper: only the right or only the left half pitch when every placed object lies in that half, and the full pitch otherwise. The board SHALL sit in a box with the aspect ratio of the pitch shown (52.5 by 68 for a half pitch, 105 by 68 for the full pitch). When the exercise has no image and no board objects, the drawing area SHALL show "Sin dibujo" and the sheet SHALL still take one page.

#### Scenario: Half-pitch exercise is cropped

- **WHEN** every placed object of the board lies in the right half
- **THEN** the sheet renders only the right half pitch in a 52.5 by 68 box

#### Scenario: Exercise without a drawing

- **WHEN** an exercise has no uploaded image and no board objects
- **THEN** the drawing area shows "Sin dibujo"

### Requirement: Material legend prints under the drawing when it fits

When the board has placed material, the sheet SHALL print a "Material:" legend under the drawing with each material label and its count, in the order the board editor offers the material. The legend SHALL print only when its measured height fits the free space under the drawing; with no material or no space, the legend SHALL be omitted.

#### Scenario: Board with material

- **WHEN** a half-pitch board has three cones and two balls placed and the legend fits under the drawing
- **THEN** the sheet prints a "Material:" legend with each label and its count

### Requirement: Session prints one sheet per exercise occurrence

Printing a session SHALL produce one landscape A4 sheet per exercise occurrence, with blocks sorted by order and exercises by position, a page break after every sheet except the last, and no cover or summary page. A duplicated exercise SHALL get its own page each time it appears. Each sheet footer SHALL read "Sesión: {session name} · Bloque: {block name}". When the session has game-model objectives, each sheet header SHALL carry one compact line "Modelo de juego: {objectives}", listing each objective that the team's game-model catalog for the active season resolves as "{numero} {rol}", in the session's order, joined by " · ". An objective the catalog no longer resolves SHALL be skipped without error, and a session without objectives SHALL print no such line. An exercise whose full record cannot be loaded SHALL still get a sheet with the name the session kept. A session with no exercises SHALL print "Esta sesión no tiene ejercicios.". The drawings SHALL no longer be resized or split across pages.

#### Scenario: Duplicated exercise in a session

- **WHEN** a session lists the same exercise in two blocks
- **THEN** the print document has two sheets for it, each with its own block in the footer

#### Scenario: Session footer

- **WHEN** a session "Martes" prints an exercise of block "Calentamiento"
- **THEN** that sheet's footer reads "Sesión: Martes · Bloque: Calentamiento"

#### Scenario: Session game-model line in every sheet header

- **WHEN** a session whose objectives the catalog resolves as "1.1.1 Perfilarse" and "1.2.1 Fijar" prints two exercises
- **THEN** both sheet headers carry the line "Modelo de juego: 1.1.1 Perfilarse · 1.2.1 Fijar"

#### Scenario: Session without objectives

- **WHEN** a session with no game-model objectives prints
- **THEN** no sheet carries a "Modelo de juego" line

#### Scenario: Objective no longer in the catalog

- **WHEN** one of the session's objectives is no longer found in the team's game model
- **THEN** that objective is left out of the line and the rest of the sheet prints without error

