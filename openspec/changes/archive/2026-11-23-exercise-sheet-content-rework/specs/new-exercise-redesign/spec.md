## MODIFIED Requirements

### Requirement: Sectioned data panel

The data panel SHALL group fields into sections in a single column, in this order: Clasificación, Espacio y turno, Objetivo, Qué se hace, Reglas, Puntos, Rotaciones, Montaje, Niveles, Imagen / vídeo. The panel SHALL NOT render a «Jugadores y objetivos», «Secuencia», «Qué se ve sin decir nada» or «Organización» section. The panel SHALL NOT render a «Modelo de juego» section, neither when creating nor when editing an exercise. «Tipo» SHALL be a group of three buttons (Analítico, Situacional, Global) of at least 44 px with the selected one `aria-pressed`.

#### Scenario: Choose type

- **WHEN** the coach presses «Global»
- **THEN** the form's tipo becomes `Global`

#### Scenario: Structured sheet sections are shown

- **WHEN** the panel is rendered
- **THEN** it shows the sections «Espacio y turno», «Qué se hace», «Reglas», «Puntos», «Rotaciones», «Montaje» and «Niveles», and none of «Jugadores y objetivos», «Secuencia», «Qué se ve sin decir nada» or «Organización»

#### Scenario: No game-model section

- **WHEN** the panel is rendered for a new or an existing exercise
- **THEN** it shows no «Modelo de juego» section
