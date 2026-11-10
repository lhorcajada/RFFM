## MODIFIED Requirements

### Requirement: Team fund balance icon is visible to every user in the app header
The system SHALL show a team-fund-balance icon in the app header showing the resolved team's current balance, for any authenticated user whose account resolves to a team — unlike the pending-sanctions notification icon in the same header, which SHALL remain restricted to the `Player` and `FamilyMember` roles. The team SHALL be resolved via the caller's own profile team association when present, falling back to the coach's configured preferred team. If neither resolves a team, the icon SHALL be hidden rather than shown with no data. Clicking the icon SHALL navigate to the team transactions page for the resolved team (`/coach/transactions?teamId=<id>`), not to the sanctions page. The pending-sanctions notification icon and the side menu SHALL keep navigating to the sanctions page (`/coach/sanctions`).

#### Scenario: Coach sees the fund balance icon even though they never see the sanctions badge
- **WHEN** an authenticated Coach with a resolved team (via their preferred-team configuration) opens any page rendering the app header
- **THEN** the team-fund-balance icon is shown with their team's current balance, even though the pending-sanctions badge (Player/FamilyMember only) is not shown to them

#### Scenario: Player/FamilyMember sees the fund balance icon alongside their sanctions badge
- **WHEN** an authenticated Player or FamilyMember with a resolved team opens any page rendering the app header
- **THEN** both the team-fund-balance icon and the pending-sanctions badge are shown

#### Scenario: No resolvable team hides the fund balance icon
- **WHEN** an authenticated user's profile has no team association and no coach preferred-team configuration resolves one
- **THEN** the team-fund-balance icon is not shown

#### Scenario: Clicking the fund balance icon opens the team transactions page
- **WHEN** a user with a resolved team clicks the team-fund-balance icon
- **THEN** the app navigates to `/coach/transactions?teamId=<id>` for that team and not to `/coach/sanctions`

#### Scenario: Sanctions entry points keep going to sanctions
- **WHEN** a user clicks the pending-sanctions notification icon or the sanctions entry of the side menu
- **THEN** the app navigates to `/coach/sanctions`
