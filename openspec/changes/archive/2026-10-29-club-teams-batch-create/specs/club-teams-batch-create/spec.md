## ADDED Requirements

### Requirement: The add-team form offers single and batch modes
The add-team page SHALL offer a "Un equipo / Varios equipos" selector. The "Un equipo" mode SHALL keep the current behavior (name, category, optional league, optional photo).

#### Scenario: Single mode unchanged
- **WHEN** the user stays in "Un equipo", fills name and category and saves
- **THEN** one team is created with the given name, category, league and photo

### Requirement: Batch mode selects team letters for a category
In "Varios equipos" mode the user SHALL choose a category, optionally a league, and select letters A–Z, with shortcuts A–D, A–H, A–Z and Limpiar. Letters whose team name `{Categoría} {Letra}` already exists in the club SHALL be shown disabled with an "existe" label and SHALL NOT be selectable or included by the shortcuts. Changing the category SHALL clear the selection.

#### Scenario: Existing letters are blocked
- **WHEN** category "Cadete" already has "Cadete A" and "Cadete B"
- **THEN** letters A and B are disabled and the A–D shortcut selects only C and D

#### Scenario: Category change resets selection
- **WHEN** letters are selected and the user changes the category
- **THEN** no letter remains selected

### Requirement: Batch mode shows a summary before creating
The page SHALL show how many teams "se crearán" and how many "ya existen", the list of names to create, and a primary button "Crear N equipos" that is disabled when N is 0.

#### Scenario: Summary reflects selection
- **WHEN** letters C and D are selected in "Cadete"
- **THEN** the summary shows 2 teams to create, lists "Cadete C" and "Cadete D" and the button reads "Crear 2 equipos"

#### Scenario: Nothing selected
- **WHEN** no letter is selected
- **THEN** the button is disabled and a hint asks to select at least one letter

### Requirement: The backend creates the batch skipping existing names
`POST api/catalog/teams/batch` SHALL create one team per requested letter named `{Categoría} {Letra}` for the given club, season, category and optional league, without photo. Names that already exist for the club and season SHALL be skipped without error, and the response SHALL list created and skipped names. The request SHALL be rejected with ProblemDetails when no letters are sent, a letter is not A–Z, letters repeat, or club, season or category are missing.

#### Scenario: Existing names are skipped
- **WHEN** letters A, B, C are requested for "Cadete" and "Cadete A" already exists
- **THEN** "Cadete B" and "Cadete C" are created and "Cadete A" is reported as skipped

#### Scenario: Invalid letters
- **WHEN** the request contains an empty list or a letter outside A–Z
- **THEN** the API responds 400 with ProblemDetails and creates nothing

### Requirement: Batch teams use a generic crest as photo
Teams without `urlPhoto` SHALL display a generic team crest wherever the team photo is shown. Batch creation SHALL NOT upload any photo, and the form SHALL state that the photo can be changed later from each team.

#### Scenario: Team without photo
- **WHEN** a team created in batch is listed
- **THEN** its card shows the generic crest

### Requirement: Batch result is notified and the user returns to the list
After a batch request the page SHALL notify via snackbar how many teams were created and how many were skipped, and navigate to the club teams list (or settings if it came from there). On failure it SHALL show an error snackbar and keep the form state.

#### Scenario: Success
- **WHEN** the API reports 2 created and 0 skipped
- **THEN** a success snackbar is dispatched and the user returns to the teams list
