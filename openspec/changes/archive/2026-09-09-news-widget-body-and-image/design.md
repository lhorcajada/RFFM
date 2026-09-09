## Context

`NewsListCard.tsx` already has a `compact` prop used only by `NewsWidget.tsx` (the dashboard's
"Últimas noticias" carousel). `NewsListCard.module.css`'s `.compact .image`/`.compact .subtitle`
overrides (lines 84-99) currently give the image a fixed `height: 72px` and clamp `.subtitle`
(the short `Subtitle` field) to 4 lines. `NewsItem.Body` (labeled "Cuerpo" in
`NewsFormDialog.tsx`) already exists and is already returned by `NewsDetailResponse` for the
detail page, but the list/summary responses (`NewsSummaryResponse`, returned by `GetNews`/
`GetNewsDrafts`) never included it — the frontend `NewsSummaryDto` has no `body` field to render.

## Goals / Non-Goals

**Goals:**
- The compact card shows the news item's `body` (long description), not `subtitle`.
- The compact card's cover image visually occupies about half the card's height (not a small
  fixed 72px band).
- The body preview clamps to whatever number of lines fits the remaining half of the card,
  truncating with `…` — not a fixed small line count.
- `News.tsx`'s full-page list and `NewsDetail.tsx` are unaffected (non-`compact` rendering).

**Non-Goals:**
- Changing what `Subtitle` is used for elsewhere (it stays as-is on the detail page, the form,
  and the non-compact list).
- Truncating/summarizing `body` server-side — the full field is sent; only the frontend clamps
  it visually.

## Decisions

### 1. Add `Body` to `NewsSummaryResponse`, not a new response shape
`NewsSummaryResponse` (bottom of `GetNews.cs`) is a flat positional record shared by `GetNews`
and `GetNewsDrafts`. Add `string Body` as the last parameter (purely additive — no existing code
constructs this record positionally outside these two projections, confirmed via search) and add
`n.Body` to both `.Select(n => new NewsSummaryResponse(...))` projections. `NewsDetailResponse`
already has `Body`; no change needed there. `PublishNews.cs`/`UnpublishNews.cs` already return
`NewsDetailResponse`, not `NewsSummaryResponse` — no change needed there either.

Alternative considered: a separate lightweight "preview" endpoint/DTO carrying a
server-truncated excerpt. Rejected per the user's explicit choice (confirmed during scoping) —
the API returns the full `body`; truncation is a frontend display concern (`-webkit-line-clamp`),
consistent with how `subtitle` is handled today (never truncated server-side either).

### 2. Frontend: `NewsSummaryDto` gains `body: string`
`newsService.ts`'s `NewsSummaryDto` adds `body: string` (matches `NewsDetailDto`, which already
gets `body` via `NewsSummaryDto & { body: string; ... }` — this makes the field consistent across
both DTOs instead of `NewsDetailDto` redundantly re-declaring it once `NewsSummaryDto` already
has it structurally; no signature change needed for `NewsDetailDto` itself since it already
includes `body` in its intersection).

### 3. `NewsListCard.tsx` compact mode renders `item.body`, not `item.subtitle`
In the JSX, the `<p className={styles.subtitle}>{item.subtitle}</p>` line is unconditional today
(used for both compact and non-compact). Since compact must show `body` while non-compact keeps
showing `subtitle`, render conditionally:
```tsx
<p className={styles.subtitle}>{compact ? item.body : item.subtitle}</p>
```
Alternative considered: a second, separate `<p>` element for the compact body preview, class
`styles.bodyPreview`, keeping `.subtitle` untouched. Rejected — the compact card doesn't show
both subtitle and body at once (goal is a bigger image + one description block in the remaining
space), so branching the single text node's *content* is simpler than adding a second element
and hiding the first; the existing `.compact .subtitle` CSS override (clamp/overflow) already
targets this exact element and keeps working unchanged.

### 4. CSS: image grows to ~50% of the compact card, text fills the rest
`NewsListCard.module.css`'s `.card` is already `display: flex; flex-direction: column; height:
100%` (fills the carousel slide). Change `.compact .image` from a fixed `height: 72px` to a
flex-based share of that column:
```css
.compact .image {
  aspect-ratio: auto;
  flex: 1 1 50%;
  min-height: 0;
  object-fit: cover;
}

.compact .content {
  padding: 10px 12px;
  flex: 1 1 50%;
  min-height: 0;
}
```
`.content` is already `flex: 1; display: flex; flex-direction: column` from the base (non-compact)
rule (line 44-52) — the compact override only needs to add the `50%` basis so image and content
split the card evenly instead of content taking "whatever's left after a 72px image". `.compact
.subtitle` (now rendering `body`) keeps `-webkit-line-clamp` but the clamp count changes from a
fixed `4` to `-webkit-line-clamp: 6` as a generous ceiling — the actual visible line count is
however many fit `.content`'s available height (`.content`'s `overflow` isn't hidden, but the
clamp's own `overflow: hidden` on the `<p>` still caps it), matching the acceptance criterion "as
many lines as fit, truncated with …". A pure "fill remaining space, no fixed line count" CSS
mechanism (e.g. `line-clamp: auto`) doesn't exist in CSS today, so a generously-high fixed clamp
(6, comfortably more than the ~half-card content area can ever show at this widget's font-size)
is the practical way to express "as many as fit" without a JS height-measurement hack — the
`.content`'s own fixed height, not the clamp number, is what actually bounds the visible lines in
every real card size this widget renders at.

Alternative considered: measure available height in JS and compute the clamp dynamically.
Rejected — adds a `ResizeObserver`/layout-effect for a purely cosmetic ceiling that a generous
static clamp already achieves without JS, matching this codebase's CSS-only approach to the
existing 4-line clamp.

### 5. Non-compact (`News.tsx`, `NewsDetail.tsx`) unaffected
`compact` is `undefined`/`false` in every other call site (`News.tsx`'s plain grid); the ternary
in Decision 3 keeps rendering `item.subtitle` there unchanged, and none of the `.compact *` CSS
selectors apply without the `compact` class.

## Risks / Trade-offs

- [Some published news items may have a very short or empty `body`] → Accepted; the card simply
  shows less text in that case (same as today's subtitle-based rendering when subtitle is short),
  no fallback needed since `Body` is a required field on `NewsItem.Create`.
- [Fixed `-webkit-line-clamp: 6` is an approximation of "as many as fit", not exact] → Accepted,
  documented in Decision 4; the flex-based `.content` height is the real bound, the clamp number
  is just a safety ceiling above it.

## Open Questions

None.
