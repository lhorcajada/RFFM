# Implement: add-news-link (backend + frontend)

Self-contained technical script. Follow it exactly; read every file listed in section 0 before
editing anything. Strict TDD: write the failing test, confirm it fails, then write the minimal
code to pass it, for every step below — do not batch implementation ahead of tests.

Repo root: `C:\Proyects\MisProyectos\FutbolBase`
Backend root: `Back/ExtractionApi` (commands in §1-5 assume this as cwd)
Frontend root: `Front` (commands in §6-9 assume this as cwd)

`design.md` in this change folder is the source of truth — if anything below conflicts with
it, `design.md` wins.

## 0. Read first (do not skip)

Backend:
1. `Back/ExtractionApi/src/RFFM.Api/Domain/Entities/News/NewsItem.cs` (entity to extend)
2. `Back/ExtractionApi/src/RFFM.Api/Domain/Entities/News/NewsStatus.cs` (SmartEnum pattern to
   mirror exactly for `NewsLinkType`)
3. `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/News/CreateNews.cs`,
   `UpdateNews.cs`, `GetNews.cs`, `GetNewsById.cs`, `GetNewsDrafts.cs` (every place
   `NewsSummaryResponse`/`NewsDetailResponse`/`CreateNewsCommand`/`UpdateNewsCommand` are
   built or projected — all must be updated together)
4. `Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/Configuration/Entities/NewsItemEntityConfiguration.cs`
5. `Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/AppDbContext.cs` — confirm
   `modelBuilder.ConfigureSmartEnum()` is present (it is, line ~156) so `NewsLinkType` needs no
   explicit `HasConversion`.
6. `Back/ExtractionApi/src/RFFM.Api/Domain/ErrorCodes.cs` (News section, ~line 92) — no new
   error codes needed for this change (validation failures use FluentValidation's standard
   400 path, not a domain `ConflictException`), confirm before adding any.
7. `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/CreateNewsHandlerTests.cs`,
   `UpdateNewsHandlerTests.cs`, `GetNewsHandlerTests.cs`, `GetNewsByIdHandlerTests.cs`,
   `NewsValidatorTests.cs` (existing test style/fixtures to extend)

Frontend:
8. `Front/src/apps/coach/services/newsService.ts` (DTOs/payload to extend)
9. `Front/src/apps/coach/services/sportEventService.ts` (`getSportEvents(teamId, ...)` —
   reused for the match picker, do not duplicate)
10. `Front/src/apps/coach/pages/news/components/NewsFormDialog.tsx` (form to extend)
11. `Front/src/apps/coach/pages/news/NewsDetail.tsx`,
    `Front/src/apps/coach/pages/news/components/NewsListCard.tsx` (rendering to extend)
12. `Front/src/apps/coach/pages/attendance/AttendanceEvent.tsx` — the `event.locationMapUrl`
    block (~line 327-344): copy this exact `<a target="_blank" rel="noopener noreferrer">`
    pattern for the external-link rendering, do not invent a new one.
13. `Front/src/apps/coach/pages/convocations/ConvocationMatchDetail.tsx` (lines ~40-70) —
    confirms `?eventId=&teamId=` is already a supported deep link; do not modify this file.
14. Any existing test files under `pages/news/components/__tests__/` and `pages/news/__tests__/`
    for the Testing Library conventions already in use (mocked `newsService`, `MemoryRouter`
    wrapping, etc.)

## 1. Domain

Create `Back/ExtractionApi/src/RFFM.Api/Domain/Entities/News/NewsLinkType.cs`:

```csharp
using Ardalis.SmartEnum;

namespace RFFM.Api.Domain.Entities.News
{
    public sealed class NewsLinkType : SmartEnum<NewsLinkType>
    {
        public static readonly NewsLinkType None = new(nameof(None), 1);
        public static readonly NewsLinkType MatchConvocation = new(nameof(MatchConvocation), 2);
        public static readonly NewsLinkType External = new(nameof(External), 3);

        private NewsLinkType(string name, int value) : base(name, value)
        {
        }

        public static bool TryParseName(string? name, out NewsLinkType? type)
        {
            type = null;
            if (string.IsNullOrWhiteSpace(name))
                return false;

            foreach (var candidate in List)
            {
                if (string.Equals(candidate.Name, name, System.StringComparison.OrdinalIgnoreCase))
                {
                    type = candidate;
                    return true;
                }
            }

            return false;
        }
    }
}
```

Extend `NewsItem.cs`:
- Add properties: `public NewsLinkType LinkType { get; private set; } = NewsLinkType.None;`,
  `public string? LinkedEventId { get; private set; }`,
  `public string? LinkedTeamId { get; private set; }`, `public string? LinkUrl { get; private set; }`.
- Add a private static `ValidateLink(NewsLinkType linkType, string? linkedEventId, string? linkedTeamId, string? linkUrl)`:
  throws `ArgumentException("El partido enlazado es obligatorio para este tipo de enlace.")` if
  `linkType == NewsLinkType.MatchConvocation` and either `linkedEventId` or `linkedTeamId` is
  null/whitespace; throws `ArgumentException("La URL es obligatoria para este tipo de enlace.")`
  if `linkType == NewsLinkType.External` and `linkUrl` is null/whitespace.
- Extend `Create(...)` signature to
  `Create(string title, string subtitle, string body, string coverImageUrl, NewsStatus status, DateTime newsDate, NewsLinkType linkType, string? linkedEventId, string? linkedTeamId, string? linkUrl)`,
  call `ValidateLink(...)` after the existing guards, and set the four new fields on the
  returned instance (trim `linkedEventId`/`linkedTeamId`/`linkUrl` when not null, same style as
  `Title.Trim()`).
- Extend `UpdateContent(...)` signature the same way (add the four link parameters), call
  `ValidateLink(...)`, and assign the fields.

Write `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/NewsItemTests.cs` FIRST (create the
file if it doesn't exist — check first). Red, then Green:
- `Create_WithLinkTypeNone_Succeeds_WithNullLinkFields`
- `Create_WithMatchConvocation_MissingEventId_Throws`
- `Create_WithMatchConvocation_MissingTeamId_Throws`
- `Create_WithMatchConvocation_ValidIds_StoresThem`
- `Create_WithExternal_MissingUrl_Throws`
- `Create_WithExternal_ValidUrl_StoresIt`
- `UpdateContent_ChangingLinkTypeToNone_ClearsLinkFields` (i.e. calling `UpdateContent` with
  `NewsLinkType.None` and null link args after the item previously had a link must null them
  out — confirm this is the intended behavior per `design.md`'s "one atomic save" framing, and
  implement `UpdateContent` to always overwrite all four fields from its parameters, never
  merge)
- `UpdateContent_WithMatchConvocation_MissingTeamId_Throws`

Run: `dotnet test --filter "FullyQualifiedName~NewsItemTests"` — confirm red before
implementing, green after.

## 2. Infrastructure

Update `NewsItemEntityConfiguration.cs`, inside `Configure`:
```csharp
builder.Property(n => n.LinkType).IsRequired();
builder.Property(n => n.LinkedEventId).HasMaxLength(50).IsRequired(false);
builder.Property(n => n.LinkedTeamId).HasMaxLength(50).IsRequired(false);
builder.Property(n => n.LinkUrl).HasMaxLength(2000).IsRequired(false);
```
(Check the actual max length already used for id-like string columns elsewhere in this file's
neighboring configurations — e.g. `BaseEntity.Id`'s convention — and match it instead of 50 if
it differs; do not invent a new id-length convention.)

Generate the migration from `Back/ExtractionApi`:
```
.\manage-migrations.ps1 -Action create -MigrationName AddNewsLink -Context AppDbContext
```
If that script/target differs from what `TeamNotes`'s migration used, mirror whatever command
succeeded for the most recent migration in `Infrastructure/Migrations/` instead. Inspect the
generated migration: it must add `LinkType` (`NOT NULL`, default acceptable to be the
provider's default int mapping for `NewsLinkType.None`'s value — confirm this by checking how
`Status` is defaulted, if at all, for existing rows; if `LinkType` needs an explicit
`DEFAULT_VALUE` for backfilling existing rows, add one so existing news items don't break), and
three nullable columns (`LinkedEventId`, `LinkedTeamId`, `LinkUrl`) to the `News` table.

## 3. Backend — write path (CreateNews / UpdateNews)

TDD, in order:

1. Extend `NewsValidatorTests.cs` FIRST with cases for `CreateNewsValidator`/
   `UpdateNewsValidator`: `LinkType` outside `{None, MatchConvocation, External}` is invalid;
   `MatchConvocation` with empty `LinkedEventId` or `LinkedTeamId` is invalid;
   `External` with empty `LinkUrl` is invalid; `External` with a non-`http(s)` URL (e.g.
   `"javascript:alert(1)"`, `"not a url"`) is invalid; `External` with a valid `https://...`
   URL is valid; `None` with all link fields empty is valid.
2. Extend `CreateNewsCommand`/`UpdateNewsCommand` records: add
   `string LinkType, string? LinkedEventId, string? LinkedTeamId, string? LinkUrl` (note:
   `CreateNewsCommand` is a positional record — add the new parameters at the end to avoid
   reordering existing positional args and breaking any existing callers/tests that construct
   it positionally; check `UpdateNewsCommand`'s existing `Id` property is set via `with` in the
   route handler — do the same for the frontend contract fields, keep them as constructor
   params).
3. Extend `CreateNewsValidator`/`UpdateNewsValidator`:
```csharp
RuleFor(x => x.LinkType)
    .Must(t => t is "None" or "MatchConvocation" or "External")
    .WithMessage("LinkType must be None, MatchConvocation or External.");
When(x => x.LinkType == "MatchConvocation", () =>
{
    RuleFor(x => x.LinkedEventId).NotEmpty();
    RuleFor(x => x.LinkedTeamId).NotEmpty();
});
When(x => x.LinkType == "External", () =>
{
    RuleFor(x => x.LinkUrl)
        .NotEmpty()
        .Must(u => Uri.TryCreate(u, UriKind.Absolute, out var uri)
            && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps))
        .WithMessage("La URL debe ser una dirección http(s) válida.");
});
```
   Run the validator tests from step 1 — confirm green.
4. Extend `CreateNewsHandlerTests.cs`/`UpdateNewsHandlerTests.cs` FIRST with cases asserting
   the persisted/updated `NewsItem` carries the submitted `LinkType`/`LinkedEventId`/
   `LinkedTeamId`/`LinkUrl` for each of the three `LinkType` values.
5. Update `CreateNewsHandler.Handle`: parse `NewsLinkType.TryParseName(request.LinkType, out var linkType)`
   (mirroring the existing `NewsStatus.TryParseName` call), pass `linkType!` and the three
   nullable fields into `NewsItem.Create(...)`.
6. Update `UpdateNewsHandler.Handle` the same way, calling the extended `UpdateContent(...)`.
   Run the handler tests from step 4 — confirm green.

## 4. Backend — read path (GetNews / GetNewsById / GetNewsDrafts)

TDD, in order:

1. Extend `GetNewsHandlerTests.cs`, `GetNewsByIdHandlerTests.cs`, `GetNewsDraftsHandlerTests.cs`
   FIRST: assert `linkType`/`linkedEventId`/`linkedTeamId`/`linkUrl` are present in the
   response and round-trip correctly for a news item created with each `LinkType`; assert a
   news item with `LinkType.None` returns `"None"` and null fields.
2. Extend the `NewsSummaryResponse`/`NewsDetailResponse` records (bottom of `GetNews.cs`) to
   add `string LinkType, string? LinkedEventId, string? LinkedTeamId, string? LinkUrl` at the
   end of each record's parameter list.
3. Update every `Select(n => new NewsSummaryResponse(...))`/`new NewsDetailResponse(...)`
   projection in `GetNews.cs`, `GetNewsById.cs`, `GetNewsDrafts.cs` to pass
   `n.LinkType.Name, n.LinkedEventId, n.LinkedTeamId, n.LinkUrl`. Run the tests from step 1 —
   confirm green.

## 5. Backend verification

From `Back/ExtractionApi`:
```
dotnet build
dotnet test --filter "FullyQualifiedName~News"
dotnet test
```
Report the full-suite pass count and compare against the known pre-existing baseline (same
caveat other archived changes note re: `AdnLegibleImporterFullDocumentSpotCheckTests`/
`GameModelSeederRealDocumentTests` and Docker availability for
`PostgresContainerFixture`-based tests, if this repo's News tests use that fixture — check
`CreateNewsHandlerTests.cs`'s base class first).

Do not proceed to §6 until `dotnet build` is clean and the News-filtered test run is green.

## 6. Frontend — service layer

Extend `Front/src/apps/coach/services/newsService.ts`:
- `NewsSummaryDto` gains: `linkType: "None" | "MatchConvocation" | "External"; linkedEventId: string | null; linkedTeamId: string | null; linkUrl: string | null;`
- `NewsPayload` gains the same four fields (required — the form always sends a `LinkType`,
  defaulting to `"None"`).
- `createNews`/`updateNews` bodies gain `LinkType: payload.linkType, LinkedEventId: payload.linkedEventId, LinkedTeamId: payload.linkedTeamId, LinkUrl: payload.linkUrl` (PascalCase keys,
  matching the existing mapping style in this file).

No test file needed for this pure type/plumbing change (no behavior to assert beyond what
§7-8's component tests already cover through mocking this module).

## 7. Frontend — form (create/edit)

Write tests FIRST in `Front/src/apps/coach/pages/news/components/__tests__/NewsFormDialog.test.tsx`
(extend if it exists, create if not — check first, follow its existing mocking style for
`newsService` and any team/sport-event service):
- Default state (`initialValue` undefined) has "Ninguno" selected; submitting without changing
  it calls `createNews` with `linkType: "None"`, `linkedEventId: null`, `linkedTeamId: null`,
  `linkUrl: null`.
- Selecting "Convocatoria de partido" reveals a team select and (after picking a team) a match
  select populated from `getSportEvents(teamId)` (mock this); submitting without picking both
  shows a validation error and does not call `createNews`/`updateNews`; submitting with both
  picked calls it with `linkType: "MatchConvocation"` and the chosen ids.
- Selecting "Enlace externo" reveals a URL `TextField`; submitting with it empty or a malformed
  value (e.g. `"not a url"`) shows a validation error and blocks submit; submitting with
  `"https://maps.google.com/..."` calls `createNews`/`updateNews` with `linkType: "External"`,
  `linkUrl` set.
- Editing (`initialValue` provided) with an existing `linkType: "MatchConvocation"` pre-selects
  that option and pre-fills team/match on open (mock `getSportEvents` to resolve a match list
  including the pre-selected `linkedEventId` so the select can show it); same for `"External"`
  pre-filling the URL field.

Confirm all new/changed tests fail first (Red — the control doesn't exist yet), then implement:

In `NewsFormDialog.tsx`:
- Add state: `linkType`, `linkedTeamId`, `linkedEventId`, `linkUrl`, plus whatever
  team-list/match-list state the picker needs (fetch teams via whatever existing
  team-listing mechanism the Coach app already uses elsewhere in this page tree — check
  `TeamDashboard.tsx`/`useTeamAndClub` or similar hooks before adding a new one; fetch matches
  via `sportEventService.getSportEvents(linkedTeamId)` once a team is chosen).
- Reset dependent fields when the link-kind selector changes away from a kind (e.g. switching
  from "Convocatoria de partido" to "Ninguno" clears `linkedTeamId`/`linkedEventId`).
- In `useEffect` (the one keyed on `[open, initialValue]`), also initialize `linkType`/
  `linkedTeamId`/`linkedEventId`/`linkUrl` from `initialValue`, defaulting to `"None"`/nulls
  for a new item.
- Add a `ToggleButtonGroup` (or MUI `Select`, match whatever control style
  `copilot-instructions.md`/nearby forms in this codebase favor for a 3-way choice) labeled
  "Enlace", options "Ninguno" / "Convocatoria de partido" / "Enlace externo".
- Conditionally render: team `Select` + match `Select` when `linkType === "MatchConvocation"`;
  URL `TextField` when `linkType === "External"`.
- Extend `validate()` to add the rules from the test list above (team+match required for
  `MatchConvocation`; non-empty well-formed `http(s)` URL required for `External` — a simple
  `try { new URL(value) } catch { invalid }` plus a protocol check is sufficient, mirroring the
  backend rule).
- Extend the `payload` object in `handleSubmit` with the four new fields before calling
  `newsService.createNews`/`updateNews`.

Run the test file — confirm green.

## 8. Frontend — list and detail rendering

Write tests FIRST:
- `Front/src/apps/coach/pages/news/components/__tests__/NewsListCard.test.tsx` (extend/create):
  a news item with `linkType: "MatchConvocation"` or `"External"` renders a `Chip`/indicator
  (pick one accessible label, e.g. `getByText(/convocatoria/i)` or `getByText(/enlace/i)`) and
  does NOT render a second `<a>`/nested link inside the card's outer `<Link>`; a news item with
  `linkType: "None"` renders neither.
- `Front/src/apps/coach/pages/news/__tests__/NewsDetail.test.tsx` (extend): mock
  `newsService.getNewsById` to resolve a news item with `linkType: "MatchConvocation"`,
  `linkedEventId`, `linkedTeamId` set — assert a "Ver convocatoria" link/button is rendered
  with `href`/`to` equal to `/coach/convocations/match?eventId=<id>&teamId=<teamId>` (wrap the
  component in `MemoryRouter` per this file's existing convention, check the rendered anchor's
  resolved `href` if using `react-router`'s `Link`, or the button's click-triggered `navigate`
  call if using `useNavigate` — follow whichever pattern `NewsDetail.tsx`'s existing "Volver a
  noticias" button already uses, i.e. `useNavigate`); mock a `linkType: "External"` item —
  assert an `<a href={linkUrl} target="_blank" rel="noopener noreferrer">` is rendered; mock a
  `linkType: "None"` item — assert neither is rendered.

Confirm Red, then implement:

`NewsListCard.tsx`: import `Chip` (or reuse whatever indicator component this codebase already
uses for small badges — check `shared/components/ui/` first), render it conditionally based on
`item.linkType !== "None"` inside `.content`, with a label distinguishing the two kinds (e.g.
"Convocatoria" vs. "Enlace"). Do not add a second `<a>`/`<Link>` anywhere in this component —
the entire card is already one `<Link>`.

`NewsDetail.tsx`: below the existing `<div className={styles.body}>`, add conditional
rendering:
```tsx
{news.linkType === "MatchConvocation" && news.linkedEventId && (
  <Button
    variant="outlined"
    onClick={() =>
      navigate(`/coach/convocations/match?eventId=${news.linkedEventId}&teamId=${news.linkedTeamId ?? ""}`)
    }
  >
    Ver convocatoria
  </Button>
)}
{news.linkType === "External" && news.linkUrl && (
  <a href={news.linkUrl} target="_blank" rel="noopener noreferrer" className={styles.valueLink /* or a new class if this one doesn't exist in this module */}>
    Ver enlace
  </a>
)}
```
(Check `NewsDetail.module.css` for an existing link/button style class before inventing a new
CSS class — reuse if present, add a minimal one co-located in that module if not.)

Run both test files — confirm green.

## 9. Frontend verification

From `Front`:
```
npm run test
npm run build
```
Both must be clean. Then manually smoke-test in the dev server (`npm run dev`): create a news
item, link it to a real match, confirm "Ver convocatoria" navigates to that match's
convocation; create another linked to an external URL (e.g. a Google Maps link), confirm it
opens in a new tab; confirm a pre-existing news item (no link) still renders unchanged in both
the list and detail views.

## 10. Do not commit, push, or archive

Leave the change in `openspec/changes/add-news-link/` (not archived). Do not run `git
commit`/`git push`. Report: files created/modified (full paths, backend and frontend
separately), build/test status for both stacks, and the final exact
`CreateNewsCommand`/`UpdateNewsCommand`/`NewsSummaryResponse`/`NewsDetailResponse` JSON shapes
(should match `design.md` — flag any unavoidable deviation).
