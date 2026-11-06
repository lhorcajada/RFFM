## Why

On the "Monederos del equipo" list, a family member row shows only a name and a balance. The coach cannot tell which player the family member belongs to, and cannot find the family members of a given player.

## What Changes

- Each row of the wallets list carries the team players it is tied to ("associated players"):
  - a family member row lists every player of the team that the family member is linked to;
  - a player row shows the player's own name;
  - a coach row has no associated players.
- The wallets list gets a search box. It filters the already loaded list in the browser by player name or family member name, ignoring case, accents and extra spaces.
  - Searching a player name returns the player's own row (when the player has a user in the team) and the rows of all the player's family members.
  - Searching a family member name returns that row, still showing all of its players.
  - Searching with no match shows a "no results" message, different from the empty-team message.
- The wallets endpoint adds the associated players to each row of its existing response. Its route and parameters do not change, and no new endpoint is added.
- No database change and no migration. Mobile is out of scope.

## Capabilities

### New Capabilities
<!-- None. -->

### Modified Capabilities
- `quiniela-wallet`: the requirement "The coach lists the wallets of the team" now also returns the associated players of each row; two new requirements cover how the list shows them and the search box.

## Impact

- **API** (`Back/ExtractionApi`): the response of `GET /api/teams/{teamId}/quiniela/wallets` gains one field per row. Existing fields are unchanged, so current clients keep working.
- **Web, Coach app** (`Front`): the wallets list page, whose rows are rendered inline by the page itself, and the wallets service type. The "Mi monedero" card component is not part of the list and is not changed.
- No change to the database, to other quiniela endpoints, or to Mobile.

## Proposal Research Documentation

**Local files**:
- Front/src/apps/coach/pages/quiniela/QuinielaWallets.tsx - list page; renders each row inline, no search or filter today
- Front/src/apps/coach/pages/quiniela/components/WalletCard.tsx - checked: it is the participant's own "Mi monedero" card, not the card of the list
- Front/src/apps/coach/pages/quiniela/__tests__/QuinielaWallets.test.tsx - current list tests
- Front/src/apps/coach/services/quinielaService.ts - `QuinielaWalletSummary` type and `getQuinielaWallets`
- Front/src/apps/coach/navigation/teamSections.ts - "Monederos del equipo" is the menu label of the page
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Quiniela/GetQuinielaWallets.cs - endpoint, route and handler
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Quiniela/QuinielaSupport.cs - `QuinielaWalletSummaryDto`, `LoadParticipantsAsync`, `ParticipantRoles`
- Back/ExtractionApi/src/RFFM.Api/Domain/Entities/TeamPlayers/TeamPlayerFamilyMember.cs - `LinkedUserId` and `TeamPlayerId`
- Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/UserClubs/UserTeam.cs - `LinkedTeamPlayerId` and `LinkPlayer`
- Back/ExtractionApi/src/RFFM.Api/Domain/Entities/TeamPlayers/TeamPlayer.cs - team player, reference to `Player`
- Back/ExtractionApi/src/RFFM.Api/Domain/Entities/Players/Player.cs - `Name`, `LastName`, `Alias`
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/FamilyMemberAccounts/Commands/ApproveFamilyMemberAccount.cs - sets both links when a family account is approved
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Notifications/Services/WebPushNotificationDispatcher.cs - existing use of both links to find the players of a user
- Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/QuinielaWalletHandlerTests.cs - current handler tests of the list
- Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/QuinielaEndpointTests.cs - endpoint tests
- openspec/specs/quiniela-wallet/spec.md - baseline requirements
- openspec/config.yaml - project context (none set)

**External URLs**:
<!-- None. -->

## Request Additional Notes

Undecided: cuál es el enlace existente entre el usuario de un jugador y su registro de jugador (afecta a E4 e I2); el diseño debe confirmarlo antes de implementar.

## Additional Notes

- The note above is answered by current code: the link between the user of a player and the player record is `UserTeam.LinkedTeamPlayerId`, set by `UserTeam.LinkPlayer` for the roles Player and FamilyPlayer. The design should still confirm it. A player user whose `UserTeam` has no link has no associated player, and the specs state that case.
- The Ready to Propose block names `WalletCard.tsx` as the per-row card. Current code contradicts this: that component is the participant's own "Mi monedero" card, and the rows of the list are rendered inline by the list page. The specs therefore describe the row of the list, not that component.
- A family member user also has a `UserTeam` row with a single `LinkedTeamPlayerId`. The block decides that a family member's players come from `TeamPlayerFamilyMember` (`LinkedUserId` to `TeamPlayerId`), because that link can hold several players of the team.
- `QuinielaSupport.LoadParticipantsAsync` already filters family links by `TeamPlayer.TeamId == teamId`, which is the same team restriction this change needs.
- `Player` has `Name`, `LastName` and `Alias`; the specs say "the player's name" and leave the exact text of the name to the design.
- The handler tests of the list live in `QuinielaWalletHandlerTests.cs`; `QuinielaEndpointTests.cs` covers the endpoint contract.
