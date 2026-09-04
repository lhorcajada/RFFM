# coach-attendance-dashboard Specification

## Purpose
TBD - created by archiving change dashboard-per-event-attendance-charts. Update Purpose after archive.
## Requirements
### Requirement: Resumen global stays a single aggregate stat
The "Resumen global" card SHALL continue to show a single aggregate attendance percentage and its `events`/`attend`/`absent` totals across all categories, unchanged from the current behavior.

#### Scenario: Global card renders as before
- **WHEN** the Dashboard tab renders with any `DashboardData`
- **THEN** the Resumen global card shows one percentage and three totals (Eventos/Asisten/No asisten), not a chart

### Requirement: Category cards show a per-event bar chart instead of an accumulated total
Each of the Entrenamientos, Partidos, and Otros eventos cards SHALL render a bar chart with one bar per finished event of that category (height proportional to that event's attendance percentage), plus the category's aggregate percentage shown as a reference figure in the card header.

#### Scenario: One bar per finished event
- **WHEN** a category has N finished events
- **THEN** the chart's underlying dataset has N points, one per event, each carrying that event's own attend/absent/total

#### Scenario: Aggregate percentage is independent of the visible window
- **WHEN** the chart's visible window shows only some of the category's events (see windowing requirement below)
- **THEN** the percentage shown in the card header still reflects the full-season aggregate, not just the visible window

### Requirement: Training's per-event breakdown uses the same classifier as its aggregate
The per-event attend/absent counts for Entrenamientos SHALL be computed with the same convocation classifier already used for the Entrenamientos aggregate (attendance via `assistanceTypeId`, with a fallback to a justified-absence status when `assistanceTypeId` is absent) — not the simpler classifier used for Partidos/Otros.

#### Scenario: Per-event sum matches the aggregate
- **WHEN** the per-event attend/absent counts for every Entrenamientos event are summed
- **THEN** the sum equals the Entrenamientos aggregate's attend/absent — for every fixture, including ones where the two classifiers would otherwise disagree

### Requirement: Windowed navigation across the season
Each category chart SHALL show, by default, only the most recent 5 finished events, with controls to navigate backward and forward through the rest of the season's events for that category.

#### Scenario: Default window shows the last 5 events
- **WHEN** a category has more than 5 finished events
- **THEN** the chart initially shows only the most recent 5

#### Scenario: Navigation is clamped at both ends
- **WHEN** the visible window already starts at the earliest event
- **THEN** the "previous" control is disabled
- **WHEN** the visible window already reaches the most recent event
- **THEN** the "next" control is disabled

### Requirement: Event detail available on hover and as a table
Each bar SHALL show a tooltip on hover/tap with the event's title, date, attend, absent, and percentage; each chart SHALL also offer a "Ver como tabla" toggle listing every event of that category (not only the visible window) with the same figures, as a non-color-dependent alternative.

#### Scenario: Tooltip on hover
- **WHEN** the user hovers (or taps, on touch) a bar
- **THEN** a tooltip shows that event's title, date, attend, absent, and percentage

#### Scenario: Table view lists every event
- **WHEN** the user activates "Ver como tabla"
- **THEN** a table listing all of the category's finished events (not limited to the current window) is shown, and the toggle label changes to "Ocultar tabla"

### Requirement: Empty category shows an empty state, not an empty chart
When a category has zero finished events, its card SHALL show the same `EmptyState` pattern already used elsewhere on this screen, instead of rendering a chart with no bars.

#### Scenario: No finished events yet
- **WHEN** a category (e.g. Otros eventos) has zero finished events
- **THEN** the card shows an empty-state message instead of an empty axis/pager

