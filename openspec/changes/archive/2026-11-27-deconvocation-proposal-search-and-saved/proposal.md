## Why

The deconvocation proposal gives one answer and cannot be explored: to know who has never been left out, or who has been left out the least, the coach has to read every card. Alternatives cannot be kept either, so only one scenario can be compared at a time and it is lost on leaving the page.

## What Changes

- The proposal view gets a player search: by name, with quick filters «Nunca desconvocados» and «Sin decisión técnica», counting league matches only.
- The results can be sorted by proposal order, fewest deconvocations or most matchdays without a technical decision.
- The coach can save the current proposal of a match under a name; several saved proposals can coexist per match, stored in the server.
- A saved proposal can be applied (its players are deconvoked) after a confirmation, or deleted. Applying does not publish the convocation: it stays a draft until «Publicar convocatoria».

## Capabilities

### New Capabilities
- `deconvocation-proposal-search`: search, filter and sort the players of the deconvocation proposal.
- `deconvocation-saved-proposals`: save, list, apply and delete candidate proposals of a match.

### Modified Capabilities

## Impact

- Web: `DeconvocationProposalView`, `ConvocationTab`, `ConvocationMatchDetail`, a new service and new components.
- API: new endpoints `GET`, `POST` and `DELETE` under `/api/events/{eventId}/deconvocation-proposals`.
- Database: new table in `AppDbContext` with one EF migration.
- No change to the proposal engine, to applying the current proposal or to publishing a convocation.

## Proposal Research Documentation

**Local files**:
- Front/src/apps/coach/pages/convocations/components/DeconvocationProposalView.tsx
- Front/src/apps/coach/pages/convocations/components/ConvocationTab.tsx
- Front/src/apps/coach/pages/convocations/ConvocationMatchDetail.tsx
- Front/src/apps/coach/pages/convocations/hooks/useManualDeconvocationOrder.ts
- Front/src/apps/coach/pages/convocations/hooks/useConvocationManagement.ts
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Convocations/PublishConvocation.cs
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Availability/AvailabilityAuthorization.cs
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/DeconvocationRules/
- Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/DeconvocationRulesHandlerTests.cs
- openspec/specs/deconvocation-proposal-ui/spec.md

**External URLs**:
- None

## Additional Notes

- User decisions: filters and sorting (no free-text AI queries); server storage; applying a saved proposal only deconvokes and never publishes.
