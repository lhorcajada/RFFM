## Context

`NewsItem` (`Back/ExtractionApi/src/RFFM.Api/Domain/Entities/News/NewsItem.cs`) is a flat
entity with a `NewsStatus` `SmartEnum` (`Ardalis.SmartEnum`, auto-converted to/from the DB via
`modelBuilder.ConfigureSmartEnum()` in `AppDbContext` — no explicit `HasConversion` needed per
property, see `NewsItemEntityConfiguration.cs`). `CreateNews`/`UpdateNews` are `IFeatureModule`
Minimal-API slices using `IRequestHandler` directly over `AppDbContext` (not the CQRS
`ICommand`/`IQueryApp` abstractions used elsewhere in the repo — News predates/diverges from
that convention, so this change follows News's own existing style rather than introducing a
new one mid-feature).

For the external-URL case, `AttendanceEvent.tsx` already renders exactly this pattern for a
match's `locationMapUrl` (Google Maps link): `<a href={url} target="_blank" rel="noopener
noreferrer">`. This change reuses that exact pattern rather than inventing a new one.

For the internal match-link case, the destination is **not**
`ConvocationMatchDetail`/`/coach/convocations/match` — that route is gated
`allowPlayerAccess={false}` (`routes.tsx`), i.e. Coach-only, so a news reader who is a
Player/FamilyMember would hit a 403/blocked screen. The correct destination, reachable by
every role that can read news, is the "Ver convocatoria" popup already present on
`AttendanceEvent.tsx` (`/coach/attendance/:id`, gated only by `COACH_FEATURE_ROUTES.Events`,
no `allowPlayerAccess` restriction): it opens `ConvocationDetailsDialog` — the same read-only
convocation view — when the coach/reader clicks its existing "Ver convocatoria" button
(gated on `isMatchOrFriendly && convocationConfirmed`). This change adds a `?viewConvocation=1`
query param to that page so navigating there from a news item opens the dialog automatically
instead of requiring a second click, reusing the exact same dialog/data-fetching path (no new
endpoint, no new dialog).

## Goals / Non-Goals

**Goals:**
- A news item has at most one link: none, a match convocation, or an external URL.
- The match-convocation destination must be reachable by every role allowed to read news
  (Coach, Player, FamilyMember) — not just Coach — so it targets `AttendanceEvent`'s
  "Ver convocatoria" popup (`/coach/attendance/:id`), not the Coach-only
  `ConvocationMatchDetail` screen.
- Reuse the existing `AttendanceEvent` external-link rendering pattern (`locationMapUrl`'s
  `target="_blank"` anchor) for the external-URL case — no new link-opening mechanism there.
- Broken/inaccessible match links degrade gracefully (hidden action, not a dead click).
- External URLs are validated for well-formed `http(s)` shape at save time only — no
  reachability check (out of scope, no network call from the backend).

**Non-Goals:**
- Editing/removing the link independently of the rest of the news item — it's just another
  field on `CreateNews`/`UpdateNews`, saved together with title/body/etc.
- Supporting link types beyond "match convocation" and "arbitrary external URL" (e.g. deep
  links to other in-app screens like a player profile) — can be added later by extending
  `NewsLinkType`, not designed here.
- Any change to `ConvocationMatchDetail`'s own contract, or to the Federación app.

## Decisions

### 1. `NewsLinkType` smart enum + three nullable columns on `NewsItem`
Mirrors `NewsStatus`'s exact shape (`Domain/Entities/News/NewsLinkType.cs`):

```csharp
public sealed class NewsLinkType : SmartEnum<NewsLinkType>
{
    public static readonly NewsLinkType None = new(nameof(None), 1);
    public static readonly NewsLinkType MatchConvocation = new(nameof(MatchConvocation), 2);
    public static readonly NewsLinkType External = new(nameof(External), 3);

    private NewsLinkType(string name, int value) : base(name, value) { }

    public static bool TryParseName(string? name, out NewsLinkType? type) { /* same pattern as NewsStatus.TryParseName */ }
}
```

`NewsItem` gains:
```csharp
public NewsLinkType LinkType { get; private set; } = NewsLinkType.None;
public string? LinkedEventId { get; private set; }   // set iff LinkType == MatchConvocation — the only id AttendanceEvent's route needs
public string? LinkedTeamId { get; private set; }     // set iff LinkType == MatchConvocation — not needed by the destination route itself, kept so the coach's team+match picker (`getSportEvents(teamId)`) can be re-populated when editing an existing linked news item
public string? LinkUrl { get; private set; }           // set iff LinkType == External
```

Alternative considered: a single `LinkValue` string column reused for both the event id and
the URL, disambiguated by `LinkType`. Rejected — `MatchConvocation` needs *two* values
(`eventId` + `teamId`) to build a correct deep link, so a single shared string column doesn't
fit either case cleanly; three narrow, self-explanatory nullable columns are simpler to read
and query (e.g. filter "news items pointing at team X") than packing two values into one
column with a delimiter.

`Create`/`UpdateContent` gain the link fields as parameters with the invariant enforced in the
factory/mutator (not a separate `SetLink` method, since the acceptance criteria treat the link
as part of one atomic save, same as title/body today):
```csharp
public static NewsItem Create(string title, string subtitle, string body, string coverImageUrl,
    NewsStatus status, DateTime newsDate,
    NewsLinkType linkType, string? linkedEventId, string? linkedTeamId, string? linkUrl)
{
    // existing validations...
    ValidateLink(linkType, linkedEventId, linkedTeamId, linkUrl); // throws ArgumentException, same style as other guards
    ...
}

private static void ValidateLink(NewsLinkType linkType, string? eventId, string? teamId, string? url)
{
    if (linkType == NewsLinkType.MatchConvocation && (string.IsNullOrWhiteSpace(eventId) || string.IsNullOrWhiteSpace(teamId)))
        throw new ArgumentException("El partido enlazado es obligatorio para este tipo de enlace.");
    if (linkType == NewsLinkType.External && string.IsNullOrWhiteSpace(url))
        throw new ArgumentException("La URL es obligatoria para este tipo de enlace.");
}
```
(URL shape validation — `http`/`https` scheme — lives in `CreateNewsValidator`/
`UpdateNewsValidator` via FluentValidation, not in the domain guard, matching how the rest of
`NewsItem`'s field-shape checks are split: domain guards check "is this required given the
state", FluentValidation checks "is this well-formed"; see §5.)

### 2. Command/response shape — flat fields, not a nested DTO
`CreateNewsCommand`/`UpdateNewsCommand` add:
```csharp
string LinkType,          // "None" | "MatchConvocation" | "External" — same string-enum style as existing `Status`
string? LinkedEventId,
string? LinkedTeamId,
string? LinkUrl
```
`NewsSummaryResponse`/`NewsDetailResponse` add the same four fields (always present, `null`
where not applicable) so the frontend can render the "Ver convocatoria"/external-link action
straight from the list/detail response without a second call.

Alternative considered: a nested `{ type, eventId, teamId, url }` object. Rejected for
consistency with the existing flat, non-nested `NewsSummaryResponse`/`NewsDetailResponse`
records and `CreateNewsCommand`/`UpdateNewsCommand` — introducing the first nested shape in
this feature for one optional field isn't worth the inconsistency.

### 3. Validation (FluentValidation, `CreateNewsValidator`/`UpdateNewsValidator`)
```csharp
RuleFor(x => x.LinkType).Must(t => t is "None" or "MatchConvocation" or "External")
    .WithMessage("LinkType must be None, MatchConvocation or External.");
When(x => x.LinkType == "MatchConvocation", () =>
{
    RuleFor(x => x.LinkedEventId).NotEmpty();
    RuleFor(x => x.LinkedTeamId).NotEmpty();
});
When(x => x.LinkType == "External", () =>
{
    RuleFor(x => x.LinkUrl).NotEmpty()
        .Must(u => Uri.TryCreate(u, UriKind.Absolute, out var uri) && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps))
        .WithMessage("La URL debe ser una dirección http(s) válida.");
});
```
No existence check on `LinkedEventId` against `SportEvents` at write time (would require a
cross-aggregate lookup in the News feature purely to validate a foreign reference that already
degrades gracefully at read time per Decision 4) — consistent with the acceptance criterion
that a since-deleted match should hide the action rather than block the save.

### 4. Graceful degradation for a stale/inaccessible match link
`GetNewsByIdHandler`/`GetNewsHandler` do **not** resolve/validate `LinkedEventId` server-side
(no join to `SportEvents`, no per-reader authorization check against the match) — the response
always echoes back whatever `LinkType`/`LinkedEventId`/`LinkedTeamId` is stored. The frontend
is what actually degrades gracefully: `NewsDetail`/`NewsListCard` navigate to
`/coach/attendance/{linkedEventId}?viewConvocation=1`, and `AttendanceEvent` **already**
handles an unresolvable event today (its existing `getSportEventById` fetch resolves to
`null` → existing "event not found" state on that screen) and is reachable by every role that
can read news (`COACH_FEATURE_ROUTES.Events`, no Coach-only restriction) — reusing behavior
that already exists rather than duplicating a match-existence check inside the News feature.
The `?viewConvocation=1` auto-open is itself gated on `isMatchOrFriendly && convocationConfirmed`
(the same condition that shows the manual "Ver convocatoria" button), so a link to a match
whose convocation isn't confirmed yet simply lands the reader on the event page without
forcing an empty/half-populated dialog open — not a crash, but also not a guaranteed dialog on
every click; accepted as consistent with what a Coach manually visiting that page would see.

Alternative considered: have the backend resolve and validate the link server-side (hide it in
the response if the match is gone/unauthorized for that specific reader). Rejected — News
responses are cached per role-agnostic content (`GetNews`'s `ICacheRequest`, published-only,
same response for every reader), so per-reader authorization can't be baked into a cached
response anyway; the per-reader check (and the confirmed/pending check) has to happen at
click-time, which `AttendanceEvent` already does.

### 5. Frontend: link-kind selector in `NewsFormDialog`, clickable action in list/detail
`NewsFormDialog.tsx` gains a `Select` "Enlace" control with three states mirroring
`NewsLinkType`:
- **Ninguno** (default) — no extra fields.
- **Convocatoria de partido** — a team `Select` (`useUserTeams()`, the same hook the Coach
  Dashboard uses to list every team across the coach's clubs) then a match `Select` populated
  via `getSportEvents(teamId, 1, 200)` (`services/sportEventService.ts`, existing), **filtered
  to actual matches** (`ev.matchCategory` present, or the legacy `eventTypeId === 1` /
  `eventType` contains "partido" heuristic — same filter `useConvocations.ts` already applies)
  so trainings and other calendar entries never appear as choices, labeled
  `"{Liga|Amistoso|Torneo} · {fecha} · vs {rival}"` (`event.rivalName ?? event.rival`,
  `normalizeDateStr` from `convocationUtils.ts`) instead of the event's raw `title`/`name`
  (which, for calendar-synced fixtures, is often indistinguishable from the rival's name alone
  and gives the coach no way to tell matches apart).
- **Enlace externo** — a single `TextField` for the URL, client-side `http(s)` shape check
  mirroring the backend rule (defense in depth, not the source of truth).

`newsService.ts`'s `NewsPayload`/`NewsSummaryDto`/`NewsDetailDto` gain the four fields
(`linkType: "None" | "MatchConvocation" | "External"`, `linkedEventId`, `linkedTeamId`,
`linkUrl`), passed through verbatim to `createNews`/`updateNews`.

Rendering — both `NewsDetail.tsx` and `NewsListCard.tsx` render an actual clickable action (not
just an indicator):
- **`NewsDetail.tsx`**: `linkType === "MatchConvocation"` → a `Button` whose `onClick` calls
  `navigate(`/coach/attendance/${linkedEventId}?viewConvocation=1`)`; `linkType === "External"`
  → `<a href={linkUrl} target="_blank" rel="noopener noreferrer">`, same pattern as
  `AttendanceEvent.tsx`'s own `locationMapUrl` rendering.
- **`NewsListCard.tsx`**: its root element is already a `react-router` `<Link>` to
  `/coach/news/:id`, so nesting a real `<a>`/`<Link>` inside it would be invalid HTML and would
  fight the outer navigation on click. Resolved by rendering the badge as a MUI `Chip` with
  `clickable` + `onClick` that calls `e.preventDefault(); e.stopPropagation();` before
  navigating (`navigate(...)` for the match case, `window.open(linkUrl, "_blank",
  "noopener,noreferrer")` for the external case) — a `<div>`-based interactive element, not a
  nested anchor, so it stays valid HTML while still taking the reader straight to the link
  target instead of the news detail. (Earlier revision of this design had the list-card badge
  as a non-interactive indicator only, with the real action living solely on `NewsDetail`; this
  was corrected after review — readers expect the visible link/badge on the card to actually go
  where it says.)

## Risks / Trade-offs

- [No server-side existence/authorization check on `LinkedEventId`] → Accepted, documented in
  Decision 4; relies entirely on `AttendanceEvent`'s existing graceful-degradation behavior at
  click-time.
- [`?viewConvocation=1` only auto-opens the dialog when the convocation is already confirmed]
  → Accepted, documented in Decision 4; a link to a match whose convocation isn't confirmed
  yet lands the reader on the event page (still useful — shows date/location/etc.) without a
  dialog, matching what a Coach manually visiting that page would see.
- [`LinkedTeamId` is stored but not used by the destination route] → Accepted; it's still
  needed at write-time so `NewsFormDialog` can re-populate the match picker
  (`getSportEvents(teamId)`) when editing an existing linked news item — dropping it would mean
  editing a linked news item couldn't show which match is currently selected without an extra
  lookup.

## Open Questions

None — scope, validation, degradation behavior, and rendering split (indicator on list, action
on detail) are all resolved above.
