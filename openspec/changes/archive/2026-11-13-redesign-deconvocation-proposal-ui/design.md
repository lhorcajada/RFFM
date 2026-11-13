## Target State

After the last step, the proposal body of `ConvocationTab` renders this structure (class names are CSS Module keys of `ConvocationTab.module.css`; texts in quotes are unchanged copy):

```
.proposalPage
  .proposalHeader
    .proposalHeaderText: h3.proposalTitle, p.proposalSubtitle (target / called), [p.proposalSubtitle rival result],
                         [Alert.proposalWarningAlert > ul.proposalWarningList]      (no sx prop)
    .proposalHeaderActions: Volver | [Actualizar] | [Reglas] | Aplicar propuesta | Imprimir propuesta
  loading spinner | EmptyState | body:
    [p.proposalSubtitle.proposalNotice  "No hace falta desconvocar jugadores con las reglas actuales."]   (no inline style)
    [p.proposalSectionLabel "Propuestos para desconvocar"]
    .proposalList                                  (flex list, one card per proposed player, by score)
      article.proposalCard[.proposalCardForced]
        .proposalCardTop: .proposalCardName([.proposalForcedBadge "OBLIGATORIO"] strong) + .proposalScore "N pts"
        .proposalChips: role | conv. | tit. | min. conv | entrenos
        .factorList > .factorGroup > .factorItem / .factorSubItem   (flex rows, no grid)
    [div.proposalDeconvokedGroup role="group" aria-label="Jugadores ya desconvocados"]   (after the proposed list, same block)
      .proposalList
        article.proposalCard.proposalCardDeconvoked
          .proposalCardTop: .proposalCardName(strong) + .proposalAlreadyBadge "Ya desconvocado"
          .proposalChips: role
    [p.proposalSectionLabel.proposalSectionLabelDim "Resto de convocados"]
    .proposalList: article.proposalCard.proposalCardDim ...
```

### Architecture Snapshot

None — no planned public surfaces
The change restyles local render helpers and CSS Module classes inside `Front/src/apps/coach/pages/convocations/components/`; the default export `ConvocationTab` keeps its props and no new export, endpoint, or artifact format is introduced.

### File Manifest

- M Front/package.json (Step 2)
- M Front/src/apps/coach/pages/convocations/components/ConvocationTab.module.css (Step 1, Step 2)
- M Front/src/apps/coach/pages/convocations/components/ConvocationTab.tsx (Step 1)
- A Front/src/apps/coach/pages/convocations/components/__tests__/ConvocationTab.proposalLayout.test.tsx (Step 1)

## Context

- `Front/src/apps/coach/pages/convocations/components/ConvocationTab.tsx` holds the whole proposal panel (gated by `showProposal`) and two local row renderers: `renderCard(item, highlighted)` for proposed and remaining players, and `renderAlreadyDeconvokedCard(item)` for already-deconvoked ones. `ConvocationMatchDetail.tsx` is the only importer of `ConvocationTab`; `ConvocatoriaPrint.tsx` prints the proposal with its own `ConvocatoriaPrint.module.css` and shares no class with this block.
- Today the already-deconvoked cards are rendered inside the same `.proposalCards` container as the proposed cards and reuse `.proposalCardDim`, the same dim style as the «Resto de convocados» cards, so they are only told apart by the `.proposalAlreadyBadge` chip.
- `ConvocationTab.module.css` styles the block with about 85 hardcoded color literals (21 hex, 64 rgba) and a single `var()`. Layout uses `.proposalCards` (`grid`, `auto-fill`, `minmax(min(340px,100%),1fr)`) and `.factorItem` (`grid`, `1fr auto auto`, collapsing to `1fr auto` under 600px). Both are grid-based, which the new responsive requirement forbids as fixed-column grids.
- Two style escapes exist in the block: `sx={{ mt: 1 }}` on the position-warning `Alert` and `style={{ marginBottom: 8 }}` on the no-selection paragraph.
- Runtime tokens: the Coach theme (`muiCoachTheme.ts`) is not mounted, so `--rffm-*` custom properties come from `:root` in `muiGameTheme.ts` (surfaces, text, accent, semantic status, effects) and `BaseLayout.module.css` (`--rffm-page-h-padding`). No `--rffm-*` radius, spacing, or orange/danger-for-proposal token exists. `Convocations.module.css` already uses `var(--rffm-*, <literal>)` with the literal as fallback.
- Tests that touch the block and must keep passing: `__tests__/ConvocationTab.alreadyDeconvoked.test.tsx` (exact texts «Ya desconvocado» count 2, «Propuestos para desconvocar», «Resto de convocados» absence, both notices), `ConvocationTab.positionWarnings.test.tsx` («Centrales: quedan 2 de 3», chip `title` attributes, button `/proponer desconvocados/i`), `ConvocationTab.rules.test.tsx`.
- `.design/` exists with designs of other features (for example `.design/convocatoria` and `.design/desconvocatorias-historial`, usable as visual references); `.design/deconvocation-proposal/` does not exist yet. No `/design` command file exists in `.claude/commands/`; `.claude/rules/design.md` fixes where design files live.

## Goals / Non-Goals

**Goals**
- Give the proposal block and its rows a new, responsive visual design from 360px to desktop, made of cards and flex lists, with no table and no fixed-column grid, including the factor rows inside each proposed card.
- Make already-deconvoked rows visibly different from proposed rows and from «Resto de convocados» rows, while keeping the mark «Ya desconvocado» on them and only on them.
- Keep content, order, behavior, and data identical: proposed players first by score, then already-deconvoked players; same notices, warnings, buttons, and apply result.
- Style only through the CSS Module of the component, using existing `--rffm-*` tokens with the current literals as fallbacks, and remove the two style escapes (`sx`, inline `style`) of the block.
- Keep the visual design files under `.design/deconvocation-proposal/`, made on the final list content.

**Non-Goals**
- No change to proposal logic, API, backend, data model, `ConvocatoriaPrint`, or the `previousRivalResult` and position-warning data.
- No new component file, no new shared component, no theme change, no mounting of `muiCoachTheme`.
- Out of scope: the factor grouping `Map` in `renderCard` is typed with `any` (about line 362), against the TypeScript rule — revisit when `ConvocationTab` typing is cleaned up.
- Out of scope: new radius or spacing tokens in `:root` — revisit when the Coach theme is mounted and design tokens are consolidated.

## Decisions

### D1. Edit in place; keep the local renderers
Keep `renderCard` and `renderAlreadyDeconvokedCard` inside `ConvocationTab.tsx` and restyle them, instead of extracting row components. The proposal and the nearest-sibling rule point at the existing structure, and the renderers close over `proposal`, `selectedProposalPlayers`, and `roleLabel`.
- **Provenance**: derived
- **Record family**: not applicable (fails the hard-to-reverse and real-trade-off criteria)

### D2. Flex lists replace grids for cards and factor rows
`.proposalCards` becomes `.proposalList`: `display: flex; flex-direction: column` with `gap`, and from a wide container `flex-wrap: wrap` with each card `flex: 1 1 320px; min-width: 0`, so cards fill the width without any column count. `.factorItem` becomes a flex row (`flex-wrap: wrap`): label `flex: 1 1 12rem`, meta and impact `flex: 0 0 auto`, so the row wraps on narrow cards instead of switching grid templates in a media query. The 600px media-query block shrinks to header stacking and sub-item indentation.
- **Provenance**: derived
- **Record family**: adr
- Alternatives considered: keep `auto-fill minmax` grid (adaptive, but a grid the spec's "no fixed-column grid" wording can be read to forbid, and the factor grid is literally fixed columns); CSS container queries (more control, but not used anywhere else in the project). Rationale: flex lists satisfy the spec literally and need no breakpoint for the common case.

### D3. Separate group for already-deconvoked rows
Split the single container into the proposed `.proposalList` and, after it, a `div.proposalDeconvokedGroup` (`role="group"`, `aria-label="Jugadores ya desconvocados"`) holding its own `.proposalList`. Row order and content are unchanged. The group has a top divider and no visible new text, so the exact-text assertions on «Ya desconvocado» (count equals number of rows) keep passing. Already-deconvoked cards stop reusing `.proposalCardDim` and use a new `.proposalCardDeconvoked` (muted surface, dashed border, no opacity), so they differ from both proposed and «Resto de convocados» cards. The group renders only when `alreadyDeconvoked` is non-empty.
- **Provenance**: derived

### D4. Tokens with literal fallbacks, no new colors or spacings
Colors that map to an existing token use `var(--rffm-<token>, <current literal>)`: card surface (`--rffm-card-bg` family), borders and text (`--rffm-dash-card-*`, `--rffm-results-*`), accent (`--rffm-secondary`), semantic green and red (`--rffm-status-accepted`, `--rffm-status-declined`), warning (`--rffm-status-pending`). Values with no token (radius, gaps, the proposal-specific tints) keep today's literals; no new hex, rgba, or spacing value is introduced. The concrete token-to-class mapping is fixed in the implementation step and verified against `muiGameTheme.ts`.
- **Provenance**: codebase-forced (the Coach theme is not mounted; `:root` tokens come from `muiGameTheme.ts` and have no radius or spacing tokens)

### D5. Remove the two style escapes of the block
The warning `Alert` gets `className={styles.proposalWarningAlert}` (margin top moved to CSS) and the no-selection paragraph gets `styles.proposalNotice` (margin bottom moved to CSS); `sx` and inline `style` leave the block. The visible result is identical.
- **Provenance**: derived

### D6. Visual design artifact is produced with the /design flow under `.design/deconvocation-proposal/`
The visual design files (`project/canvas.json`, `project/*.dc.html`) live in `.design/deconvocation-proposal/`, show proposed rows, a forced row, the «Resto de convocados» rows, and «Ya desconvocado» rows in one block at 360px and desktop widths, and are not committed unless asked (`.claude/rules/design.md`). Producing it with `/design` is a precondition handed to the user: it must exist before Step 2 (the CSS restyle) starts, and Step 2 consults it as an input. Step 1 (structure and tests) is independent of it and can be built first. D2, D3, and D4 are the structural and token constraints the artifact must respect; within them, where the artifact differs in appearance only, the artifact wins; where it would change content, order, behavior, or the structural rules of D2 to D4 (no table, no fixed-column grid, no new design values without user approval), the specs win. If `.design/deconvocation-proposal/` is absent when Step 2 starts, Step 2 stops and reports the missing precondition instead of restyling from D2 to D4 alone.
- **Provenance**: user (the proposal fixes the `/design` flow and the `.design/<name>/` location)

### D7. Tests assert content, order, and structure, not styles
Add `__tests__/ConvocationTab.proposalLayout.test.tsx` and extend the existing suites only where an assertion changes. New tests check: proposed rows precede already-deconvoked rows in DOM order, «Ya desconvocado» appears only on already-deconvoked rows, the proposed row data (name, `N pts`, role, «OBLIGATORIO», chips, factor labels) is still rendered, the block contains no `table`, the already-deconvoked rows sit inside the labelled group, and no group renders when there are none. CSS Module styles and MUI markup are not asserted.
- **Provenance**: derived

### D7b. Version bump
The change is a `feat` for `Front/` only: bump the minor in `Front/package.json` in the same commit.
- **Provenance**: codebase-forced (`.claude/rules/git.md` section 2.4)

## Risks / Trade-offs

- [Existing tests rely on exact visible texts; a new visible label or reworded copy would break them] (**Verify-first**: Step 1) → Mitigation: the new group carries no visible text, only `aria-label`; Step 1 writes the structure test first and runs the three existing `ConvocationTab.*` suites before restyling.
- [Replacing `auto-fill` grid with a flex list may change how many cards sit per row on desktop] → Mitigation: `flex: 1 1 320px` yields about the same count as the current `minmax(340px, ...)`; confirmed visually in Manual Verification.
- [Tokens with literal fallbacks can render a different shade if a token differs from today's literal] → Mitigation: pick a token only when its value in `muiGameTheme.ts` matches the literal it replaces, otherwise keep the literal.
- [Factor rows wrapping on narrow cards can look uneven] → Mitigation: label `flex: 1 1 12rem`, impact stays right-aligned with `margin-left: auto`; checked at 360px.
- [The `/design` artifact may not exist when Step 2 starts] (**Verify-first**: Step 2) → Mitigation: D6 makes it a user-handed precondition of Step 2; Step 1 does not depend on it, so it can be built while the user produces the design.

## Open Questions

None. All decisions above resolve from the specs, the verified source, and the project rules.

## Manual Verification

- **Visual design artifact**: `.design/deconvocation-proposal/project/canvas.json` and its `.dc.html` exist before Step 2 starts, one frame shows proposed, forced, «Resto de convocados», and «Ya desconvocado» rows in a single block, and the restyled block matches it in appearance. No automated test or review step checks this.
- **Smoke at real widths**: open a convocation with a generated proposal that has proposed, forced, and already-deconvoked players. At 360px wide every row is readable and the page has no horizontal scroll; at desktop width the cards use the available width; the already-deconvoked rows look different from the others and carry «Ya desconvocado». Clicking «Aplicar propuesta» deconvokes the same players as before and not the already-deconvoked ones.
