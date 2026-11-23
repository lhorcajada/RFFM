## ADDED Requirements

### Requirement: Migration copies legacy free text literally into the structured fields

The `AddExerciseSheetFields` migration SHALL copy the legacy text of every existing exercise without splitting it: a non-blank `Descripcion` SHALL become the single line of `Secuencia`, a non-blank `Logistica` SHALL become `Espacio`, and a non-blank `ObjetivoPorRol` SHALL become the single objective line of one team with no color, an empty name, no count and no roles. A blank legacy field SHALL create no line, team or space. The legacy columns, `Dibujo` included, SHALL be kept.

#### Scenario: Legacy text is copied literally

- **WHEN** an exercise has `Descripcion` "Rondo 4x2, cambio al robar" and `Logistica` "20x20 m, 6 jugadores"
- **THEN** after the migration its `Secuencia` is `["Rondo 4x2, cambio al robar"]` and its `Espacio` is "20x20 m, 6 jugadores"

#### Scenario: Empty legacy field creates nothing

- **WHEN** an exercise has a blank `ObjetivoPorRol`
- **THEN** after the migration its `Jugadores` is an empty list

### Requirement: Migration backfill only touches untouched rows

The backfill statement SHALL update only exercises whose `Secuencia`, `Reglas`, `QueSeVe` and `Jugadores` are empty and whose `Espacio` is null, so running it again SHALL change nothing.

#### Scenario: Backfill runs twice

- **WHEN** the backfill statement runs a second time over migrated exercises
- **THEN** no exercise changes
