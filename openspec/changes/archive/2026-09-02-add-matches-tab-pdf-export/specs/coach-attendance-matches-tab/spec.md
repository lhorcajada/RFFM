## ADDED Requirements

### Requirement: PDF export of the collapsed-card summary
`AttendanceMatchesTab` SHALL offer an "Exportar resumen" action that generates a PDF listing every player in `rows`, in the exact order `rows` was passed, showing what each player's collapsed card shows on screen: dorsal (colored by position), name, the aggregate chips (`totalMatches`, `startedMatches`, `notCalledMatches`, `seasonMinutesPlayed`), and the same last-5-match form strip shown on screen.

#### Scenario: Summary PDF lists players in on-screen order
- **WHEN** "Exportar resumen" is triggered with `rows` in a given order
- **THEN** the generated PDF lists players in that same order, not re-sorted alphabetically or by dorsal

#### Scenario: Summary PDF includes the aggregate figures
- **WHEN** "Exportar resumen" is triggered for a player row
- **THEN** the PDF includes that player's `totalMatches`, `startedMatches`, `notCalledMatches`, and `seasonMinutesPlayed`

### Requirement: PDF export of full match-by-match detail
`AttendanceMatchesTab` SHALL offer an "Exportar completo" action that generates a PDF including everything from the summary export plus, per player, one entry per match column showing the match label, rival, date, an "Amistoso" tag when the match is friendly, the player's state for that match, and minutes played.

#### Scenario: Full PDF lists players in on-screen order
- **WHEN** "Exportar completo" is triggered with `rows` in a given order
- **THEN** the generated PDF lists players in that same order, not re-sorted alphabetically or by dorsal

#### Scenario: Full PDF includes every match, not just the last five
- **WHEN** "Exportar completo" is triggered for a player with more than 5 match columns
- **THEN** the PDF includes a detail entry for every column, not only the most recent 5

#### Scenario: Full PDF marks friendly matches
- **WHEN** a match column has `isFriendly: true`
- **THEN** its detail entry in the PDF shows an "Amistoso" tag

#### Scenario: Full PDF shows starter minutes
- **WHEN** a player's cell for a match has `state: "starter"` and `minutesPlayed: 78`
- **THEN** the detail entry for that match shows the "Titular" state and `78'`

### Requirement: Export actions respect role permissions
The "Exportar resumen" and "Exportar completo" actions SHALL be hidden for users whose role is Player, FamilyPlayer, or FamilyMember, matching the existing Excel-export visibility rule on the "Entrenamientos" tab.

#### Scenario: Coach sees both export actions
- **WHEN** the logged-in user's role is Coach (or any role other than Player/FamilyPlayer/FamilyMember)
- **THEN** both "Exportar resumen" and "Exportar completo" buttons are rendered

#### Scenario: Player/family roles do not see export actions
- **WHEN** the logged-in user's role is Player, FamilyPlayer, or FamilyMember
- **THEN** neither export button is rendered

### Requirement: Export actions show a busy state while generating
Each export button SHALL be disabled while its own PDF is being generated, and re-enabled once generation completes.

#### Scenario: Button disabled during export
- **WHEN** an export action has been triggered and its PDF generation has not yet resolved
- **THEN** that action's button is disabled

#### Scenario: Button re-enabled after export completes
- **WHEN** an export action's PDF generation resolves
- **THEN** that action's button is enabled again
