## ADDED Requirements

### Requirement: "A la vista" section on the team dashboard

The system SHALL show an "A la vista" section on `TeamDashboard.tsx`, above the existing
quick-access cards, containing an upcoming-events widget and a latest-news widget. Either widget
SHALL be able to load, be empty, or error independently without preventing the other widget or
the quick-access cards below from rendering.

#### Scenario: Both widgets render above the existing cards
- **WHEN** an authenticated user with a resolved team opens `/coach/team-dashboard`
- **THEN** the system renders the upcoming-events widget and the news widget above the existing
  `TeamDashboardCards` grid

#### Scenario: One widget failing does not block the other
- **WHEN** the upcoming-events widget's data request fails
- **THEN** the news widget and the quick-access cards still render normally

### Requirement: Upcoming-events widget shows the next three events

The system SHALL show, in the upcoming-events widget, up to the next three upcoming events for
the resolved team, each with its title, date/time, and an attendance-summary badge, and each
linking to that event's existing detail page. The badge SHALL show the coach aggregate breakdown
(convocados/going/pending/notGoing/percentage) for Coach/Administrator callers, or the caller's
own confirmation status for Player/FamilyMember callers.

#### Scenario: Coach sees the aggregate breakdown
- **WHEN** an authenticated Coach opens the team dashboard
- **THEN** each of the up to three upcoming-event cards shows convocados, going, pending,
  notGoing counts and the attendance percentage

#### Scenario: Player/FamilyMember sees their own status
- **WHEN** an authenticated Player or FamilyMember opens the team dashboard
- **THEN** each of the up to three upcoming-event cards shows only that caller's own confirmation
  status, never the aggregate counts

#### Scenario: No upcoming events
- **WHEN** the team has no events on or after today
- **THEN** the widget shows an empty state instead of an error

#### Scenario: Event card links to the existing detail page
- **WHEN** a user selects an upcoming-event card
- **THEN** the system navigates to that event's existing attendance detail page
  (`/coach/attendance/{eventId}`)

### Requirement: Player/FamilyMember can mark their own attendance from the upcoming-events widget

The system SHALL let a Player or FamilyMember caller mark their own attendance (Going or NotGoing)
for an upcoming event directly from the upcoming-events widget, via the existing attendance
confirmation capability, without navigating away from the dashboard. The action SHALL show a
per-card loading state while in flight, apply the new status optimistically, and revert with an
error notification if the request fails. This action SHALL NOT be shown to Coach or Administrator
callers.

#### Scenario: Player marks attendance as Going
- **WHEN** an authenticated Player selects "Voy" on an upcoming-event card
- **THEN** the system submits the confirmation, shows a loading state on that card while the
  request is in flight, and updates the card to reflect "Going" on success

#### Scenario: Player marks attendance as NotGoing
- **WHEN** an authenticated Player selects "No voy" on an upcoming-event card
- **THEN** the system submits the confirmation and updates the card to reflect "NotGoing" on
  success

#### Scenario: Failed confirmation reverts and notifies
- **WHEN** the confirmation request fails
- **THEN** the card's status reverts to its value before the action was taken and an error
  notification is shown, without affecting other cards in the widget

#### Scenario: Coach and Administrator never see the action
- **WHEN** an authenticated Coach or Administrator opens the team dashboard
- **THEN** the upcoming-events widget shows the aggregate breakdown only, with no
  attendance-marking controls

### Requirement: Attendance badges on existing event-card lists

The system SHALL show the same attendance-summary badge (as the upcoming-events widget) on each
event card in the existing Attendance event list and on each match card in the existing
Convocatorias list, fetched through one shared request per page rather than one request per card.

#### Scenario: Attendance page cards show the badge
- **WHEN** an authenticated Coach opens the Attendance event list for a team
- **THEN** each event card shows the attendance-summary badge for its event

#### Scenario: Convocatorias cards show the badge
- **WHEN** an authenticated Coach opens the Convocatorias match list for a team
- **THEN** each match card shows the attendance-summary badge for its underlying event

#### Scenario: A match card renders safely if no event id is available
- **WHEN** a match card has no resolvable event id (a defensive case; the currently-shipped
  Convocatorias list always resolves one, since every rendered card is backed by an internal
  `SportEvent`)
- **THEN** that match card renders without an attendance-summary badge and without an error

#### Scenario: One request serves every visible card
- **WHEN** a page renders multiple event/match cards that need attendance-summary badges
- **THEN** the system issues one batched attendance-summary request for all currently-visible
  event ids, not one request per card

### Requirement: Latest-news widget shows the three most recent published items

The system SHALL show, in the news widget, the three most-recently-published news items (most
recent first), each linking to that item's read-only detail page.

#### Scenario: Widget shows the three most recent items
- **WHEN** at least three news items are Published
- **THEN** the widget shows exactly three items ordered most-recent-first

#### Scenario: No published news
- **WHEN** no news items are Published
- **THEN** the widget shows an empty state instead of an error

#### Scenario: Widget item links to the detail page
- **WHEN** a user selects a news item in the widget
- **THEN** the system navigates to that item's read-only detail page (`/coach/news/{id}`)
