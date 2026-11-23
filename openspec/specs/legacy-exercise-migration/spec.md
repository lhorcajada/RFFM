# legacy-exercise-migration Specification

## Purpose
TBD - created by archiving change exercise-a4-sheet-print. Update Purpose after archive.
## Requirements
### Requirement: Migration copies legacy free text literally into the structured fields

The earlier `AddExerciseSheetFields` migration SHALL keep its recorded behavior: it copies the legacy text of every existing exercise without splitting it, so a non-blank `Descripcion` becomes the single line of the `Secuencia` column, a non-blank `Logistica` becomes `Espacio`, and a non-blank `ObjetivoPorRol` becomes the single objective line of one entry in the `Jugadores` column. A blank legacy field creates no line, entry or space. The `Secuencia` and `Jugadores` columns SHALL now be retained, unread columns: no exercise endpoint, form or sheet SHALL read them, and an exercise SHALL have no teams, team objectives or sequence in its contract. The legacy `Descripcion` text SHALL stay in place and SHALL be shown as the «Qué se hace» text of the exercise. The legacy columns, `Dibujo` included, SHALL be kept.

#### Scenario: Legacy text is copied literally

- **WHEN** an exercise has `Descripcion` "Rondo 4x2, cambio al robar" and `Logistica` "20x20 m, 6 jugadores"
- **THEN** after the migration its `Espacio` is "20x20 m, 6 jugadores" and its `Descripcion` is still "Rondo 4x2, cambio al robar", shown as «Qué se hace»

#### Scenario: Empty legacy field creates nothing

- **WHEN** an exercise has a blank `ObjetivoPorRol`
- **THEN** after the migration its retained `Jugadores` column holds an empty list

### Requirement: Migration backfill only touches untouched rows

The backfill statement of the earlier `AddExerciseSheetFields` migration SHALL update only exercises whose `Secuencia`, `Reglas`, `QueSeVe` and `Jugadores` columns are empty and whose `Espacio` is null, so running it again SHALL change nothing. The later `AddExerciseSheetSections` migration SHALL run no backfill: it SHALL only add the `Puntos`, `Rotaciones` and `Montaje` columns, which start as empty lists for every existing exercise.

#### Scenario: Backfill runs twice

- **WHEN** the backfill statement runs a second time over migrated exercises
- **THEN** no exercise changes

