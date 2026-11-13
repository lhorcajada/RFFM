## Proposal

### Why

Issue 15 asks for a new design of the "Propuestos para desconvocar" list, now that the already-deconvoked players are part of it. The design has to be made on the final content of the list, so it follows the logic slice `show-already-deconvoked-in-proposal`.

### What Changes

- The deconvocation proposal block, the one that holds the players proposed for deconvocation followed by the already-deconvoked players marked «Ya desconvocado», gets a new visual design, including the design of each player row.
- The new design is responsive: it stays usable from 360px wide up to desktop, built from cards or a list layout, never from a table or fixed-column grid, and styled with CSS Modules and the theme tokens of the Coach app.
- The block keeps showing the same content as today, in the same order: new proposals first by score, then the already-deconvoked players with the mark «Ya desconvocado».
- The behavior and data of the proposal do not change: selection, scores, target count, position warnings, empty-list notices, and applying the proposal work as they do now.
- The visual design itself is produced with the `/design` flow under `.design/<name>/`, in a later phase of this change; this phase only fixes what the design must preserve.

## Design

### Target State

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

### Goals / Non-Goals

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

### Decisions

#### D1. Edit in place; keep the local renderers
Keep `renderCard` and `renderAlreadyDeconvokedCard` inside `ConvocationTab.tsx` and restyle them, instead of extracting row components. The proposal and the nearest-sibling rule point at the existing structure, and the renderers close over `proposal`, `selectedProposalPlayers`, and `roleLabel`.
- **Provenance**: derived
- **Record family**: not applicable (fails the hard-to-reverse and real-trade-off criteria)

#### D2. Flex lists replace grids for cards and factor rows
`.proposalCards` becomes `.proposalList`: `display: flex; flex-direction: column` with `gap`, and from a wide container `flex-wrap: wrap` with each card `flex: 1 1 320px; min-width: 0`, so cards fill the width without any column count. `.factorItem` becomes a flex row (`flex-wrap: wrap`): label `flex: 1 1 12rem`, meta and impact `flex: 0 0 auto`, so the row wraps on narrow cards instead of switching grid templates in a media query. The 600px media-query block shrinks to header stacking and sub-item indentation.
- **Provenance**: derived
- **Record family**: adr
- Alternatives considered: keep `auto-fill minmax` grid (adaptive, but a grid the spec's "no fixed-column grid" wording can be read to forbid, and the factor grid is literally fixed columns); CSS container queries (more control, but not used anywhere else in the project). Rationale: flex lists satisfy the spec literally and need no breakpoint for the common case.

#### D3. Separate group for already-deconvoked rows
Split the single container into the proposed `.proposalList` and, after it, a `div.proposalDeconvokedGroup` (`role="group"`, `aria-label="Jugadores ya desconvocados"`) holding its own `.proposalList`. Row order and content are unchanged. The group has a top divider and no visible new text, so the exact-text assertions on «Ya desconvocado» (count equals number of rows) keep passing. Already-deconvoked cards stop reusing `.proposalCardDim` and use a new `.proposalCardDeconvoked` (muted surface, dashed border, no opacity), so they differ from both proposed and «Resto de convocados» cards. The group renders only when `alreadyDeconvoked` is non-empty.
- **Provenance**: derived

#### D4. Tokens with literal fallbacks, no new colors or spacings
Colors that map to an existing token use `var(--rffm-<token>, <current literal>)`: card surface (`--rffm-card-bg` family), borders and text (`--rffm-dash-card-*`, `--rffm-results-*`), accent (`--rffm-secondary`), semantic green and red (`--rffm-status-accepted`, `--rffm-status-declined`), warning (`--rffm-status-pending`). Values with no token (radius, gaps, the proposal-specific tints) keep today's literals; no new hex, rgba, or spacing value is introduced. The concrete token-to-class mapping is fixed in the implementation step and verified against `muiGameTheme.ts`.
- **Provenance**: codebase-forced (the Coach theme is not mounted; `:root` tokens come from `muiGameTheme.ts` and have no radius or spacing tokens)

#### D5. Remove the two style escapes of the block
The warning `Alert` gets `className={styles.proposalWarningAlert}` (margin top moved to CSS) and the no-selection paragraph gets `styles.proposalNotice` (margin bottom moved to CSS); `sx` and inline `style` leave the block. The visible result is identical.
- **Provenance**: derived

#### D6. Visual design artifact is produced with the /design flow under `.design/deconvocation-proposal/`
The visual design files (`project/canvas.json`, `project/*.dc.html`) live in `.design/deconvocation-proposal/`, show proposed rows, a forced row, the «Resto de convocados» rows, and «Ya desconvocado» rows in one block at 360px and desktop widths, and are not committed unless asked (`.claude/rules/design.md`). Producing it with `/design` is a precondition handed to the user: it must exist before Step 2 (the CSS restyle) starts, and Step 2 consults it as an input. Step 1 (structure and tests) is independent of it and can be built first. D2, D3, and D4 are the structural and token constraints the artifact must respect; within them, where the artifact differs in appearance only, the artifact wins; where it would change content, order, behavior, or the structural rules of D2 to D4 (no table, no fixed-column grid, no new design values without user approval), the specs win. If `.design/deconvocation-proposal/` is absent when Step 2 starts, Step 2 stops and reports the missing precondition instead of restyling from D2 to D4 alone.
- **Provenance**: user (the proposal fixes the `/design` flow and the `.design/<name>/` location)

#### D7. Tests assert content, order, and structure, not styles
Add `__tests__/ConvocationTab.proposalLayout.test.tsx` and extend the existing suites only where an assertion changes. New tests check: proposed rows precede already-deconvoked rows in DOM order, «Ya desconvocado» appears only on already-deconvoked rows, the proposed row data (name, `N pts`, role, «OBLIGATORIO», chips, factor labels) is still rendered, the block contains no `table`, the already-deconvoked rows sit inside the labelled group, and no group renders when there are none. CSS Module styles and MUI markup are not asserted.
- **Provenance**: derived

#### D7b. Version bump
The change is a `feat` for `Front/` only: bump the minor in `Front/package.json` in the same commit.
- **Provenance**: codebase-forced (`.claude/rules/git.md` section 2.4)

### Risks / Trade-offs

- [Existing tests rely on exact visible texts; a new visible label or reworded copy would break them] (**Verify-first**: Step 1) → Mitigation: the new group carries no visible text, only `aria-label`; Step 1 writes the structure test first and runs the three existing `ConvocationTab.*` suites before restyling.
- [Replacing `auto-fill` grid with a flex list may change how many cards sit per row on desktop] → Mitigation: `flex: 1 1 320px` yields about the same count as the current `minmax(340px, ...)`; confirmed visually in Manual Verification.
- [Tokens with literal fallbacks can render a different shade if a token differs from today's literal] → Mitigation: pick a token only when its value in `muiGameTheme.ts` matches the literal it replaces, otherwise keep the literal.
- [Factor rows wrapping on narrow cards can look uneven] → Mitigation: label `flex: 1 1 12rem`, impact stays right-aligned with `margin-left: auto`; checked at 360px.
- [The `/design` artifact may not exist when Step 2 starts] (**Verify-first**: Step 2) → Mitigation: D6 makes it a user-handed precondition of Step 2; Step 1 does not depend on it, so it can be built while the user produces the design.

### Open Questions

None. All decisions above resolve from the specs, the verified source, and the project rules.

### Manual Verification

- **Visual design artifact**: `.design/deconvocation-proposal/project/canvas.json` and its `.dc.html` exist before Step 2 starts, one frame shows proposed, forced, «Resto de convocados», and «Ya desconvocado» rows in a single block, and the restyled block matches it in appearance. No automated test or review step checks this.
- **Smoke at real widths**: open a convocation with a generated proposal that has proposed, forced, and already-deconvoked players. At 360px wide every row is readable and the page has no horizontal scroll; at desktop width the cards use the available width; the already-deconvoked rows look different from the others and carry «Ya desconvocado». Clicking «Aplicar propuesta» deconvokes the same players as before and not the already-deconvoked ones.

## Step 1: Restructure the proposal block markup under test

### Interfaces

**Interfaces**: No new export and no prop change: `ConvocationTab` in `Front/src/apps/coach/pages/convocations/components/ConvocationTab.tsx` keeps its default export and props. The observable markup contract added by the step is:
- Already-deconvoked rows are rendered after the proposed rows inside one element with `role="group"` and accessible name `Jugadores ya desconvocados`, present only when `proposal.alreadyDeconvoked` is non-empty.
- Every proposed and already-deconvoked row stays an `article`; the block contains no `table` element.
- CSS Module keys used by the markup: `proposalList`, `proposalDeconvokedGroup`, `proposalCardDeconvoked`, `proposalWarningAlert`, `proposalNotice` (all in `ConvocationTab.module.css`).

**Test assertions** (fixture: the `proposalPlayer`, `alreadyOut`, `proposal`, and `renderTab` helper pattern of `Front/src/apps/coach/pages/convocations/components/__tests__/ConvocationTab.alreadyDeconvoked.test.tsx`, proposal opened by clicking the button named "proponer desconvocados"; spec: `openspec/changes/redesign-deconvocation-proposal-ui/specs/deconvocation-proposal-ui/spec.md`):
1. [unit] Order — 2 proposed players (scores 80 then 60) and 1 already-deconvoked player → the three `article` elements appear in DOM order proposed (80), proposed (60), already-deconvoked; no proposed row follows the already-deconvoked one. Spec: requirement "Proposal block keeps its content and order in the new design", scenario "Proposed players come before already-deconvoked players".
2. [unit] Mark — 2 already-deconvoked players → `getAllByText("Ya desconvocado")` has length 2 and both matches are inside the group named `Jugadores ya desconvocados`; with 1 proposed player added, no «Ya desconvocado» text sits inside the proposed row. Spec: scenarios "Already-deconvoked players keep their mark" and "Already-deconvoked players are distinguishable from proposed players".
3. [unit] No already-deconvoked players → `queryByRole("group", { name: /ya desconvocados/i })` and `queryByText("Ya desconvocado")` are both null. Spec: scenario "No already-deconvoked players".
4. [unit] Row data kept — a forced proposed player with score 70, role `Defensa` and 3 calls → the row shows its name, `70 pts`, the role chip, `OBLIGATORIO`, and `3 conv.`. Spec: scenario "Row data is preserved".
5. [unit] Only already-deconvoked players and no proposals → the group is present with its rows and `queryByText("No hay convocados para evaluar.")` is null. Spec: scenario "Only already-deconvoked players".
6. [unit] No table — full fixture (proposed, forced, remaining, already-deconvoked) → `container.querySelector("table")` is null and `queryByRole("table")` is null. Spec: scenario "No table markup".
7. [unit] No inline style on the notice — no player selected and some evaluated → the paragraph with «No hace falta desconvocar jugadores con las reglas actuales.» has no `style` attribute and the text is still shown. Spec: requirement "Redesign follows the project's styling rules", scenario "Styles live in CSS Modules".

### Tasks

**Files Affected**:

```text
A Front/src/apps/coach/pages/convocations/components/__tests__/ConvocationTab.proposalLayout.test.tsx
M Front/src/apps/coach/pages/convocations/components/ConvocationTab.tsx
M Front/src/apps/coach/pages/convocations/components/ConvocationTab.module.css
```

## Step 2: Restyle the proposal block with flex lists and tokens, bump the version

### Tasks

**Files Affected**:

```text
M Front/src/apps/coach/pages/convocations/components/ConvocationTab.module.css
M Front/package.json
```
