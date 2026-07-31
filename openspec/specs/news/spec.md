# news Specification

## Purpose
TBD - created by archiving change news-feature. Update Purpose after archive.
## Requirements
### Requirement: Published news are listable by any authenticated user
The system SHALL expose `GET /api/coach/news` returning a paginated list of news items with `Status = Published`, each including a required `NewsDate` distinct from `PublishedAt`, sorted by `NewsDate` ascending, accessible to any authenticated role.

#### Scenario: Familia lists published news
- **WHEN** an authenticated user with role FamilyMember calls `GET /api/coach/news?pageNumber=1&pageSize=20`
- **THEN** the system returns `200 OK` with only Published news items, each including `newsDate`, and an `X-Total-Count` header

#### Scenario: Draft items never appear in the public list
- **WHEN** any authenticated user calls `GET /api/coach/news`
- **THEN** no item with `Status = Draft` is present in the response

#### Scenario: List is ordered by news date, not publish date
- **WHEN** an authenticated user calls `GET /api/coach/news` and item A has `NewsDate` earlier than item B, regardless of which was published first
- **THEN** item A appears before item B in the response

### Requirement: Draft news are listable only by Coach or Administrator
The system SHALL expose `GET /api/coach/news/drafts` returning a paginated list of news items with `Status = Draft`, sorted by `CreatedAt` descending, restricted to roles Coach and Administrator.

#### Scenario: Coach lists own drafts
- **WHEN** an authenticated user with role Coach calls `GET /api/coach/news/drafts`
- **THEN** the system returns `200 OK` with only Draft news items

#### Scenario: Familia is forbidden from listing drafts
- **WHEN** an authenticated user with role FamilyMember or Player calls `GET /api/coach/news/drafts`
- **THEN** the system returns `403 Forbidden`

### Requirement: News detail visibility depends on status and role
The system SHALL expose `GET /api/coach/news/{id}` returning the full news item. Published items SHALL be visible to any authenticated user. Draft items SHALL be visible only to Coach or Administrator; for all other callers the system SHALL return `404 Not Found` rather than revealing the draft's existence.

#### Scenario: Any user views a published news item
- **WHEN** an authenticated user calls `GET /api/coach/news/{id}` for an item with `Status = Published`
- **THEN** the system returns `200 OK` with the full news detail

#### Scenario: Coach views a draft news item
- **WHEN** an authenticated user with role Coach calls `GET /api/coach/news/{id}` for an item with `Status = Draft`
- **THEN** the system returns `200 OK` with the full news detail

#### Scenario: Familia cannot see a draft, even by direct id
- **WHEN** an authenticated user with role FamilyMember calls `GET /api/coach/news/{id}` for an item with `Status = Draft`
- **THEN** the system returns `404 Not Found`

#### Scenario: Unknown id
- **WHEN** any authenticated user calls `GET /api/coach/news/{id}` for a non-existent id
- **THEN** the system returns `404 Not Found`

### Requirement: Only Coach or Administrator can create news
The system SHALL expose `POST /api/coach/news`, restricted to roles Coach and Administrator, accepting title, subtitle, body, a required cover image URL, a required `NewsDate`, and a status of Draft or Published. When status is Published, the system SHALL set `PublishedAt` to the current timestamp at creation time; `NewsDate` is independent of `PublishedAt` and is never auto-set.

#### Scenario: Coach creates a draft
- **WHEN** an authenticated Coach submits `POST /api/coach/news` with `status = "Draft"` and valid fields including `newsDate`
- **THEN** the system returns `201 Created` with the new item's id, and the stored item has `Status = Draft`, `PublishedAt = null`, and the submitted `NewsDate`

#### Scenario: Administrator creates and publishes directly
- **WHEN** an authenticated Administrator submits `POST /api/coach/news` with `status = "Published"` and valid fields including `newsDate`
- **THEN** the system returns `201 Created`, and the stored item has `Status = Published`, `PublishedAt` set to the creation time, and `NewsDate` set to the submitted value

#### Scenario: Missing required cover image is rejected
- **WHEN** an authenticated Coach submits `POST /api/coach/news` without `coverImageUrl`
- **THEN** the system returns `400 Bad Request` as a `ProblemDetails` response

#### Scenario: Missing required news date is rejected
- **WHEN** an authenticated Coach submits `POST /api/coach/news` without `newsDate`
- **THEN** the system returns `400 Bad Request` as a `ProblemDetails` response

#### Scenario: Non-coach role is forbidden from creating news
- **WHEN** an authenticated user with role FamilyMember or Player submits `POST /api/coach/news`
- **THEN** the system returns `403 Forbidden`

### Requirement: Only Coach or Administrator can edit news, on draft or published items
The system SHALL expose `PUT /api/coach/news/{id}`, restricted to roles Coach and Administrator, allowing edits to title, subtitle, body, cover image URL, and `NewsDate` (required) regardless of whether the item is currently Draft or Published. Editing SHALL NOT change `Status` or `PublishedAt`.

#### Scenario: Coach edits a draft
- **WHEN** an authenticated Coach submits `PUT /api/coach/news/{id}` for a Draft item with valid fields including `newsDate`
- **THEN** the system returns `204 No Content` and the item's fields, including `NewsDate`, are updated while `Status` remains Draft

#### Scenario: Coach edits an already-published item
- **WHEN** an authenticated Coach submits `PUT /api/coach/news/{id}` for a Published item with valid fields including `newsDate`
- **THEN** the system returns `204 No Content`, the item's fields including `NewsDate` are updated, and `Status`/`PublishedAt` remain unchanged

#### Scenario: Editing a non-existent item
- **WHEN** an authenticated Coach submits `PUT /api/coach/news/{id}` for an id that does not exist
- **THEN** the system returns `404 Not Found`

#### Scenario: Missing required news date is rejected
- **WHEN** an authenticated Coach submits `PUT /api/coach/news/{id}` without `newsDate`
- **THEN** the system returns `400 Bad Request` as a `ProblemDetails` response

### Requirement: Only Coach or Administrator can publish a draft
The system SHALL expose `POST /api/coach/news/{id}/publish`, restricted to roles Coach and Administrator, transitioning a Draft item to Published and setting `PublishedAt` to the current timestamp. Publishing an already-Published item SHALL fail.

#### Scenario: Coach publishes a draft
- **WHEN** an authenticated Coach calls `POST /api/coach/news/{id}/publish` for a Draft item
- **THEN** the system returns `200 OK` with the updated item, `Status = Published`, and `PublishedAt` set to the current timestamp

#### Scenario: Publishing an already-published item fails
- **WHEN** an authenticated Coach calls `POST /api/coach/news/{id}/publish` for an item that is already Published
- **THEN** the system returns `409 Conflict`

### Requirement: Only Coach or Administrator can delete news
The system SHALL expose `DELETE /api/coach/news/{id}`, restricted to roles Coach and Administrator, allowed on items in either Draft or Published status.

#### Scenario: Coach deletes a draft
- **WHEN** an authenticated Coach calls `DELETE /api/coach/news/{id}` for a Draft item
- **THEN** the system returns `204 No Content` and the item no longer appears in any listing

#### Scenario: Coach deletes a published item
- **WHEN** an authenticated Coach calls `DELETE /api/coach/news/{id}` for a Published item
- **THEN** the system returns `204 No Content` and the item no longer appears in any listing

#### Scenario: Non-coach role is forbidden from deleting news
- **WHEN** an authenticated user with role FamilyMember or Player calls `DELETE /api/coach/news/{id}`
- **THEN** the system returns `403 Forbidden`

### Requirement: Cover image upload for news
The system SHALL expose `POST /api/coach/news/image`, restricted to roles Coach and Administrator, accepting a multipart file upload and returning the stored image's URL using the existing storage abstraction (local filesystem or Supabase, per `Storage:UseLocal` configuration).

#### Scenario: Coach uploads a valid cover image
- **WHEN** an authenticated Coach submits `POST /api/coach/news/image` with a valid image file
- **THEN** the system returns `200 OK` with a JSON body containing the uploaded image's `url`

#### Scenario: Missing file is rejected
- **WHEN** an authenticated Coach submits `POST /api/coach/news/image` without a file
- **THEN** the system returns `400 Bad Request`

