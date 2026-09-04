## ADDED Requirements

### Requirement: News item has at most one link
`NewsItem` SHALL have a `LinkType` of exactly one of `None`, `MatchConvocation`, or `External`,
defaulting to `None`. `CreateNews`/`UpdateNews` SHALL accept `LinkType` plus the fields
relevant to it (`LinkedEventId`+`LinkedTeamId` for `MatchConvocation`, `LinkUrl` for
`External`) and SHALL reject a request whose extra fields don't match the declared `LinkType`.
`GetNews`/`GetNewsById` responses SHALL always include `linkType` and the (possibly null)
`linkedEventId`, `linkedTeamId`, `linkUrl` fields.

#### Scenario: Create a news item with no link
- **WHEN** a coach submits `CreateNews` with `LinkType = "None"`
- **THEN** the system creates the news item with no link fields set, and the response/subsequent reads show `linkType: "None"` and null link fields

#### Scenario: Existing news items are unaffected
- **WHEN** the system returns a news item created before this change existed
- **THEN** the response includes `linkType: "None"` and null link fields, and the item renders exactly as it did before

### Requirement: Link a news item to a match convocation
`CreateNews`/`UpdateNews` SHALL accept `LinkType = "MatchConvocation"` together with a
non-empty `LinkedEventId` and `LinkedTeamId`, identifying the match whose convocation the
reader should be taken to.

#### Scenario: Create a news item linked to a match
- **WHEN** a coach submits `CreateNews`/`UpdateNews` with `LinkType = "MatchConvocation"`, a `LinkedEventId`, and a `LinkedTeamId`
- **THEN** the system persists the news item with those values and returns them in subsequent reads

#### Scenario: Missing event or team id for a match link
- **WHEN** a coach submits `LinkType = "MatchConvocation"` with an empty `LinkedEventId` or `LinkedTeamId`
- **THEN** the system responds `400 Bad Request` with validation details and saves nothing

#### Scenario: Reader opens a news item linked to a match
- **WHEN** a reader views a news item with `LinkType = "MatchConvocation"` (from the news list card or the news detail page)
- **THEN** the reader is taken in-app to `/coach/attendance/{linkedEventId}?viewConvocation=1` — the same event screen and "Ver convocatoria" popup every role (Coach, Player, FamilyMember) can already reach, not the Coach-only convocation management screen

#### Scenario: Linked match no longer exists
- **WHEN** a reader is taken to the convocation link for a match that has since been deleted
- **THEN** the event screen shows its own existing not-found state — the news feature does not crash or show a broken link

#### Scenario: Linked match's convocation isn't confirmed yet
- **WHEN** a reader is taken to the convocation link for a match whose convocation is not yet fully confirmed (players still pending)
- **THEN** the reader lands on the event screen without the convocation popup auto-opening — the same behavior a Coach sees manually visiting that screen before confirmation is complete

### Requirement: Link a news item to an external URL
`CreateNews`/`UpdateNews` SHALL accept `LinkType = "External"` together with a non-empty
`LinkUrl` that is a well-formed absolute `http` or `https` URL.

#### Scenario: Create a news item linked to an external URL
- **WHEN** a coach submits `CreateNews`/`UpdateNews` with `LinkType = "External"` and a valid `http(s)` `LinkUrl` (e.g. a Google Maps link)
- **THEN** the system persists the news item with that URL and returns it in subsequent reads

#### Scenario: Missing or malformed external URL
- **WHEN** a coach submits `LinkType = "External"` with an empty `LinkUrl`, or one that is not a well-formed absolute `http`/`https` URL
- **THEN** the system responds `400 Bad Request` with validation details and saves nothing

#### Scenario: Reader opens a news item linked to an external URL
- **WHEN** a reader activates the link/badge on a news item with `LinkType = "External"` (from the news list card or the news detail page)
- **THEN** `LinkUrl` opens in a new browser tab, and — when activated from the list card — the reader is not also navigated to the news detail page
