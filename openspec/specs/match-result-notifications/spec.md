# match-result-notifications Specification

## Purpose
TBD - created by archiving change match-result-push-notifications. Update Purpose after archive.
## Requirements
### Requirement: Users are notified once when their primary team's league match result is published
The system SHALL periodically check the RFFM league matches of the team in each user's primary `FederationSetting` for the current season (`IsPrimary = true` with `TeamId` and `GroupId` set) and, when a match where that team plays as local or visitor has both `LocalGoals` and `VisitorGoals` published, SHALL create a `Notification` of type `MatchResult` and attempt Web Push delivery to that user, unless the user opted out. Each (user, match) pair SHALL be notified at most once.

#### Scenario: A finished match with published score notifies the user
- **WHEN** the match of the user's primary team has ended and its score is published
- **THEN** the user receives a `MatchResult` notification whose body contains both team names and the score, with deep link `/coach/results`

#### Scenario: The result is notified only once
- **WHEN** the check runs again after the user's match result has already been notified
- **THEN** no new notification is created for that user and match

#### Scenario: Matches of other teams in the group are not notified
- **WHEN** a match of the group that does not involve the user's primary `TeamId` gets its score published
- **THEN** no notification is created for that user

#### Scenario: Non-primary saved teams are not notified
- **WHEN** a match of a team saved in one of the user's non-primary `FederationSetting` gets its score published
- **THEN** no notification is created for that user

#### Scenario: A match without published score is not notified
- **WHEN** the team's match has reached its estimated end but the RFFM has not published both goal values
- **THEN** no notification is created and the round is refreshed according to the existing refresh policy

#### Scenario: Old matches are not notified
- **WHEN** a user saves a primary team whose matches that ended more than the notification window (48 hours by default) ago already have scores
- **THEN** no notification is created for those matches

#### Scenario: A delivery failure does not stop the check
- **WHEN** sending the Web Push fails or the RFFM is unavailable for one group
- **THEN** the failure is logged and the remaining groups are still processed

### Requirement: Users can opt out of match result notifications
The system SHALL keep match result notifications enabled by default and SHALL expose `GET /api/match-result-notifications/preference` returning `{ enabled, teamName }` for the current user (with `teamName` taken from the current primary `FederationSetting`, or `null`) and `PUT /api/match-result-notifications/preference` with body `{ enabled }` to change it. Both endpoints SHALL require authentication.

#### Scenario: Preference defaults to enabled
- **WHEN** an authenticated user who never changed the preference calls `GET /api/match-result-notifications/preference`
- **THEN** the system returns `200` with `enabled = true` and the primary team's name

#### Scenario: Opting out stops notifications
- **WHEN** a user calls `PUT` with `enabled = false` and their team's match result is later published
- **THEN** the system returns `204`, subsequent `GET` returns `enabled = false`, and that user receives no `MatchResult` notification

#### Scenario: Opting back in
- **WHEN** a user who opted out calls `PUT` with `enabled = true`
- **THEN** the system returns `204` and the user receives the following match result notifications

#### Scenario: Anonymous request
- **WHEN** an unauthenticated client calls either endpoint
- **THEN** the system returns `401`

#### Scenario: Missing enabled value
- **WHEN** a user calls `PUT` without `enabled`
- **THEN** the system returns a `400` `ValidationProblemDetails` response

### Requirement: The Results page shows a match result notifications toggle
The Coach Results page (`/coach/results`) SHALL show a "Notificarme los resultados de {teamName}" switch reflecting the current user's preference when the user has a primary team, and SHALL persist changes through the preference endpoint. When the user has no primary team the page SHALL show a hint to save their team in settings instead of the switch.

#### Scenario: Toggle reflects the stored preference
- **WHEN** a user with a primary team and preference `enabled = true` opens Results
- **THEN** the switch "Notificarme los resultados de {teamName}" is displayed checked

#### Scenario: Turning the toggle off
- **WHEN** the user unchecks the switch
- **THEN** the page calls `PUT` with `enabled = false` and the switch stays unchecked

#### Scenario: Save failure reverts the toggle
- **WHEN** the `PUT` request fails
- **THEN** the switch returns to its previous value and an error snackbar is shown

#### Scenario: User without primary team
- **WHEN** the preference response has `teamName = null`
- **THEN** no switch is shown and a hint to save their team in settings is displayed

#### Scenario: Browser without push subscription
- **WHEN** the switch is shown and the current browser has no Web Push subscription
- **THEN** a help text links to Ajustes > Notificaciones to activate notifications on this device

