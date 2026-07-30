## ADDED Requirements

### Requirement: Full roster visible to every role
The Mobile event detail screen SHALL show every convocated player of the event's team along with each player's attendance status, regardless of the viewer's role.

#### Scenario: Player views the roster
- **WHEN** a user with the Player or FamilyMember role opens the event detail screen
- **THEN** every team player convocated to the event is listed with their attendance status ("Voy"/"No voy"/"Pendiente" in the device's language)

#### Scenario: Coach or Administrator views the roster
- **WHEN** a user with the Coach or Administrator role opens the event detail screen
- **THEN** the same full roster and statuses are shown as for Player/FamilyMember

### Requirement: Edit rights scoped by role
Only the caller's own player's row SHALL show "Voy"/"No voy" edit buttons for Player and FamilyMember roles. Coach and Administrator SHALL see edit buttons on every row.

#### Scenario: Player cannot edit another player's row
- **WHEN** a Player or FamilyMember views a row that is not their own linked player
- **THEN** no "Voy"/"No voy" buttons are shown on that row (status is read-only)

#### Scenario: Player can edit their own row
- **WHEN** a Player or FamilyMember views the row matching their own `teamPlayerId`
- **THEN** "Voy"/"No voy" buttons are shown and functional on that row

#### Scenario: Coach/Administrator can edit any row
- **WHEN** a Coach or Administrator views any row in the roster
- **THEN** "Voy"/"No voy" buttons are shown and functional on that row

### Requirement: Backend enforces edit permission independent of the UI
The backend SHALL reject an attendance write for a player that isn't the caller's own linked player, unless the caller has the Coach or Administrator role.

#### Scenario: Non-owner, non-privileged write is rejected
- **WHEN** a user without the Coach/Administrator role calls the attendance confirmation endpoint for a `teamPlayerId` that isn't their own linked player
- **THEN** the request is rejected (forbidden), independent of what the Mobile UI shows

#### Scenario: Coach write for any player succeeds
- **WHEN** a user with the Coach role calls the attendance confirmation endpoint for any team player
- **THEN** the request succeeds and updates that player's `EventAttendanceConfirmation`

#### Scenario: Administrator write for any player succeeds
- **WHEN** a user with the Administrator role calls the attendance confirmation endpoint for any team player
- **THEN** the request succeeds and updates that player's `EventAttendanceConfirmation`

### Requirement: Attendance status localized to device language
The attendance status label SHALL be rendered in the device's configured language via the Mobile i18n infrastructure, not hardcoded English strings.

#### Scenario: Device in Spanish
- **WHEN** the device's locale is Spanish
- **THEN** statuses render as "Voy" / "No voy" / "Pendiente"

#### Scenario: Device in English
- **WHEN** the device's locale is English
- **THEN** statuses render as "Going" / "Not going" / "Pending"

#### Scenario: Unsupported device locale falls back
- **WHEN** the device's locale has no matching translation dictionary
- **THEN** the status falls back to the Spanish (`es`) translation

### Requirement: Roster grouped by status with counts
The roster SHALL be organized into three collapsible groups in a fixed order — Pendientes, Asisten, No asisten — each showing a translated label and the number of players in that group.

#### Scenario: Group labels and counts
- **WHEN** the roster loads with players in different statuses
- **THEN** each group header shows its translated label and the count of players currently in that status

#### Scenario: Fixed group order
- **WHEN** the roster is rendered
- **THEN** the groups always appear in the order Pendientes, Asisten, No asisten, regardless of API response order

### Requirement: Own player sorted first within their group
Within whichever status group the caller's own player belongs to, that player's row SHALL be shown first.

#### Scenario: Own player first in their group
- **WHEN** a group contains the caller's own player among other players
- **THEN** the caller's own player's row is the first one rendered in that group

### Requirement: Groups collapsed by default except one
All groups SHALL start collapsed except exactly one, determined by role: the group containing the caller's own player for Player/FamilyMember, or always the Pendientes group for Coach/Administrator.

#### Scenario: Player/FamilyMember initial expansion
- **WHEN** a Player or FamilyMember opens the screen
- **THEN** only the group containing their own player is expanded; the other groups are collapsed

#### Scenario: Coach/Administrator initial expansion
- **WHEN** a Coach or Administrator opens the screen
- **THEN** the Pendientes group is expanded regardless of where their own player (if any) is, and the other groups are collapsed

#### Scenario: Toggling a group
- **WHEN** a user taps a group's header
- **THEN** that group's expanded/collapsed state toggles, independent of the other groups

#### Scenario: Moved player stays visible after a status change
- **WHEN** a player's attendance status is confirmed (by themselves or by a Coach/Administrator on their behalf)
- **THEN** the group matching the new status becomes expanded so the player's row remains visible

### Requirement: Player cards styled like Coach's player cromo
Each roster row SHALL be rendered as a compact player card in the same visual language as Coach web's `PlayerCromo` component: a photo area with a dorsal-number badge, and a body with an accent line and the player's name.

#### Scenario: Card layout
- **WHEN** a roster row is rendered
- **THEN** it shows a photo (or placeholder) with the player's dorsal number overlaid when present, and the player's name below
