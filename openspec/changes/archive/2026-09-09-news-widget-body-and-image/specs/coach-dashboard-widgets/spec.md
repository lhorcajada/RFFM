## MODIFIED Requirements

### Requirement: Latest-news widget shows the three most recent published items

The system SHALL show, in the news widget, the three most-recently-published news items (most
recent first), each linking to that item's read-only detail page. Each card SHALL show the news
item's body/description text (not its short subtitle) and a cover image occupying roughly half
the card's height, so the widget gives a materially larger and more informative preview than a
title-only card.

#### Scenario: Widget shows the three most recent items
- **WHEN** at least three news items are Published
- **THEN** the widget shows exactly three items ordered most-recent-first

#### Scenario: No published news
- **WHEN** no news items are Published
- **THEN** the widget shows an empty state instead of an error

#### Scenario: Widget item links to the detail page
- **WHEN** a user selects a news item in the widget
- **THEN** the system navigates to that item's read-only detail page (`/coach/news/{id}`)

#### Scenario: Widget card shows the body text, truncated to fit
- **WHEN** a news item's `body` is longer than fits the card's available text area
- **THEN** the widget card shows as many lines of `body` as fit and truncates the remainder with
  "…", rather than showing the item's short `subtitle` or clipping the text abruptly with no
  ellipsis

#### Scenario: Widget card's cover image fills roughly half the card
- **WHEN** a news item with a cover image appears in the widget
- **THEN** the image occupies approximately half the card's height, rather than a small fixed
  band, with the remaining half showing the title and body preview
