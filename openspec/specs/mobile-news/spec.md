# mobile-news Specification

## Purpose
TBD - created by archiving change news-feature. Update Purpose after archive.
## Requirements
### Requirement: Published news are shown as a newspaper-style feed to every authenticated user
The Mobile app SHALL render `NewsScreen` as a feed grouped by `newsDate` (not by publish order) into two root groups: **Anteriores** (`newsDate` earlier than today, subgrouped by month descending) and **Actuales y futuras** (`newsDate` today or later, subgrouped as "Hoy" first, then by month ascending). All groups and subgroups SHALL start collapsed, except the "Actuales y futuras" root group and its "Hoy" subgroup, which SHALL start expanded. Each collapsible header SHALL be toggleable independently.

#### Scenario: Familia opens the Noticias tab
- **WHEN** an authenticated user with role FamilyMember opens `NewsTab` with only current/future published news
- **THEN** the screen shows the "Actuales y futuras" group expanded with its subgroups, and no draft items

#### Scenario: Today's news appears first within current/future
- **WHEN** the feed contains a published item with `newsDate` equal to today and other items with future `newsDate`
- **THEN** the "Hoy" subgroup renders expanded above the other current/future month subgroups, which start collapsed

#### Scenario: Past news is grouped separately and collapsed by default
- **WHEN** the feed contains published items with `newsDate` earlier than today
- **THEN** those items render under the "Anteriores" root group, subgrouped by month descending, collapsed by default

#### Scenario: Feed is empty
- **WHEN** `GET /api/coach/news` returns no items
- **THEN** the screen shows an empty state instead of an empty list

### Requirement: Coach or Administrator additionally see their own drafts in the feed, visually marked
When the authenticated user has role Coach or Administrator, `NewsScreen` SHALL also fetch `GET /api/coach/news/drafts` and merge those items into the same date-based grouping as published items (by their own `newsDate`), each visually tagged as a draft (e.g. "Borrador" badge).

#### Scenario: Coach sees drafts tagged and grouped by their news date
- **WHEN** an authenticated Coach opens `NewsTab` and has one draft with a future `newsDate` and two published items
- **THEN** the draft card carries a visible "Borrador" indicator and appears within the group/subgroup matching its own `newsDate`, not necessarily first

#### Scenario: Familia never triggers the drafts call
- **WHEN** an authenticated user with role FamilyMember or Player opens `NewsTab`
- **THEN** the app does not call `GET /api/coach/news/drafts`

#### Scenario: Drafts call fails without breaking the published feed
- **WHEN** an authenticated Coach opens `NewsTab` and `GET /api/coach/news/drafts` fails
- **THEN** the published items still render normally, grouped by date, and no unhandled error is shown for the drafts portion

### Requirement: Tapping a news card opens a full detail screen
The Mobile app SHALL navigate to `NewsDetailScreen` when a feed card is tapped, fetching and rendering the full item (title, subtitle, cover photo, body, publish date, and news date) via `GET /api/coach/news/{id}`.

#### Scenario: Any user opens a published item's detail
- **WHEN** an authenticated user taps a published news card
- **THEN** `NewsDetailScreen` shows the title, subtitle, cover photo, full body, publish date, and news date formatted as e.g. "Jueves 30 de julio de 2026"

#### Scenario: Coach opens a draft's detail from the feed
- **WHEN** an authenticated Coach taps their own draft card
- **THEN** `NewsDetailScreen` shows the full draft content including its news date

### Requirement: Only Coach or Administrator can create news from Mobile
`NewsScreen` SHALL show a floating action button (FAB) only when the authenticated user has role Coach or Administrator; tapping it SHALL open `NewsFormScreen` in create mode, requiring a news date in addition to the existing fields, offering a choice to save as Draft or Publish, and submitting via `POST /api/coach/news` (after uploading the cover photo via `POST /api/coach/news/image` first).

#### Scenario: FAB is hidden for non-coach roles
- **WHEN** an authenticated user with role FamilyMember or Player opens `NewsTab`
- **THEN** no FAB is rendered on `NewsScreen`

#### Scenario: Coach creates and publishes directly
- **WHEN** an authenticated Coach fills the creation form, picks a cover photo, sets a news date, and chooses "Publicar"
- **THEN** the app uploads the photo, then submits `POST /api/coach/news` with `status = "Published"` and the chosen `newsDate`, and navigates to the new item's detail on success

#### Scenario: Coach saves as draft
- **WHEN** an authenticated Coach fills the creation form and chooses "Guardar borrador"
- **THEN** the app submits `POST /api/coach/news` with `status = "Draft"` and the chosen `newsDate`

#### Scenario: Missing news date blocks submission
- **WHEN** an authenticated Coach attempts to submit the creation form without selecting a news date
- **THEN** the app shows a validation message and does not call `POST /api/coach/news`

### Requirement: Only Coach or Administrator can edit or delete news from Mobile, on draft or published items
`NewsDetailScreen` SHALL show Editar and Eliminar actions only when the authenticated user has role Coach or Administrator, on items in either Draft or Published status. Editar SHALL open `NewsFormScreen` in edit mode (no status control, news date pre-filled and editable) submitting via `PUT /api/coach/news/{id}`. Eliminar SHALL confirm before calling `DELETE /api/coach/news/{id}` and return to the feed on success.

#### Scenario: Editar/Eliminar hidden for non-coach roles
- **WHEN** an authenticated user with role FamilyMember or Player opens any news item's detail
- **THEN** no Editar or Eliminar action is rendered

#### Scenario: Coach edits a published item's news date
- **WHEN** an authenticated Coach opens Editar on a Published item, changes the news date, and submits
- **THEN** the app submits `PUT /api/coach/news/{id}` with the updated `newsDate` and does not send or alter `status`

#### Scenario: Coach deletes a draft
- **WHEN** an authenticated Coach confirms Eliminar on a Draft item
- **THEN** the app calls `DELETE /api/coach/news/{id}` and navigates back to the feed on success

### Requirement: Cover photo uses a two-step pick-upload-then-reference flow in the creation/edit form
`NewsFormScreen` SHALL upload the picked cover photo via `POST /api/coach/news/image` before submitting the create/edit command, and SHALL submit the returned `url` (never a local file URI) as `coverImageUrl`.

#### Scenario: Photo is uploaded before the news item is created
- **WHEN** an authenticated Coach picks a cover photo and submits the creation form
- **THEN** the app calls `POST /api/coach/news/image` first, waits for the resulting `url`, and only then calls `POST /api/coach/news` with that `url` as `coverImageUrl`

