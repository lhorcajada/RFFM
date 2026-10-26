# new-session-redesign Specification

## Purpose
TBD - created by archiving change new-session-redesign. Update Purpose after archive.
## Requirements
### Requirement: Sectioned session form
The new/edit session page SHALL group its fields into the sections «Datos de la sesión» and «Cuándo y dónde», and SHALL show a «Resumen» section.

#### Scenario: Sections visible
- **WHEN** the page is rendered
- **THEN** the headings «Datos de la sesión», «Cuándo y dónde» and «Resumen» are present

### Requirement: Session summary
The «Resumen» SHALL show the number of blocks and the total number of exercises across all blocks.

#### Scenario: Counts
- **WHEN** a session has two blocks holding three exercises in total
- **THEN** the summary shows 2 blocks and 3 exercises

### Requirement: Numbered blocks with empty state
Each block SHALL show its order number, and a block without exercises SHALL show the message «Este bloque aún no tiene ejercicios.».

#### Scenario: Empty block
- **WHEN** a block has no exercises
- **THEN** the empty message is shown

