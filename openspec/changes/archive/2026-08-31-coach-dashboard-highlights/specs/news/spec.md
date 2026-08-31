## ADDED Requirements

### Requirement: Only Coach or Administrator can unpublish news
The system SHALL expose `POST /api/coach/news/{id}/unpublish`, restricted to roles Coach and
Administrator, transitioning a Published item back to Draft and clearing `PublishedAt`.
Unpublishing an already-Draft item SHALL fail.

#### Scenario: Coach unpublishes a published item
- **WHEN** an authenticated Coach calls `POST /api/coach/news/{id}/unpublish` for a Published item
- **THEN** the system returns `200 OK` with the updated item, `Status = Draft`, and
  `PublishedAt = null`

#### Scenario: Unpublishing an already-draft item fails
- **WHEN** an authenticated Coach calls `POST /api/coach/news/{id}/unpublish` for an item that is
  already Draft
- **THEN** the system returns `409 Conflict`

#### Scenario: Unpublished item disappears from the public list
- **WHEN** a Published item is unpublished
- **THEN** it no longer appears in `GET /api/coach/news` for any role

#### Scenario: Non-coach role is forbidden from unpublishing
- **WHEN** an authenticated user with role FamilyMember or Player calls
  `POST /api/coach/news/{id}/unpublish`
- **THEN** the system returns `403 Forbidden`

#### Scenario: Unknown id
- **WHEN** an authenticated Coach calls `POST /api/coach/news/{id}/unpublish` for a non-existent id
- **THEN** the system returns `404 Not Found`

### Requirement: News management page for the Coach app

The system SHALL provide a `News` page (`/coach/news`) reachable by any role with access to the
`News` feature route, showing the published news list to every such role, with an additional
create/edit/publish/unpublish/delete management surface shown only when the caller holds the
Coach or Administrator role. Each list item SHALL link to a read-only detail page
(`/coach/news/:id`).

#### Scenario: Player/FamilyMember sees a read-only published list
- **WHEN** an authenticated Player or FamilyMember with access to the `News` feature route opens
  `/coach/news`
- **THEN** the system shows the published news list with no create, edit, publish, unpublish, or
  delete controls, and no drafts tab

#### Scenario: Coach sees management controls
- **WHEN** an authenticated Coach or Administrator opens `/coach/news`
- **THEN** the system shows the published list, a Published/Drafts tab switcher, a "Nueva
  noticia" action, and per-item edit/publish/unpublish/delete actions matching each item's
  current status

#### Scenario: Detail page renders one article
- **WHEN** any authenticated user with access to the `News` feature route opens
  `/coach/news/{id}` for a Published item
- **THEN** the system renders that item's title, subtitle, body, cover image, and date, with a
  link back to the news list

#### Scenario: Draft detail is not reachable by non-coach roles
- **WHEN** a Player/FamilyMember opens `/coach/news/{id}` for an item that is currently Draft
- **THEN** the system shows a not-found state, mirroring the backend's `GetNewsById` Draft
  visibility rule
