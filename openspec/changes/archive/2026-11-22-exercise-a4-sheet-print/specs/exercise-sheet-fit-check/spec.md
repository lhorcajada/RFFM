## ADDED Requirements

### Requirement: Fit check measures the real sheet panel

The fit check SHALL render the sheet's side panel off screen with the same markup and styles the print uses, and SHALL report that the content does not fit when the panel's content height exceeds its available height by more than 1 CSS pixel. The result SHALL include the overflow in pixels and the titles of the blocks that run past the bottom of the panel. The check SHALL measure only the panel, so it SHALL NOT wait for images to load. When the browser reports no layout, the sheet SHALL be treated as fitting. The overflow description SHALL name the overflowing blocks and the overflow rounded to half centimetres, for example "No cabe en una hoja A4: se sale «Reglas» (unos 1,5 cm de más).".

#### Scenario: Content that fits

- **WHEN** the panel content is no taller than the panel
- **THEN** the fit check reports that it fits with zero overflow

#### Scenario: Content that overflows

- **WHEN** the "Reglas" block ends below the bottom of the panel
- **THEN** the fit check reports that it does not fit and lists "Reglas" among the overflowing blocks

### Requirement: Printing warns before it prints sheets that do not fit

Before it prints one exercise or a session, the print flow SHALL run the fit check for every sheet. When at least one sheet does not fit, it SHALL show a `ConfirmDialog` titled "Hay fichas que no caben en una hoja" that lists each such exercise with its session block and its overflow reason, and offers "Editar ejercicio", "Imprimir igualmente" and "Cancelar". No print window SHALL open until the coach chooses. "Imprimir igualmente" SHALL print with the overflowing content cut; "Editar ejercicio" SHALL open the editor of the first listed exercise and not print; "Cancelar" SHALL not print. Viewing a session without printing SHALL NOT run the check.

#### Scenario: Session with an overflowing sheet

- **WHEN** the coach prints a session where one exercise does not fit
- **THEN** the dialog lists that exercise with its block and no print window opens

#### Scenario: Coach prints anyway

- **WHEN** the coach selects "Imprimir igualmente" in the dialog
- **THEN** the print window opens and prints every sheet

#### Scenario: Coach edits the exercise

- **WHEN** the coach selects "Editar ejercicio"
- **THEN** the editor of the first listed exercise opens and nothing is printed

### Requirement: Confirm dialog supports an optional secondary action

The shared `ConfirmDialog` SHALL accept an optional `secondaryText` and `onSecondary`, and SHALL show that action between the cancel and confirm buttons only when both are given.

#### Scenario: Secondary action shown

- **WHEN** `ConfirmDialog` receives `secondaryText` "Editar ejercicio" and an `onSecondary` handler
- **THEN** it shows a third button "Editar ejercicio" that calls the handler

#### Scenario: Secondary action absent

- **WHEN** `ConfirmDialog` receives no `secondaryText`
- **THEN** it shows only the cancel and confirm buttons
