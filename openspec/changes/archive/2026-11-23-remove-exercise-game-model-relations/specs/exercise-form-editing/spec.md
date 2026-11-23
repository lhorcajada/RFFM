## MODIFIED Requirements

### Requirement: Form blocks saving while the sheet does not fit one page

The form SHALL run the sheet fit check whenever a sheet field or the levels change, and when it loads an existing exercise. The form's sheet SHALL carry no game-model content. When the content does not fit, the form SHALL show a warning that names the overflowing blocks and the approximate overflow, and saving SHALL fail with that reason until the coach shortens the content.

#### Scenario: Overflowing content blocks the save

- **WHEN** the fit check reports that the "Reglas" block runs past the page
- **THEN** the form shows "No cabe en una hoja A4: se sale «Reglas» (…)" and the save does not send a request

#### Scenario: Opening a migrated exercise that does not fit

- **WHEN** the coach opens an existing exercise whose content does not fit one sheet
- **THEN** the form shows the same overflow warning with its reason
