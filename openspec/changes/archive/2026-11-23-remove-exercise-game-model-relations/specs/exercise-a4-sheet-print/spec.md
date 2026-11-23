## MODIFIED Requirements

### Requirement: Exercise prints as one landscape A4 sheet in the reference layout

Printing one exercise SHALL produce a document with `@page { size: A4 landscape }` and exactly one sheet. The sheet SHALL show a header with the exercise name, a subtitle and pills for type, subtype and duration; the drawing on the left; a fixed side panel on the right; and a footer. The side panel SHALL print, in order, the blocks "Jugadores", "Objetivos", "Secuencia" (numbered), "Reglas", "Qué se ve sin decir nada" and "Niveles", and SHALL NOT print any game-model content. A sheet printed for a single exercise SHALL carry no game-model line, because the exercise carries no game model. The panel SHALL be clipped to its fixed height, so printing content that does not fit cuts it. Printing SHALL use generated HTML and `window.print()`, without jsPDF or html2canvas. Team colors and the marked level row SHALL print with `print-color-adjust: exact`. The legacy Dibujo text SHALL NOT be printed.

#### Scenario: Single exercise prints on one landscape page

- **WHEN** the coach prints one exercise
- **THEN** the print document declares A4 landscape and contains exactly one sheet with the exercise name in its header

#### Scenario: Objectives come from the teams

- **WHEN** an exercise has a team named "Atacantes" with two objective lines
- **THEN** the "Objetivos" block shows the heading "Atacantes" with those two lines

#### Scenario: Single exercise sheet has no game-model line

- **WHEN** the coach prints one exercise
- **THEN** the sheet shows no "Modelo de juego" line, neither in the header nor in the side panel

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
