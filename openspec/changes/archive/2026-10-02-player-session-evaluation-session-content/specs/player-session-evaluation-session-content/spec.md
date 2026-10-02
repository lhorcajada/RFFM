## ADDED Requirements

### Requirement: The evaluation dialog shows the full session content
The session evaluation dialog SHALL show the session time range, location and calendar event when available, and for each block its name, the rotation between exercises when present and one card per exercise. Each exercise card SHALL show the exercise image or, when it has none, its tactical board drawing, its name, type, duration and objective, and a «Ver detalle» toggle that reveals the description, logistics, the levels as a list (no tables) and the relation with the game model (Subprincipios, Sub-subprincipios and indispensable skills). The full exercise data SHALL be loaded with the existing exercise endpoint; when it cannot be loaded, the card SHALL show the basic data from the session without the toggle.

#### Scenario: Exercise with image
- **WHEN** an exercise of the session has an uploaded image
- **THEN** its card shows the image, the name, the type label and the duration

#### Scenario: Exercise with tactical board
- **WHEN** an exercise has no image but its tactical board has objects
- **THEN** its card shows the board drawing

#### Scenario: Exercise detail
- **WHEN** the coach clicks «Ver detalle» on an exercise with a description, two levels and a model relation with indispensable skills «Pase» and «Percepción»
- **THEN** the description, «Nivel 1» and «Nivel 2» with their values, the related Subprincipio and the skills are shown

#### Scenario: Session header
- **WHEN** the session is from 18:00 to 19:30 at «Campo 2» linked to event «Entrenamiento martes»
- **THEN** the dialog shows «18:00 – 19:30 · Campo 2 · Entrenamiento martes»

#### Scenario: Exercise data unavailable
- **WHEN** the full exercise cannot be loaded
- **THEN** the card shows the name, objective and duration from the session and no «Ver detalle»

### Requirement: Each Subprincipio block shows the skills worked in the session
In the evaluation form, each Subprincipio block SHALL show «Habilidades trabajadas» with the distinct indispensable skills of the session exercises whose model relation targets that Subprincipio. Skills SHALL NOT be selectable nor saved. When there are none, nothing SHALL be shown.

#### Scenario: Skills from the exercises
- **WHEN** two exercises of the session relate to «Circular para desordenar» with skills «Pase, Percepción» and «Pase, Desmarque»
- **THEN** the «Circular para desordenar» block shows «Pase», «Percepción» and «Desmarque» once each

#### Scenario: No skills
- **WHEN** no exercise relates to a Subprincipio
- **THEN** its block shows no «Habilidades trabajadas»
