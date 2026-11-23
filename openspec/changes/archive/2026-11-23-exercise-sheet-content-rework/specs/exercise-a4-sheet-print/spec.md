## MODIFIED Requirements

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
