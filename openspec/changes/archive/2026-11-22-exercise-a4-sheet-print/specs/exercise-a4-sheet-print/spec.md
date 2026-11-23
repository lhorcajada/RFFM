## ADDED Requirements

### Requirement: Exercise prints as one landscape A4 sheet in the reference layout

Printing one exercise SHALL produce a document with `@page { size: A4 landscape }` and exactly one sheet. The sheet SHALL show a header with the exercise name, a subtitle and pills for type, subtype and duration; the drawing on the left; a fixed side panel on the right; and a footer. The side panel SHALL print, in order, the blocks "Jugadores", "Objetivos", "Secuencia" (numbered), "Reglas", "Qué se ve sin decir nada" and "Niveles", followed by one compact "Modelo de juego" line when the exercise has game-model relations. The panel SHALL be clipped to its fixed height, so printing content that does not fit cuts it. Printing SHALL use generated HTML and `window.print()`, without jsPDF or html2canvas. Team colors and the marked level row SHALL print with `print-color-adjust: exact`. The legacy Dibujo text SHALL NOT be printed.

#### Scenario: Single exercise prints on one landscape page

- **WHEN** the coach prints one exercise
- **THEN** the print document declares A4 landscape and contains exactly one sheet with the exercise name in its header

#### Scenario: Objectives come from the teams

- **WHEN** an exercise has a team named "Atacantes" with two objective lines
- **THEN** the "Objetivos" block shows the heading "Atacantes" with those two lines

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

Printing a session SHALL produce one landscape A4 sheet per exercise occurrence, with blocks sorted by order and exercises by position, a page break after every sheet except the last, and no cover or summary page. A duplicated exercise SHALL get its own page each time it appears. Each sheet footer SHALL read "Sesión: {session name} · Bloque: {block name}". An exercise whose full record cannot be loaded SHALL still get a sheet with the name the session kept. A session with no exercises SHALL print "Esta sesión no tiene ejercicios.". The drawings SHALL no longer be resized or split across pages.

#### Scenario: Duplicated exercise in a session

- **WHEN** a session lists the same exercise in two blocks
- **THEN** the print document has two sheets for it, each with its own block in the footer

#### Scenario: Session footer

- **WHEN** a session "Martes" prints an exercise of block "Calentamiento"
- **THEN** that sheet's footer reads "Sesión: Martes · Bloque: Calentamiento"
