## ADDED Requirements

### Requirement: The wallets list shows the associated players of each row
Each row of the coach's wallets list of a team SHALL show the associated players of that row inside its existing card. The card SHALL use the same responsive card layout as today, never a table. A row without associated players SHALL show no players area.

#### Scenario: Family member with one player
- **WHEN** the coach opens the wallets list and a family member row has one associated player
- **THEN** the card of that row shows the name of that player

#### Scenario: Family member with several players
- **WHEN** a family member row has three associated players
- **THEN** the card of that row shows the names of all three players, and the family member appears in a single card

#### Scenario: Player row
- **WHEN** a player user with a linked player record appears in the list
- **THEN** the card of that row shows the player's own name as associated player

#### Scenario: Coach row
- **WHEN** a coach row appears in the list
- **THEN** its card shows no associated players

#### Scenario: Family member without players
- **WHEN** a family member row has no associated players
- **THEN** its card is shown with its name, role and balance and without a players area

#### Scenario: Narrow screen
- **WHEN** the coach opens the list at a width of 360 px and a family member has several players
- **THEN** all the player names are readable inside the card and there is no horizontal scroll

### Requirement: The coach searches the wallets list by player or family member name
The coach's wallets list SHALL offer a search box that filters the rows already loaded, without any new call to the API. A row SHALL match when the text matches the name of the row's user or the name of any of the row's associated players. The comparison SHALL ignore upper and lower case, accents, and leading, trailing and repeated spaces in the text, except that the letter "ñ" SHALL be a different letter from "n" and SHALL NOT match it in either direction. The result SHALL be the union of all matching rows, each row shown once, in the order of the unfiltered list. A row that matches SHALL keep showing all of its associated players, not only the one that matched the text. With an empty search box (or only spaces) the list SHALL show every row. When the text matches no row, the list SHALL show a "no results" message that is different from the message "No hay participantes en el equipo" shown for a team without participants.

#### Scenario: Search by player name
- **WHEN** the coach searches the name of a player who has a user in the team and two family members
- **THEN** the list shows the row of that player and the rows of the two family members, and no other row

#### Scenario: Search by player name when the player has no user
- **WHEN** the coach searches the name of a player who has no user in the team but has one family member
- **THEN** the list shows the row of that family member only

#### Scenario: Search by family member name
- **WHEN** the coach searches the name of a family member linked to two players
- **THEN** the list shows the row of that family member with both players, not only the player whose name was typed or matched

#### Scenario: Text matching a player and a family member of another player
- **WHEN** the text matches the name of player A and the name of a family member of player B
- **THEN** the list shows the rows that match player A, the row of that family member, and each row only once even if it matches in more than one way

#### Scenario: Case, accents and spaces are ignored
- **WHEN** the coach types "  jOSE   perez " and a player is named "José Pérez"
- **THEN** the rows tied to "José Pérez" are shown

#### Scenario: The letter ñ is distinct from n
- **WHEN** the coach types "nino" and a player is named "Niño", or types "niño" and a player is named "Nino"
- **THEN** that player's rows are not shown

#### Scenario: Result count is announced
- **WHEN** the coach types text in the search box
- **THEN** the number of visible rows ("N resultados", or "0 resultados" when none) is announced to assistive technology through a status region

#### Scenario: Empty search box
- **WHEN** the coach clears the search box or it contains only spaces
- **THEN** every row of the list is shown

#### Scenario: No matches
- **WHEN** the text matches no row and the team has participants
- **THEN** the list shows a "no results" message, and it does not show "No hay participantes en el equipo"

#### Scenario: Team without participants
- **WHEN** the team has no participants
- **THEN** the list shows "No hay participantes en el equipo", with or without text in the search box

#### Scenario: Typing does not call the API
- **WHEN** the coach types and changes the search text
- **THEN** no additional request is sent to the API

## MODIFIED Requirements

### Requirement: The coach lists the wallets of the team
Only the team's coach SHALL list the members of the team (Coach, Player, FamilyPlayer) with their name, role and balance, and read the movements of any of them. A member without a wallet SHALL appear with balance 0.00. Each member row SHALL also carry the list of its associated players, each with the player's id and name, in the same response and without a new endpoint: the route `GET /api/teams/{teamId}/quiniela/wallets` and its parameters SHALL NOT change. Only players of the team being listed SHALL count as associated players. The associated players of a row SHALL be: for a FamilyPlayer, every player of the team that the family member is linked to through the family member link; for a Player, the player record linked to that user in the team, if any; for a Coach, none. A family member linked to several players of the team SHALL appear in one row with all of them. A player who has left the team (with a leaving date) SHALL be listed only when the row's user has something pending, meaning a wallet balance different from 0.00 or a ticket with pending payment in the team. When a user holds several participant roles in the team, the row role SHALL follow the precedence Coach, then Player, then FamilyPlayer.

#### Scenario: List
- **WHEN** the coach requests the wallets of the team
- **THEN** every participant of the team appears with their balance

#### Scenario: Not the coach
- **WHEN** a family member requests the wallets of the team
- **THEN** the request is rejected as forbidden

#### Scenario: Family member linked to several players
- **WHEN** the coach requests the wallets and a family member is linked to two players of the team
- **THEN** that family member appears in one row whose associated players are both players

#### Scenario: Family member linked to players of other teams
- **WHEN** a family member is linked to one player of the requested team and to one player of another team
- **THEN** the row of that family member lists only the player of the requested team

#### Scenario: Family member without linked players
- **WHEN** a family member of the team has no linked player in the requested team
- **THEN** the row still appears, with an empty list of associated players

#### Scenario: Family member without wallet
- **WHEN** a family member has no wallet
- **THEN** the row appears with balance 0.00 and with its associated players

#### Scenario: Player row
- **WHEN** the coach requests the wallets and a player user is linked to a player record of the team
- **THEN** the row of that user has that player as its only associated player

#### Scenario: Player user without a linked player record
- **WHEN** a player user of the team has no linked player record
- **THEN** the row appears with an empty list of associated players

#### Scenario: Coach row
- **WHEN** the coach requests the wallets
- **THEN** the rows with the role Coach have an empty list of associated players, even if that user is linked as family member of a player

#### Scenario: Departed player with nothing pending
- **WHEN** a family member is linked to a player who left the team, and has balance 0.00 and no unpaid ticket
- **THEN** that player is not listed among the associated players

#### Scenario: Departed player with something pending
- **WHEN** a family member is linked to a player who left the team, and has a non-zero balance or an unpaid ticket
- **THEN** that player is still listed

#### Scenario: User with several roles
- **WHEN** a user holds both the Coach and the FamilyPlayer role in the team
- **THEN** the row shows the role Coach and an empty list of associated players
