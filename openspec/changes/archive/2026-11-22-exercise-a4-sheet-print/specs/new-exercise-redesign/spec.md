## MODIFIED Requirements

### Requirement: Sectioned data panel

The data panel SHALL group fields into sections in a single column, in this order: Clasificación, Espacio y turno, Objetivo, Jugadores y objetivos, Secuencia, Reglas, Qué se ve sin decir nada, Niveles, Modelo de juego, Organización, Imagen / vídeo. «Tipo» SHALL be a group of three buttons (Analítico, Situacional, Global) of at least 44 px with the selected one `aria-pressed`.

#### Scenario: Choose type

- **WHEN** the coach presses «Global»
- **THEN** the form's tipo becomes `Global`

#### Scenario: Structured sheet sections are shown

- **WHEN** the panel is rendered
- **THEN** it shows the sections «Espacio y turno», «Jugadores y objetivos», «Secuencia», «Reglas», «Qué se ve sin decir nada» and «Niveles»

### Requirement: Niveles and Dibujo removed from the UI

The panel SHALL render the Niveles editor, with a «Dibujo» toggle per row that marks the drawing level, and SHALL NOT render the legacy «Dibujo» free-text field. The existing dibujo value SHALL be preserved when editing an exercise, and a loaded exercise with fewer than two niveles SHALL use the default niveles and no drawing level.

#### Scenario: Not shown

- **WHEN** the panel is rendered
- **THEN** there is no legacy «Dibujo» free-text field, and the «Niveles» section shows the levels editor

#### Scenario: Preserved on edit

- **WHEN** an exercise with three niveles is loaded and saved without touching them
- **THEN** the update request carries the same three niveles
