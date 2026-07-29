## ADDED Requirements

### Requirement: Dedicated friendlies/tournaments tab
The Mobile app SHALL provide a dedicated `FriendliesTab` within `CalendarTabs`, separate from the general events calendar, showing only upcoming friendly matches and tournaments.

#### Scenario: Tab visible in navigation
- **WHEN** the coach/family user opens the team's calendar tabs
- **THEN** a "Amistosos" tab is visible alongside the existing Eventos, Noticias, Liga and Estadísticas tabs

### Requirement: Friendlies/tournaments list sorted by date
The `FriendliesTab` SHALL list upcoming events classified as friendly or tournament, sorted by date ascending (soonest first).

#### Scenario: Multiple upcoming friendlies/tournaments
- **GIVEN** the team has more than one upcoming event classified as friendly or tournament
- **WHEN** the user opens the `FriendliesTab`
- **THEN** the events are displayed ordered by date ascending, soonest first

#### Scenario: Non-friendly/tournament events excluded
- **GIVEN** the team has upcoming training sessions and league matches in addition to friendlies/tournaments
- **WHEN** the user opens the `FriendliesTab`
- **THEN** only the events classified as friendly or tournament are shown, and training/league events are excluded

### Requirement: Navigate to event detail
Tapping an event in the `FriendliesTab` list SHALL navigate to the existing event detail screen for that event.

#### Scenario: Tap an event
- **GIVEN** the `FriendliesTab` list shows at least one upcoming friendly or tournament
- **WHEN** the user taps that event
- **THEN** the app navigates to the event detail screen showing that event's information (rival, location, time)

### Requirement: Explicit empty state
When there are no upcoming friendlies or tournaments, the `FriendliesTab` SHALL show an explicit empty state instead of an empty list.

#### Scenario: No upcoming friendlies or tournaments
- **GIVEN** the team has no upcoming events classified as friendly or tournament
- **WHEN** the user opens the `FriendliesTab`
- **THEN** the screen shows a message indicating there are no upcoming friendly matches or tournaments, instead of an empty list
