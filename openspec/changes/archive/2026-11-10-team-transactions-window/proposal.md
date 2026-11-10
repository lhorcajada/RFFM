## Why

Today the piggy-bank icon in the coach header opens the sanctions page, and the team's money is spread over four unrelated screens (sanctions, lottery, quiniela, quiniela wallet) with no single view. Issue #8 asks for one window that lists every team transaction with a payment status, so the coach can see at a glance what is paid and what is still owed.

## What Changes

- Add a read-only endpoint `GET /api/catalog/team/{teamId}/transactions` that merges, in memory, the team's sanctions, lottery books, quiniela tickets, quiniela wallet top-ups and charges, and the quiniela-originated team-fund movements into one list of transactions. Each transaction has a type, person, amount, date, description and a typed status (`Pending` or `Paid`). The list is ordered by date, newest first, and can be filtered by `status` and `type`.
- Add a new coach page at `/coach/transactions` that shows the transactions as stacked responsive cards (no table), with status and type filters and an empty-list message.
- Change the header piggy-bank icon so it opens `/coach/transactions?teamId=<id>` instead of the sanctions page. The sanctions button and the side menu keep opening `/coach/sanctions`.
- Restrict the endpoint to users who belong to the requested team; a foreign team returns access denied as `ProblemDetails`.
- No tables, columns or migrations are created or changed. Payment flows are not touched. Mobile is out of scope.

## Capabilities

### New Capabilities
- `team-transactions-list`: read-only, filterable list of the team's sanctions, lottery books, quiniela tickets, wallet top-ups and wallet charges (plus quiniela fund movements) with a two-value payment status, exposed by a new endpoint and shown in a new coach page.

### Modified Capabilities
- `team-fund`: the requirement "Team fund balance icon is visible to every user in the app header" changes its click target from the sanctions page to the new team transactions page. This delivers the block's `team-fund-entry-point` capability.

## Impact

- Backend (`Back/ExtractionApi`): one new feature file `Features/Coaches/Teams/Queries/GetTeamTransactions.cs`; reads `TeamPlayerSanction`, `LotteryCampaign`/`LotteryBook`, `QuinielaJornada`/`QuinielaTicket`, `QuinielaWallet`/`QuinielaWalletMovement` and `TeamFundMovement` through `AppDbContext` with `AsNoTracking()`. No schema change, no migration. API version bump (`feat`).
- Frontend (`Front`): new page `apps/coach/pages/transactions/Transactions.tsx` with its CSS Module, new `apps/coach/services/transactionService.ts`, a lazy route in `apps/coach/routes.tsx`, and the `handleOpenTeamFund` navigation change in `shared/components/ui/AppHeader/AppHeader.tsx`. Web version bump (`feat`).
- Existing AppHeader tests that assert the piggy-bank navigation to sanctions need the new target.
- Mobile and the sanctions, lottery and quiniela write flows are unchanged.

## Proposal Research Documentation

**Local files**:
- Front/src/shared/components/ui/AppHeader/AppHeader.tsx
- Front/src/shared/hooks/useTeamFundBalance.ts
- Front/src/apps/coach/pages/sanctions/Sanctions.tsx
- Front/src/apps/coach/routes.tsx
- Front/src/apps/coach/constants/featureRoutes.ts
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Teams/Queries/GetTeamFund.cs
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Players/Commands/SetPlayerSanction.cs
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Quiniela/QuinielaSupport.cs
- Back/ExtractionApi/src/RFFM.Api/Domain/Entities/TeamPlayers/TeamPlayerSanction.cs
- Back/ExtractionApi/src/RFFM.Api/Domain/Entities/Teams/LotteryBook.cs
- Back/ExtractionApi/src/RFFM.Api/Domain/Entities/Teams/LotteryCampaign.cs
- Back/ExtractionApi/src/RFFM.Api/Domain/Entities/Teams/QuinielaTicket.cs
- Back/ExtractionApi/src/RFFM.Api/Domain/Entities/Teams/QuinielaJornada.cs
- Back/ExtractionApi/src/RFFM.Api/Domain/Entities/Teams/QuinielaWallet.cs
- Back/ExtractionApi/src/RFFM.Api/Domain/Entities/Teams/QuinielaWalletMovement.cs
- Back/ExtractionApi/src/RFFM.Api/Domain/Entities/Teams/QuinielaEnums.cs
- Back/ExtractionApi/src/RFFM.Api/Domain/Entities/Teams/TeamFundMovement.cs
- Back/ExtractionApi/src/RFFM.Api/Domain/Entities/Teams/TeamFundMovementSource.cs
- openspec/specs/team-fund/spec.md

**External URLs**:
- https://github.com/lhorcajada/RFFM/issues/8

## Additional Notes

- `GetTeamFund` is `RequireAuthorization()` only: it has no team-membership check and no cache (`ICacheRequest`/`IInvalidateCacheRequest` are not used by the sanctions, lottery, quiniela or fund features). The block's I4 premise ("same access control and cache policy as `GetTeamFund`") does not hold for either. The specs follow E9 (membership check, foreign team denied) and leave caching to design, which may omit it. The existing team-scoped denial pattern is `QuinielaSupport.RequireRoleAsync` (`UserTeams` roles Coach, Player, FamilyPlayer, or a club coach/directive), which throws `ForbiddenAccessException`.
- Type grouping chosen for the spec: `Sanction`, `Lottery`, `Quiniela` (tickets plus `QuinielaFund`/`QuinielaDonation` fund movements), `WalletTopUp` (`QuinielaWalletMovementType.TopUp`) and `WalletCharge` (`TicketCharge`). Other wallet movement types (`Adjustment`, `TicketRefund`, `Prize`, `Donation`) are not listed; the donation already appears through its `QuinielaDonation` fund movement.
- A ticket paid from the wallet appears twice by design: once as the `Quiniela` ticket and once as the `WalletCharge` movement.
- Only sanctions with a fine greater than zero are money transactions; sanctions without a fine are not listed. The existing sanction `status` (`Pending`/`Fulfilled`) describes the sporting punishment, not payment, and is unrelated to the new payment status.
- Dates: entities carry no creation timestamp, so an unpaid quiniela ticket takes its jornada's payment deadline (`QuinielaRound.PaymentDeadlineUtc`, read from the federation database) as its date; the other types use `StartDate`, `ReturnedOn`/`DeliveredOn`, `PaidAt` or `OccurredAt` as the spec states.
- Amounts: a sanction uses its `Fine` (pending amount `Fine - AmountPaid`); a lottery book uses `TicketPrice * TicketsPerBook` until returned and `AmountReturned` afterwards; a quiniela ticket uses the jornada `Price`; wallet and fund movements use the absolute value of their `Amount`.
