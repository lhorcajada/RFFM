## ADDED Requirements

### Requirement: Club teams are shown as compact cards grouped by category
The club teams page SHALL list the teams of the club grouped by category (alphabetical), each group with its category title, and each team as a card showing the team photo (or a default icon), its name and "Liga · Categoría" (using "Sin liga" / "Sin categoría" when missing). The card SHALL link to the team dashboard keeping the `seasonId`. Cards SHALL adapt to the available width, using a single column on mobile, and SHALL NOT use tables.

#### Scenario: Teams grouped by category
- **WHEN** the club has teams in categories "Cadete" and "Juvenil"
- **THEN** two groups are shown in alphabetical order, each with its teams sorted by name

#### Scenario: Card content
- **WHEN** a team has league L and category C
- **THEN** its card shows the name and "L · C"

### Requirement: The page shows filters and the number of visible teams
The page SHALL offer Categoría and Liga filters and SHALL show the number of teams matching the filters. When the filters leave no teams it SHALL show an empty message; while loading a loading indicator; on failure the error.

#### Scenario: Filter by category
- **WHEN** the user selects a category
- **THEN** only the teams of that category are shown and the counter reflects them

### Requirement: Team cards offer copy-code, edit and delete
Each card SHALL show the team join code (when it has one) with a "Copiar código de equipo" button that copies it and notifies the user, an "Editar equipo" button that navigates to the edit page and an "Eliminar equipo" button that asks for confirmation before deleting. All controls SHALL have a touch target of at least 44px.

#### Scenario: Copy code
- **WHEN** the user presses "Copiar código de equipo"
- **THEN** the code is copied and a success snackbar event is dispatched

#### Scenario: Delete requires confirmation
- **WHEN** the user presses "Eliminar equipo" and confirms
- **THEN** the team is deleted and the list reloads
- **AND** cancelling the dialog deletes nothing
