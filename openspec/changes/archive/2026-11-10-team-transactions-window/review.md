# Code Review — Team Transactions Window

**Reviewed:** `main` 26c0aba2..f7724308 · 2026-11-09

## Security Surface Triage

- **Surface touched:** Yes

---

## Performance Surface Triage

- **Surface touched:** Yes

---

## Accessibility Surface Triage

- **Surface touched:** Yes

---

## Findings

### Critical

None.

### High

None.

### Medium

None.

### Low

#### L1 — FamilyPlayer access path is not tested
- **Location:** `Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/GetTeamTransactionsHandlerTests.cs:103-136`
- **Problem:** The access requirement names a user linked as "Family member", but the tests cover only Player (`Handle_PlayerOfTheTeam_ReadsTheTeamTransactions`), club coach and a foreign user. The FamilyPlayer path runs through the same `QuinielaSupport.ParticipantRoles` array, so regression risk is low. Still, a change to that shared array would go unnoticed here.
- **Suggested fix:** Add `Handle_FamilyPlayerOfTheTeam_ReadsTheTeamTransactions`, which seeds a `UserTeams` row with `Membership.FamilyPlayer` and asserts the list is returned.

#### L2 — Endpoint metadata documents only the 200 response
- **Location:** `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Teams/Queries/GetTeamTransactions.cs:41`
- **Problem:** `.Produces<IReadOnlyList<TeamTransactionDto>>()` is the only response declaration. The endpoint also returns 400 (`Results.ValidationProblem`), 401 and 403 ProblemDetails. `dotnet.md` §2.4 asks for the status codes to be documented. Sibling usage is mixed: `GetTeamFund` declares none, `GetQuinielaWallets` declares 403.
- **Suggested fix:** Add `.ProducesValidationProblem()`, `.ProducesProblem(StatusCodes.Status401Unauthorized)` and `.ProducesProblem(StatusCodes.Status403Forbidden)`.

#### L3 — Participant names load even when nothing needs them
- **Location:** `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Teams/Queries/GetTeamTransactions.cs:107-108`
- **Problem:** `QuinielaSupport.LoadParticipantsAsync` always runs, and it issues several queries (`UserTeams`, `UserPersonalData`, `TeamPlayerFamilyMembers`). When `type=Sanction` or `type=Lottery`, both the ticket list and the wallet list are empty, so those round-trips return nothing useful.
- **Suggested fix:** Skip the call when the combined user-id list is empty and use an empty dictionary instead.

#### L4 — Users without personal data show "Sin nombre" instead of their username
- **Location:** `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Teams/Queries/GetTeamTransactions.cs:70`, `:107`
- **Problem:** The handler calls `LoadParticipantsAsync` without the optional `identityDb` argument. Sibling quiniela endpoints (`GetQuinielaWallets`, `SetQuinielaTicketPayment`, `GetQuinielaPayments`) pass it. Without it, the username fallback is skipped. A participant with no `UserPersonalData` and no family-member link therefore shows as "Sin nombre" on this page but by username on the quiniela screens.
- **Suggested fix:** Inject `IdentityDbContext` into the handler and pass it to `LoadParticipantsAsync`, matching the siblings. Update the `interfaces.md` handler signature to match.

#### L5 — 403 detail text refers to the quiniela (EXCLUDED: cosmetic API text; fix means changing a shared quiniela helper for no user-visible gain)
- **Location:** `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Teams/Queries/GetTeamTransactions.cs:86`
- **Problem:** The handler reuses `QuinielaSupport.RequireRoleAsync`, which throws `ForbiddenAccessException("No tienes permiso para esta acción de la quiniela del equipo.")` (`QuinielaSupport.cs:176`). The transactions endpoint therefore returns a 403 ProblemDetails that talks about the quiniela. The web page shows its own static error, so only API consumers see this. The impact is cosmetic.
- **Suggested fix:** Add an optional message parameter to `RequireRoleAsync`, or catch the exception and rethrow it with a transactions-specific message.

#### L6 — Card styles use undefined CSS custom properties (EXCLUDED: same pattern already used by other coach cards; the fix is a shared theme decision outside this change)
- **Location:** `Front/src/apps/coach/pages/transactions/components/TransactionCard.module.css:16`, `:21`, `:25`, `:31`, `:37`, `:47`
- **Problem:** `--rffm-muted` and `--rffm-text` are defined nowhere in `Front/src`. The hardcoded fallbacks (`#a59f9f`, `#f0f0f0`) therefore always apply. In effect these are new hardcoded colors, which `react.md` §5 forbids. `PlayerCard.module.css` and other coach CSS share the same pattern, so the problem predates this change.
- **Suggested fix:** Switch to tokens that exist (for example `--rffm-text-primary` and a defined secondary-text token), or define `--rffm-text`/`--rffm-muted` once in the `:root` block of `muiGameTheme.ts` so every card using them picks them up.

#### L7 — Status filter labels differ from design Decision 9 (EXCLUDED: wording matches the sanctions page naming; the spec does not fix labels)
- **Location:** `Front/src/apps/coach/pages/transactions/Transactions.tsx:23-27`
- **Problem:** Design Decision 9 names the status filters "Todos / Pendiente de pago / Pagado". The code uses `"Todas"`, `"Pendientes"` and `"Pagadas"`. The spec does not fix the filter labels, so this is a wording drift from the design, not a spec violation.
- **Suggested fix:** Align the labels with Decision 9, or amend Decision 9 to record the chosen wording.

#### L8 — Type labels are kept in two maps (EXCLUDED: plural chips versus singular card labels are intentional; a shared map is a refactor with no behavior change)
- **Location:** `Front/src/apps/coach/pages/transactions/Transactions.tsx:29-36`, `Front/src/apps/coach/pages/transactions/components/TransactionCard.tsx:14-20`
- **Problem:** The page's `TYPE_FILTER_OPTIONS` and the card's type-label map both translate `TransactionType` independently. The wording already differs ("Recargas"/"Cargos" against the card's singular labels). Plural filter chips against singular card labels may be intentional, but a renamed or added type has to be updated in two places.
- **Suggested fix:** Export one `TransactionType` → `{ singular, plural }` label map, for example from `transactionService.ts` or a small constants module next to the page, and derive both lists from it.

#### L9 — Deadline test computes its expectation with the production helper (EXCLUDED: the helper has its own unit tests; the literal depends on a timezone-sensitive fixture)
- **Location:** `Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/GetTeamTransactionsHandlerTests.cs:364`
- **Problem:** `Assert.Equal<DateTime?>(QuinielaSchedule.PaymentDeadlineUtc(new DateOnly(2026, 11, 7)), row.Date);` derives the expected value from the same helper the handler reaches through `QuinielaRound.PaymentDeadlineUtc`. A regression in the deadline rule would move both sides together and the test would still pass. The test also assumes silently that the seeded matches start on 2026-11-07.
- **Suggested fix:** Assert a literal UTC instant for the expected Friday 23:59 Madrid deadline, and name the fixture's first match date next to it.

#### L10 — WalletCharge person is not asserted
- **Location:** `Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/GetTeamTransactionsHandlerTests.cs:458-463`
- **Problem:** `Handle_TicketPaidFromWallet_IsListedAsTicketAndAsWalletCharge` checks the charge row's status, amount and date but not `PersonName`. The spec requires the wallet owner as the person for `WalletCharge`. The top-up test covers the same `WalletRow` path, so this is a gap in the assertion only.
- **Suggested fix:** Add `Assert.Equal(<owner name>, chargeRow.PersonName);`.

#### L11 — Forbidden-response leak check is a weak substring test
- **Location:** `Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/GetTeamTransactionsEndpointTests.cs:194`
- **Problem:** `DoesNotContain("Ana", body)` checks only that a three-letter name is absent. A 403 body carries no transaction data in any case, so the assertion passes trivially and would not catch a leak of other fields.
- **Suggested fix:** Parse the body as ProblemDetails, assert `status == 403`, and assert the body is not a JSON array.

#### L12 — "Endpoint does not modify data" scenario has no test
- **Location:** `Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/GetTeamTransactionsEndpointTests.cs` (general)
- **Problem:** The spec scenario "Endpoint does not modify data" (repeated calls change no row) has no test. The handler is plainly read-only (`AsNoTracking()`, no `SaveChangesAsync`), so regression risk is low, but the scenario is uncovered.
- **Suggested fix:** Call the endpoint twice and assert that the row counts (or the `UpdatedOn` values) of the seeded sanction, book, ticket and wallet movement are unchanged.

#### L13 — Side-menu sanctions entry is not tested (EXCLUDED: the diff does not touch the side menu; the badge target is already tested)
- **Location:** `Front/src/shared/components/ui/AppHeader/__tests__/AppHeader.teamFundBalance.test.tsx` (general)
- **Problem:** The `team-fund` delta scenario "Sanctions entry points keep going to sanctions" covers both the pending-sanctions icon and the side-menu sanctions entry. `AppHeader.pendingSanctionsBadge.test.tsx` covers the icon. No test asserts that the side-menu entry still targets `/coach/sanctions`.
- **Suggested fix:** Add a test that asserts the side-menu sanctions entry navigates to `/coach/sanctions`.

#### L14 — File manifests list an untracked `package-lock.json` (EXCLUDED: documentation wording in uncommitted plan files; no code effect)
- **Location:** `openspec/changes/team-transactions-window/design.md:40`, `openspec/changes/team-transactions-window/tasks.md:50`
- **Problem:** Both manifests list `M Front/package-lock.json (Step 3)`. `Front/.gitignore` ignores that file, so it can never show as modified in the diff. On disk its version (1.116.0) matches `Front/package.json`. The Manual Verification step that compares the two files still works locally, but the manifest entry is misleading.
- **Suggested fix:** Remove `Front/package-lock.json` from both manifests, and reword the manual check as a local-only comparison.

### Questions

#### Q1 — Paid ticket without `PaidAt`
- **Location:** `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Teams/Queries/GetTeamTransactions.cs:230`
- **Question:** A ticket whose payment status is `Paid` but whose `PaidAt` is null gets a null date and is ordered after every dated transaction. `MarkPaid` always sets `PaidAt`, so this can happen only for legacy or backfilled rows. The spec defines the date as `PaidAt` when paid, with no fallback. Should such rows fall back to the jornada payment deadline, or is the undated placement acceptable?

---

Summary: Critical=0 High=0 Medium=0 Low=14 Questions=1
