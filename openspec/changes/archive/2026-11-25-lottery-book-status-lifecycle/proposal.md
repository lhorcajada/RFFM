> **⚠ POST-HOC RECORD** — This proposal was backfilled after implementation against a user-supplied statement of intent. It describes a decision already made, not one being proposed.

## Why

A lottery book (taco) only existed once it was delivered to a player, its last ticket was computed from the campaign-wide tickets-per-book size, and the delivery of money to the club was a single campaign-level record. Coaches therefore could not track where each physical book was: printed but not handed out, assigned, with the player, back with the coach, or handed to the club.

## What Changes

- Each `LotteryBook` now has a stored `Status` with five steps in a fixed order: `Unassigned`, `Assigned`, `DeliveredToPlayer`, `ReturnedToCoach`, `DeliveredToClub`. The status is persisted as text and is no longer derived from `AmountReturned`.
- A book moves forward one step at a time (`PUT .../books/{bookId}/status` with the step's date and, for the return, the amount) and goes back one step with an explicit undo (`DELETE .../books/{bookId}/status`) that clears only the data of the undone step. Each wrong-order move fails with its own error code.
- Books can exist without a player: `POST .../books/batch` creates between 1 and 200 consecutive unassigned books after the last existing book, sized by the campaign's tickets per book.
- `POST .../books` now assigns a book: with a `bookId` it assigns an existing unassigned book, without one it creates a book already assigned. It stores the book number, the first ticket and a stored last ticket; the last ticket cannot be lower than the first, book numbers stay unique and ranges cannot overlap.
- `PUT .../books/{bookId}` edits only the three numbers, and only before the book is delivered to the player. Only an unassigned book can be deleted, and a campaign can be deleted while all its books are unassigned.
- The campaign's tickets per book becomes only the suggested size and can change when books exist; the ticket price stays locked once books exist.
- Club delivery is recorded per book (`ClubDeliveredOn`). The campaign-level `ClubDeliveredOn` / `ClubDeliveredAmount` and the `club-delivery` endpoints are removed; the campaign response carries a `clubDelivery` summary computed from the books.
- Campaign totals count books from `DeliveredToPlayer` onward and use each book's own ticket count. The team transactions list includes only books delivered to a player or later, with the pending amount computed from the book's own ticket count.
- The migration `LotteryBookStatusLifecycle` makes `TeamPlayerId` and `DeliveredOn` optional, adds `LastTicketNumber`, `Status` and `ClubDeliveredOn`, fills them from the existing data, moves the campaign's club delivery date onto its returned books and drops the campaign's club delivery columns.
- Coach app (`Front/src/apps/coach/pages/lottery/`): the «Entregar taco» sheet is replaced by an «Asignar taco» sheet with player, book number, first and last ticket and suggested values; a «Crear tacos» dialog creates books in bulk; a «Tacos sin asignar» panel lists unassigned books with assign and delete actions; each book card shows its status translated to Spanish and offers the next step (deliver with a date, return with amount and date, deliver to the club with a date) and an undo confirmed with `ConfirmDialog`. The player filter chips follow the least advanced status of each player's books, and the club delivery card shows the per-book summary.
- Scope drift (not an implementation error): a campaign whose books are all unassigned can be deleted; the bulk creation is capped at 200 books per call; the assign endpoint without `bookId` creates the book already assigned; the team transactions list filters lottery books by status and sizes the pending amount by the book's own range; the player filter chips are keyed by book status.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `team-lottery`: books gain a five-step status lifecycle with undo, bulk creation of unassigned books, assignment with a stored first and last ticket, per-book club delivery replacing the campaign settlement, updated totals, deletion rules and coach page.
- `lottery-redesign`: the visible book status label shows the five statuses in Spanish.
- `team-transactions-list`: lottery transactions come only from books delivered to a player or later, and the pending amount uses the book's own ticket count.

## Impact

- New files: `Back/ExtractionApi/src/RFFM.Api/Domain/Entities/Teams/LotteryBookStatus.cs`, `Back/ExtractionApi/src/RFFM.Api/Infrastructure/Migrations/20261125083504_LotteryBookStatusLifecycle.cs` (+ `.Designer.cs`), `Front/src/apps/coach/pages/lottery/components/AssignBookSheet.tsx`, `BookDateSheet.tsx`, `CreateBooksDialog.tsx`, `LotteryUnassignedBooks.tsx` (+ `.module.css`), `components/__tests__/AssignBookSheet.test.tsx`.
- Renamed slices in `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Lottery/`: `DeliverLotteryBook.cs` → `AssignLotteryBook.cs`, `ReturnLotteryBook.cs` → `AdvanceLotteryBookStatus.cs`, `RecordLotteryClubDelivery.cs` → `CreateLotteryBooks.cs`, `UndoLotteryBookReturn.cs` → `UndoLotteryBookStatus.cs`.
- Deleted files: `Features/Coaches/Lottery/UndoLotteryClubDelivery.cs`, `Front/src/apps/coach/pages/lottery/components/DeliverBookSheet.tsx`.
- Modified files: `LotteryBook.cs`, `LotteryCampaign.cs`, `ErrorCodes.cs`, `DeleteLotteryBook.cs`, `UpdateLotteryBook.cs`, `LotteryCampaignMapping.cs`, `GetTeamTransactions.cs`, `LotteryCampaignEntityConfiguration.cs`, `AppDbContextModelSnapshot.cs`, `Lottery.tsx`, `LotteryCampaignDialog.tsx`, `LotteryClubDeliveryCard.tsx`, `LotteryPlayerCard.tsx`, `lotteryHelpers.ts`, `Front/src/apps/coach/services/lotteryService.ts`, and the lottery backend and frontend tests.
- API contract: `LotteryBookDto` gains `status` and `clubDeliveredOn` and makes `teamPlayerId` and `deliveredOn` nullable; `LotteryCampaignDto` replaces `clubDeliveredOn` / `clubDeliveredAmount` with `clubDelivery`. The `books/{bookId}/return` and `club-delivery` routes are replaced by `books/{bookId}/status` and `books/batch`.
- Mobile has no lottery code and is not affected.
- Known limitation: the new handlers call `db.SaveChangesAsync` like every sibling lottery handler, because the project has no save pipeline behavior.

Out of scope: design.md, tasks.md, implementation.md — not generated by /sai-backfill
