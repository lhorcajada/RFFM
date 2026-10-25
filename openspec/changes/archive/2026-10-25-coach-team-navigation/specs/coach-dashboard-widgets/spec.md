## MODIFIED Requirements

### Requirement: "A la vista" section on the team dashboard

The system SHALL show an "A la vista" section on `TeamDashboard.tsx` containing an upcoming-events
widget and a latest-news widget. Either widget SHALL be able to load, be empty, or error independently
without preventing the other widget from rendering. The team dashboard SHALL NOT render the
quick-access cards grid; the team sections are reached from the team navigation's «Menú» page.

#### Scenario: Both widgets render without the cards grid
- **WHEN** an authenticated user with a resolved team opens `/coach/team-dashboard`
- **THEN** the system renders the upcoming-events widget and the news widget and does not render any quick-access card

#### Scenario: One widget failing does not block the other
- **WHEN** the upcoming-events widget's data request fails
- **THEN** the news widget still renders normally
