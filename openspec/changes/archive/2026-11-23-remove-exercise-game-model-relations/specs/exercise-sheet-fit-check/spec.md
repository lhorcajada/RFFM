## MODIFIED Requirements

### Requirement: Fit check measures the real sheet panel

The fit check SHALL render the sheet's side panel off screen with the same markup and styles the print uses, and SHALL report that the content does not fit when the panel's content height exceeds its available height by more than 1 CSS pixel. For a sheet printed as part of a session with a game-model line, the fit check SHALL also render the sheet header with that line, with the same markup and styles the print uses, and SHALL report that the content does not fit when the header content exceeds its height by more than 1 CSS pixel, naming "Modelo de juego" among the overflowing blocks. The result SHALL include the overflow in pixels and the titles of the blocks that run past the bottom of the panel or the header. The check SHALL measure only the panel and that header, so it SHALL NOT wait for images to load. When the browser reports no layout, the sheet SHALL be treated as fitting. The overflow description SHALL name the overflowing blocks and the overflow rounded to half centimetres, for example "No cabe en una hoja A4: se sale «Reglas» (unos 1,5 cm de más).".

#### Scenario: Content that fits

- **WHEN** the panel content is no taller than the panel
- **THEN** the fit check reports that it fits with zero overflow

#### Scenario: Content that overflows

- **WHEN** the "Reglas" block ends below the bottom of the panel
- **THEN** the fit check reports that it does not fit and lists "Reglas" among the overflowing blocks

#### Scenario: Session game-model line that does not fit the header

- **WHEN** a session sheet's header with its game-model line is taller than the header
- **THEN** the fit check reports that the sheet does not fit and lists "Modelo de juego" among the overflowing blocks

#### Scenario: Sheet without a game-model line

- **WHEN** the fit check runs for a single exercise or for a session without objectives
- **THEN** only the side panel is measured
