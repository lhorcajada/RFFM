# coach-trainings-redesign Specification

## Purpose
TBD - created by archiving change coach-trainings-redesign. Update Purpose after archive.
## Requirements
### Requirement: Segmented section tabs
The Trainings page SHALL present «Planificación», «Ejercicios» and «Sesiones» as tabs styled as a segmented control, each at least 44 px tall, wrapping onto several rows instead of scrolling horizontally. The selected tab SHALL be exposed with `aria-selected`.

#### Scenario: Switch section
- **WHEN** the coach selects the «Sesiones» tab
- **THEN** that tab is selected and the sessions content is shown

### Requirement: Season plan summary
When a season plan is loaded, the Planificación tab SHALL show a summary with the number of macrociclos, the total number of planned sessions and the number of microciclos without sessions. Without a plan it SHALL show the existing empty state and no summary.

#### Scenario: Summary counts
- **WHEN** a plan with one macrociclo, two microciclos and one session is shown
- **THEN** the summary shows 1 macrociclo, 1 session and 1 microciclo without sessions

#### Scenario: No plan
- **WHEN** no plan exists
- **THEN** the empty state is shown and the summary is not rendered

### Requirement: Microciclos as responsive cards
Each microciclo SHALL be a card showing its week label, dates, a status chip («Sin sesiones» or «N sesiones»), the weekly objective chips and its sessions with a date block. Microciclos of a mesociclo SHALL flow in a responsive grid without tables or horizontal scroll. The microciclo that contains today's date SHALL show a «Semana actual» badge.

#### Scenario: Current week
- **WHEN** today falls between a microciclo's start and end dates
- **THEN** that card shows «Semana actual»

#### Scenario: Create session
- **WHEN** the coach presses «Crear sesión» on a card with an `apiId`
- **THEN** `onCreateSession` is called with that id

### Requirement: Exercises toolbar with count
The Ejercicios tab SHALL keep the Tipo and Subtipo selects and show the number of listed exercises («1 ejercicio» / «N ejercicios»). Card actions SHALL have a touch area of at least 44 px.

#### Scenario: Exercise count
- **WHEN** three exercises are listed
- **THEN** «3 ejercicios» is shown

### Requirement: Session cards and selection bar
Each session SHALL be a card with a date block (day and month), name, time, location, exercise-count chip, linked event and view/print/edit/delete actions of at least 44 px. The selection bar SHALL show «Seleccionar todo» when nothing is selected and «N sesiones seleccionadas» (singular «1 sesión seleccionada») otherwise.

#### Scenario: Selection label
- **WHEN** two sessions are selected
- **THEN** the bar shows «2 sesiones seleccionadas»

#### Scenario: Select all
- **WHEN** the coach toggles «Seleccionar todo»
- **THEN** all listed sessions are selected

