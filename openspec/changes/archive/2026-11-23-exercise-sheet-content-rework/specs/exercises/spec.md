## MODIFIED Requirements

### Requirement: Exercise follows the reduced content template

An `Exercise` (`TaskTrainingBase`) SHALL carry: `Name` (Título, required), `Tipo` (`Analitico | Situacional | Global`, required), `Objetivo` (required), `ObjetivoPorRol` (optional), `Logistica` (optional legacy free text), `Dibujo` (optional legacy free text, no longer printed), `Descripcion` (optional free multi-line text, shown and printed as «Qué se hace»), and `Niveles` (see "Exercise levels use free-named palanca columns" below). `DurationMinutes` (optional integer) is a structured addition beyond the source template, kept so a session's total duration can be computed. The exercise SHALL also carry the structured sheet fields `Espacio`, `TurnoMinutos`, `NivelDibujo`, `Reglas`, `Puntos`, `Rotaciones` and `Montaje` (see the `exercise-structured-fields` capability). The exercise contract SHALL NOT carry `Porteros`, `Secuencia`, `QueSeVe` or `Jugadores`; their stored values stay in the database unread.

#### Scenario: Saving an exercise with only the required fields

- **WHEN** a Coach saves an exercise with `Name`, `Tipo`, `Objetivo` and a valid `Niveles` table, and leaves `Logistica`, `Descripcion`, `ObjetivoPorRol`, `Dibujo`, `DurationMinutes` and every structured sheet field empty
- **THEN** the exercise is created successfully with those optional fields null or empty
