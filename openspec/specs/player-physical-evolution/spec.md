# player-physical-evolution Specification

## Purpose
TBD - created by archiving change player-physical-evolution. Update Purpose after archive.
## Requirements
### Requirement: The API returns a player's daily physical evolution
The system SHALL expose `GET /api/catalog/team/{teamId}/players/{teamPlayerId}/physical-evolution?days={days}` where `days` is one of `28`, `56` or `84` (default `28`). The response SHALL contain one point per calendar day from `today − (days − 1)` to `today` (UTC), oldest first, each with `date`, `formStatus` (0-100 or `null`), `readiness` (0-100 or `null`) and `fatigue` (0-100). Each point SHALL be the value that the Estado de forma, Rodaje and Cansancio calculations produce for that day using the current data, evaluating only events up to that day, with the same 84-day replay window (Forma/Rodaje) and 14-day load window (Cansancio) used by the team statistics. The endpoint SHALL require the same feature permission (`Squad`, `Read`) and team membership as `GET /api/catalog/team/{teamId}/player-stats`.

#### Scenario: Default range returns 28 daily points
- **WHEN** an authorized user calls the endpoint without `days`
- **THEN** the system returns `200` with exactly 28 points, the first dated 27 days ago and the last dated today

#### Scenario: Today's point matches the team statistics
- **WHEN** the same player is requested through `physical-evolution` and `player-stats` on the same day
- **THEN** the last point's `formStatus`, `readiness` and `fatigue` equal that player's `formStatus`, `readiness` and `fatigue` in `player-stats`

#### Scenario: A past day reflects only events up to that day
- **WHEN** the player attended a training 5 days ago and played a match 2 days ago
- **THEN** the points before the training have no load from either event, the point of the training day rises, and the match only affects points from its day onwards

#### Scenario: Past days are closed as rest days
- **WHEN** a past day has no activity for the player
- **THEN** that day counts as a rest day for Forma and Rodaje (grace days and decay apply), unlike today, which only counts once it has activity

#### Scenario: Metrics without data are null
- **WHEN** the player has no activity in the 84 days before a given day
- **THEN** that point has `formStatus = null` and `readiness = null` and `fatigue = 0`

#### Scenario: Categories without standard match duration have no Forma
- **WHEN** the team's category has no standard match duration
- **THEN** the response has `formStatusAvailable = false` and every point has `formStatus = null`

#### Scenario: Invalid range
- **WHEN** `days` is not 28, 56 or 84
- **THEN** the system returns a `400` `ValidationProblemDetails` response

#### Scenario: Player not in team
- **WHEN** `teamPlayerId` does not belong to `teamId`
- **THEN** the system returns a `404` `ProblemDetails` response

#### Scenario: Unauthorized access
- **WHEN** the caller is anonymous, lacks the `Squad` read permission or is not a member of the team
- **THEN** the system returns `401` or `403` as the team statistics endpoint does

### Requirement: The evolution includes the day's events and injuries
The response SHALL include `events`: the trainings the player attended and the matches (league, friendly, tournament) where the player had minutes within the range, each with `date`, `eventId`, `eventTypeId`, `kind` (`Training` | `Match`), `trainingTypes` and `minutesPlayed`. It SHALL also include `injuries`: the player's injuries overlapping the range, with `startDate` and `endDate` (`null` if still active).

#### Scenario: Attended training and played match are listed
- **WHEN** the player attended a Físico training and played 60 minutes in a league match within the range
- **THEN** `events` contains both with their date, kind, training types and minutes

#### Scenario: Missed events are not listed
- **WHEN** the player missed a training or was called up without playing
- **THEN** those events are not part of `events`

#### Scenario: Active injury
- **WHEN** the player has an injury started within the range and not yet finished
- **THEN** `injuries` contains it with `endDate = null`

### Requirement: The player file shows the physical evolution chart
The Coach player detail page SHALL show, in the Estadísticas tab below the current Forma/Rodaje/Cansancio bars, a «Evolución física» section with a line chart of the three metrics (0-100), a range selector «4 semanas» / «8 semanas» / «12 semanas» (default 4), a textual summary of each metric's current value and its change across the range, markers for match days and injury start days, and the detail of the selected day (values and events). It SHALL be usable at ~360 px width and SHALL be visible to the same roles that see the current bars.

#### Scenario: Chart renders the three series
- **WHEN** the evolution loads with data
- **THEN** the chart shows Forma, Rodaje and Cansancio series and the summary shows, e.g., «Forma 62 (+8)»

#### Scenario: Changing the range reloads the data
- **WHEN** the user selects «8 semanas»
- **THEN** the evolution is requested with `days=56` and the chart shows 56 days

#### Scenario: Forma not available
- **WHEN** the response has `formStatusAvailable = false`
- **THEN** the Forma series and its summary are not shown

#### Scenario: Selecting a day shows its detail
- **WHEN** the user selects a day in the chart
- **THEN** the section shows that day's date, the three values and the events of that day (e.g. «Entreno · Físico», «Liga · 60'»)

#### Scenario: Loading, error and empty states
- **WHEN** the request is in progress, fails, or the player has no activity in the range
- **THEN** the section shows a loading indicator, an error message in Spanish with a retry button, or «Sin actividad en este periodo» respectively

### Requirement: Squad statistics link to the player's evolution
Each player card in Estadísticas de plantilla SHALL show a «Ver evolución» link that navigates to that player's detail page (`/coach/player/{teamPlayerId}`), where the Estadísticas tab is the default.

#### Scenario: Navigating from the squad
- **WHEN** the coach clicks «Ver evolución» on a player card
- **THEN** the app navigates to that player's detail page showing the Estadísticas tab

