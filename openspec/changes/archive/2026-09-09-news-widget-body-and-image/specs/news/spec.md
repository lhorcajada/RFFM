## MODIFIED Requirements

### Requirement: Published news are listable by any authenticated user
The system SHALL expose `GET /api/coach/news` returning a paginated list of news items with `Status = Published`, each including a required `NewsDate` distinct from `PublishedAt` and the full `Body` text, sorted by `NewsDate` ascending, accessible to any authenticated role.

#### Scenario: Familia lists published news
- **WHEN** an authenticated user with role FamilyMember calls `GET /api/coach/news?pageNumber=1&pageSize=20`
- **THEN** the system returns `200 OK` with only Published news items, each including `newsDate` and `body`, and an `X-Total-Count` header

#### Scenario: Draft items never appear in the public list
- **WHEN** any authenticated user calls `GET /api/coach/news`
- **THEN** no item with `Status = Draft` is present in the response

#### Scenario: List is ordered by news date, not publish date
- **WHEN** an authenticated user calls `GET /api/coach/news` and item A has `NewsDate` earlier than item B, regardless of which was published first
- **THEN** item A appears before item B in the response

### Requirement: Draft news are listable only by Coach or Administrator
The system SHALL expose `GET /api/coach/news/drafts` returning a paginated list of news items with `Status = Draft`, each including the full `Body` text, sorted by `CreatedAt` descending, restricted to roles Coach and Administrator.

#### Scenario: Coach lists own drafts
- **WHEN** an authenticated user with role Coach calls `GET /api/coach/news/drafts`
- **THEN** the system returns `200 OK` with only Draft news items, each including `body`

#### Scenario: Familia is forbidden from listing drafts
- **WHEN** an authenticated user with role FamilyMember or Player calls `GET /api/coach/news/drafts`
- **THEN** the system returns `403 Forbidden`
