## ADDED Requirements

### Requirement: Published news are shown as a newspaper-style feed to every authenticated user
The Mobile app SHALL render `NewsScreen` as a feed of cards (large cover photo + headline) for every `Published` news item returned by `GET /api/coach/news`, visible to any authenticated role.

#### Scenario: Familia opens the Noticias tab
- **WHEN** an authenticated user with role FamilyMember opens `NewsTab`
- **THEN** the screen shows a card per published news item, with cover photo and title, and no draft items

#### Scenario: Feed is empty
- **WHEN** `GET /api/coach/news` returns no items
- **THEN** the screen shows an empty state instead of an empty list

### Requirement: Coach or Administrator additionally see their own drafts in the feed, visually marked
When the authenticated user has role Coach or Administrator, `NewsScreen` SHALL also fetch `GET /api/coach/news/drafts` and render those items in the same feed, each visually tagged as a draft (e.g. "Borrador" badge), positioned above the published items.

#### Scenario: Coach sees drafts tagged in the feed
- **WHEN** an authenticated Coach opens `NewsTab` and has one draft and two published items
- **THEN** the screen shows all three cards, the draft card carries a visible "Borrador" indicator, and the draft appears before the published items

#### Scenario: Familia never triggers the drafts call
- **WHEN** an authenticated user with role FamilyMember or Player opens `NewsTab`
- **THEN** the app does not call `GET /api/coach/news/drafts`

#### Scenario: Drafts call fails without breaking the published feed
- **WHEN** an authenticated Coach opens `NewsTab` and `GET /api/coach/news/drafts` fails
- **THEN** the published items still render normally and no unhandled error is shown for the drafts portion

### Requirement: Tapping a news card opens a full detail screen
The Mobile app SHALL navigate to `NewsDetailScreen` when a feed card is tapped, fetching and rendering the full item (title, subtitle, cover photo, body, publish date) via `GET /api/coach/news/{id}`.

#### Scenario: Any user opens a published item's detail
- **WHEN** an authenticated user taps a published news card
- **THEN** `NewsDetailScreen` shows the title, subtitle, cover photo, full body, and publish date

#### Scenario: Coach opens a draft's detail from the feed
- **WHEN** an authenticated Coach taps their own draft card
- **THEN** `NewsDetailScreen` shows the full draft content

### Requirement: Only Coach or Administrator can create news from Mobile
`NewsScreen` SHALL show a floating action button (FAB) only when the authenticated user has role Coach or Administrator; tapping it SHALL open `NewsFormScreen` in create mode, offering a choice to save as Draft or Publish, and submitting via `POST /api/coach/news` (after uploading the cover photo via `POST /api/coach/news/image` first).

#### Scenario: FAB is hidden for non-coach roles
- **WHEN** an authenticated user with role FamilyMember or Player opens `NewsTab`
- **THEN** no FAB is rendered on `NewsScreen`

#### Scenario: Coach creates and publishes directly
- **WHEN** an authenticated Coach fills the creation form, picks a cover photo, and chooses "Publicar"
- **THEN** the app uploads the photo, then submits `POST /api/coach/news` with `status = "Published"`, and navigates to the new item's detail on success

#### Scenario: Coach saves as draft
- **WHEN** an authenticated Coach fills the creation form and chooses "Guardar borrador"
- **THEN** the app submits `POST /api/coach/news` with `status = "Draft"`

### Requirement: Only Coach or Administrator can edit or delete news from Mobile, on draft or published items
`NewsDetailScreen` SHALL show Editar and Eliminar actions only when the authenticated user has role Coach or Administrator, on items in either Draft or Published status. Editar SHALL open `NewsFormScreen` in edit mode (no status control) submitting via `PUT /api/coach/news/{id}`. Eliminar SHALL confirm before calling `DELETE /api/coach/news/{id}` and return to the feed on success.

#### Scenario: Editar/Eliminar hidden for non-coach roles
- **WHEN** an authenticated user with role FamilyMember or Player opens any news item's detail
- **THEN** no Editar or Eliminar action is rendered

#### Scenario: Coach edits a published item
- **WHEN** an authenticated Coach opens Editar on a Published item, changes the body, and submits
- **THEN** the app submits `PUT /api/coach/news/{id}` with the updated fields and does not send or alter `status`

#### Scenario: Coach deletes a draft
- **WHEN** an authenticated Coach confirms Eliminar on a Draft item
- **THEN** the app calls `DELETE /api/coach/news/{id}` and navigates back to the feed on success

### Requirement: Cover photo uses a two-step pick-upload-then-reference flow in the creation/edit form
`NewsFormScreen` SHALL upload the picked cover photo via `POST /api/coach/news/image` before submitting the create/edit command, and SHALL submit the returned `url` (never a local file URI) as `coverImageUrl`.

#### Scenario: Photo is uploaded before the news item is created
- **WHEN** an authenticated Coach picks a cover photo and submits the creation form
- **THEN** the app calls `POST /api/coach/news/image` first, waits for the resulting `url`, and only then calls `POST /api/coach/news` with that `url` as `coverImageUrl`
