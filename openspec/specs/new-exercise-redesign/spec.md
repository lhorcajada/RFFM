# new-exercise-redesign Specification

## Purpose
TBD - created by archiving change new-exercise-redesign. Update Purpose after archive.
## Requirements
### Requirement: Title in the header
The new/edit exercise page SHALL show the exercise title as an editable field labelled «Título» in the top bar, next to the Cancelar and Guardar actions.

#### Scenario: Edit title
- **WHEN** the coach types a name in the header title field
- **THEN** the exercise form's name is updated

### Requirement: Board tool rail
The page SHALL present the board tools «Chapas», «Espacios», «Material», «Líneas» and «Texto» as buttons of at least 44 px, each exposing `aria-pressed`, placed beside the pitch instead of in a bottom bar.

#### Scenario: Toggle a tool
- **WHEN** the coach presses «Chapas»
- **THEN** the button is pressed and the chapas strip is shown

### Requirement: Sectioned data panel
The data panel SHALL group fields into sections (Clasificación, Objetivos, Modelo de juego, Organización, Imagen / vídeo) in a single column. «Tipo» SHALL be a group of three buttons (Analítico, Situacional, Global) of at least 44 px with the selected one `aria-pressed`.

#### Scenario: Choose type
- **WHEN** the coach presses «Global»
- **THEN** the form's tipo becomes `Global`

### Requirement: Niveles and Dibujo removed from the UI
The panel SHALL NOT render the Niveles editor nor the «Dibujo» field. The existing niveles and dibujo values SHALL be preserved when editing an exercise, and a loaded exercise with fewer than two niveles SHALL use the default niveles.

#### Scenario: Not shown
- **WHEN** the panel is rendered
- **THEN** there is no «Niveles» section and no «Dibujo» field

#### Scenario: Preserved on edit
- **WHEN** an exercise with three niveles is loaded and saved without touching them
- **THEN** the update request carries the same three niveles

