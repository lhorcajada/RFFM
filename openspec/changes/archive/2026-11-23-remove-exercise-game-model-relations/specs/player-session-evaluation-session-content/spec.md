## MODIFIED Requirements

### Requirement: The evaluation dialog shows the full session content
The session evaluation dialog SHALL show the session time range, location and calendar event when available, and for each block its name, the rotation between exercises when present and one card per exercise. Each exercise card SHALL show the exercise image or, when it has none, its tactical board drawing, its name, type, duration and objective, and a «Ver detalle» toggle that reveals the description, logistics, the levels as a list (no tables) and «Habilidades de la sesión»: the habilidades of the session's objectives, grouped by Subprincipio. Those habilidades SHALL come from the session's objectives through the team's game-model catalog for the active season, so every exercise of the session shows the same set; a session without objectives SHALL show no such section, with no fallback to relations stored on the exercises. The full exercise data SHALL be loaded with the existing exercise endpoint; when it cannot be loaded, the card SHALL show the basic data from the session without the toggle.

#### Scenario: Exercise with image
- **WHEN** an exercise of the session has an uploaded image
- **THEN** its card shows the image, the name, the type label and the duration

#### Scenario: Exercise with tactical board
- **WHEN** an exercise has no image but its tactical board has objects
- **THEN** its card shows the board drawing

#### Scenario: Exercise detail
- **WHEN** the coach clicks «Ver detalle» on an exercise with a description and two levels, in a session whose objectives under the Subprincipio «Circular para desordenar» have the habilidades «Pase» and «Percepción» in the catalog
- **THEN** the description, «Nivel 1» and «Nivel 2» with their values, the Subprincipio «Circular para desordenar» and the habilidades «Pase» and «Percepción» are shown

#### Scenario: Session header
- **WHEN** the session is from 18:00 to 19:30 at «Campo 2» linked to event «Entrenamiento martes»
- **THEN** the dialog shows «18:00 – 19:30 · Campo 2 · Entrenamiento martes»

#### Scenario: Exercise data unavailable
- **WHEN** the full exercise cannot be loaded
- **THEN** the card shows the name, objective and duration from the session and no «Ver detalle»

#### Scenario: Session without objectives
- **WHEN** the coach clicks «Ver detalle» on an exercise of a session with no game-model objectives
- **THEN** no «Habilidades de la sesión» section is shown

### Requirement: Each Subprincipio block shows the skills worked in the session
In the evaluation form, each Subprincipio block SHALL show «Habilidades trabajadas» with the distinct habilidades that the team's game-model catalog defines for the session's objectives under that Subprincipio, in order of appearance. An objective the catalog no longer resolves SHALL be skipped without error. Skills SHALL NOT be selectable nor saved. When there are none, nothing SHALL be shown.

#### Scenario: Skills from the session objectives
- **WHEN** the session has two objectives under «Circular para desordenar» whose habilidades in the catalog are «Pase, Percepción» and «Pase, Desmarque»
- **THEN** the «Circular para desordenar» block shows «Pase», «Percepción» and «Desmarque» once each

#### Scenario: No skills
- **WHEN** no objective of the session with habilidades belongs to a Subprincipio
- **THEN** its block shows no «Habilidades trabajadas»

#### Scenario: Objective no longer in the catalog
- **WHEN** one of the session's objectives is no longer found in the team's game model
- **THEN** it adds no habilidades and the block shows the rest without error
