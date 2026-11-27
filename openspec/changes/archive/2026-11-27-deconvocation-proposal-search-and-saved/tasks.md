## Planning Status

Based on proposal.md, specs/ and design.md. Steps are implemented; only the visual check is pending. Every step is test-first (Red → Green).

## Step 1: Search, filter and sort proposal players

- [x] 1.1 Tests, then `utils/proposalSearch.ts` (filters, sorts, accents, league only, one entry per player).
- [x] 1.2 Tests, then `ProposalSearch` and `ProposalSearchResults` with their CSS Modules.
- [x] 1.3 Tests, then wire them into `DeconvocationProposalView` (default view unchanged, hidden in estimates).

## Step 2: API for saved proposals

- [x] 2.1 Handler tests (Postgres): save, list, delete, limit, validation, foreign player, authorization, wrong match, cascade.
- [x] 2.2 Entity, EF configuration, `DbSet`, error codes and the three feature slices.
- [x] 2.3 EF migration for `DeconvocationSavedProposals`.
- [x] 2.4 Bump the API version (minor).

## Step 3: Save, apply and delete from the web

- [x] 3.1 Tests, then `deconvocationProposalService` and `useSavedProposals`.
- [x] 3.2 Tests, then `SaveProposalDialog` and the «Guardar propuesta» action.
- [x] 3.3 Tests, then `SavedProposals` (cards, «Aplicada», unavailable players, apply and delete confirmations).
- [x] 3.4 Wire into `ConvocationTab` (`ConvocationMatchDetail` needed no change).
- [x] 3.5 Bump the web version (minor).

## Step 4: Verification

- [x] 4.1 Run the affected web and API tests, `npm run build`, `dotnet build` and `openspec validate deconvocation-proposal-search-and-saved --strict`.
- [ ] 4.2 Visual check of the proposal view at 360px and on desktop.
