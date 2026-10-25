## MODIFIED Requirements

### Requirement: "A la vista" section on the team dashboard

The system SHALL show an "A la vista" section on `TeamDashboard.tsx` containing an upcoming-events
widget and a latest-news widget. Either widget SHALL be able to load, be empty, or error independently
without preventing the other widget from rendering. The team dashboard SHALL NOT render the
full quick-access cards grid; the team sections are reached from the team navigation's «Menú»
page, and only the coach's three «Acciones rápidas» (`coach-team-dashboard-mobile-layout`) are
shown on the dashboard. Neither widget SHALL use a carousel: their items SHALL be visible at once,
stacked vertically.

#### Scenario: Both widgets render without the cards grid
- **WHEN** an authenticated Player opens `/coach/team-dashboard`
- **THEN** the system renders the upcoming-events widget and the news widget and does not render any quick-access card

#### Scenario: One widget failing does not block the other
- **WHEN** the upcoming-events widget's data request fails
- **THEN** the news widget still renders normally

#### Scenario: No carousel on the team dashboard
- **WHEN** the team has three upcoming events and three published news items
- **THEN** all three events and all three news items are rendered at once, with no carousel controls

### Requirement: Upcoming-events widget shows the next three events

The system SHALL show, in the upcoming-events widget, up to the next three upcoming events for
the resolved team. The first one SHALL be shown as the highlighted next-event card and the rest as
compact rows under «Después», each with its title, date/time and attendance information, and each
linking to that event's existing detail page. The attendance information SHALL be the coach
aggregate (convocados/going/pending/notGoing, or the attendance percentage in a row) for
Coach/Administrator callers, or the caller's own confirmation status for Player/FamilyMember callers.

#### Scenario: Coach sees the aggregate breakdown
- **WHEN** an authenticated Coach opens the team dashboard
- **THEN** the next-event card shows convocados, going, pending and notGoing counts, and each
  «Después» row shows the attendance percentage or «Sin convocar»

#### Scenario: Player/FamilyMember sees their own status
- **WHEN** an authenticated Player or FamilyMember opens the team dashboard
- **THEN** the next-event card and each «Después» row show only that caller's own confirmation
  status, never the aggregate counts

#### Scenario: No upcoming events
- **WHEN** the team has no events on or after today
- **THEN** the widget shows an empty state instead of an error

#### Scenario: Event links to the existing detail page
- **WHEN** a user selects an upcoming event's title
- **THEN** the system navigates to that event's existing attendance detail page
  (`/coach/attendance/{eventId}`)

### Requirement: Latest-news widget shows the three most recent published items

The system SHALL show, in the news widget, the three most-recently-published news items (most
recent first) as compact rows, each linking to that item's read-only detail page. Each row SHALL
show a 64 px cover thumbnail (or an icon when the item has no cover), the title and how long ago it
was published. The widget SHALL link to the full news list (`/coach/news`) with «Ver todas».

#### Scenario: Widget shows the three most recent items
- **WHEN** at least three news items are Published
- **THEN** the widget shows exactly three items ordered most-recent-first

#### Scenario: No published news
- **WHEN** no news items are Published
- **THEN** the widget shows an empty state instead of an error

#### Scenario: Widget item links to the detail page
- **WHEN** a user selects a news item in the widget
- **THEN** the system navigates to that item's read-only detail page (`/coach/news/{id}`)

#### Scenario: Row shows title and age
- **WHEN** a news item was published two days ago
- **THEN** its row shows the title and «Hace 2 días»

#### Scenario: «Ver todas» opens the news list
- **WHEN** the user selects «Ver todas»
- **THEN** the system navigates to `/coach/news`
