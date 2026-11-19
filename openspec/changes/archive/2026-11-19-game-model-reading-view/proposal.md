> **⚠ POST-HOC RECORD** — This proposal was backfilled after implementation against a user-supplied statement of intent. It describes a decision already made, not one being proposed.

## Why

A real game model has about 700 blocks (5 phases, about 16 principles, 46 subprinciples, 263 sub-subprinciples and about 322 skills). The previous coach read view showed one phase at a time, with no search, no index below phase level and no collapse, so finding something specific was slow. The coach reads the model on phone and desktop alike, mostly to look for something specific, so reading becomes search-first and outline-first.

## What Changes

- A new read view, `GameModelReadingView`, replaces `GameModelView` on the coach game-model page. It shows every phase, plus «Balón parado» when set-piece rules exist, as one collapsible outline instead of one phase at a time.
- Search: accent- and case-insensitive over titles, texts, trainable text, skills and notes at every level. A lone numeric query such as `2.3` finds the node with exactly that number. Matches are highlighted, only the branches that contain results expand, a counter shows the results, and next/previous buttons move between them. A search with no matches shows an empty-results message, and clearing the search restores the previous expand and collapse state.
- Depth and collapse: a five-level depth selector (principles, subprincipios, zones, sub-subprincipios, skills and notes), per-node collapse, «Expandir todo» and «Contraer todo». Changing the level discards manual toggles.
- Index and links: an index from phase down to subprincipio, shown as a side panel on wide screens and in a drawer opened from «Ir a…» on small screens. Selecting an entry expands the collapsed ancestors and scrolls to the node. Phases, principles and subprincipios carry a direct link in the `nodo` query parameter; a link to a node that no longer exists opens the model at the top with a notice.
- Node addresses: one helper module, `gameModelNodeAddress.ts`, defines every node address — the stable backend key when the entity exposes one, the hierarchical number path otherwise, and the parent address plus API id for skills, notes and set-piece rules.
- Pending-change decoration: the view accepts an optional `pendingChanges` prop (a map from node address to an add, change or remove). It decorates nodes without altering the saved model, renders an add as a placeholder node in its position, keeps decorated nodes and their ancestors visible and expanded, marks them in the index, and offers a counter to jump between them.
- Pure view-model functions in `gameModelReadingTree.ts` build the outline, search, highlight and compute expansion in the browser from the already loaded tree, with their own tests.
- Kept behaviors: the «Balón parado» section, «misma que» references on skills, open issues always visible, the season selector and the empty state. The view uses CSS Modules and no tables.
- `GameModelView` and the unused `GameModelTree` are removed with their tests. The PDF export, the ordering helpers (`gameModelOrder.ts`), the editor and the season-plan trees are unchanged.
- Implemented details the statement of intent did not name: the view opens at the subprincipio level and does not remember its expand state between visits; a multi-word query requires every word in the same node; Enter and Shift+Enter in the search box move to the next and previous result.
- The web version goes from 1.142.0 to 1.143.0.

## Capabilities

### New Capabilities

- `game-model-reading-view`: search, depth levels and collapse, index and direct links, node addresses and pending-change decoration of the coach game-model read view.

### Modified Capabilities

- `game-model-redesign`: phase-by-phase navigation is removed; nested cards, open issues and the responsive layout are restated for the single outline.

## Impact

New files:
- `Front/src/apps/coach/pages/game-model/components/GameModelReadingView.tsx` and `GameModelReadingView.module.css`
- `Front/src/apps/coach/pages/game-model/components/GameModelReadingNode.tsx` and `GameModelReadingNode.module.css` (renamed from `GameModelView.module.css`)
- `Front/src/apps/coach/pages/game-model/components/GameModelReadingIndex.tsx` and `GameModelReadingIndex.module.css`
- `Front/src/apps/coach/pages/game-model/components/gameModelNodeAddress.ts`
- `Front/src/apps/coach/pages/game-model/components/gameModelReadingTree.ts`
- `Front/src/apps/coach/pages/game-model/components/__tests__/GameModelReadingView.test.tsx`, `gameModelNodeAddress.test.ts` and `gameModelReadingTree.test.ts`

Modified files:
- `Front/src/apps/coach/pages/game-model/GameModel.tsx`
- `Front/package.json`

Removed files:
- `Front/src/apps/coach/pages/game-model/components/GameModelView.tsx`
- `Front/src/apps/coach/pages/game-model/components/GameModelTree.tsx` and `GameModelTree.module.css`
- `Front/src/apps/coach/pages/game-model/components/__tests__/GameModelView.test.tsx` and `GameModelTree.test.tsx`

Known limitations: the PDF export keeps exporting the full model whatever the search or depth, and the new view is more new surface than evolving the previous one. No backend change.

Out of scope: design.md, tasks.md, implementation.md — not generated by /sai-backfill

## Request Additional Notes

Undecided: the initial expand and collapse state when the view opens, and whether it is remembered between visits (affects E8 and E10).
