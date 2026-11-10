## Step 1: Team transactions endpoint with the API version bump

- [x] Step 1: Team transactions endpoint with the API version bump

**Routing**: category=backend · context=large · difficulty=high

**Files Affected**:
- A Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Teams/Queries/GetTeamTransactions.cs
- A Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/GetTeamTransactionsHandlerTests.cs
- A Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/GetTeamTransactionsEndpointTests.cs
- M Back/ExtractionApi/Directory.Build.props

**What Will Be Done**: Create the vertical-slice module following `GetTeamFund.cs` (literal route, `RequireAuthorization()`, projected `AsNoTracking()` reads), with the query record, `TransactionType`/`TransactionStatus` enums, `TeamTransactionDto` and the handler. The endpoint parses `status` and `type` into closed sets and returns `ValidationProblem` for anything else, as `SetPlayerSanction.cs` does for its enum parse. The handler calls `QuinielaSupport.RequireRoleAsync` with `ParticipantRoles` before reading, then builds one private row record per source and merges them: `Sanction` (fine greater than zero) and `Lottery`, with player names from the `TeamPlayer` -> `Player` join used in `GetQuinielaWallets.cs`; `Quiniela` (tickets of the team's jornadas plus fund movements with source `QuinielaFund`/`QuinielaDonation`, never `SanctionPayment`), `WalletTopUp` and `WalletCharge` (movement types `TopUp`/`TicketCharge` of the team's wallets), with names from `QuinielaSupport.LoadParticipantsAsync` resolved once per request. The unpaid-ticket date comes from batch-loading the valid `RffmMatch` rows of the needed rounds from `FederationDbContext` (the pattern in `QuinielaLifecycle.cs`) and feeding the earliest date to `QuinielaSchedule.PaymentDeadlineUtc`, reusing `QuinielaRound` when its shape fits. Skip sources the `type` filter excludes, then filter and order the list (date descending, undated last, deterministic tie-break). Bump the API minor version in `Directory.Build.props` (`feat`, per `.claude/rules/git.md` 2.4). Rules come from `openspec/changes/team-transactions-window/specs/team-transactions-list/spec.md`. Build it source group by source group, each test-first, so the single commit stays reviewable.

**Testing Strategy**: Direct-handler integration tests on the real PostgreSQL fixture, in the style of `GetTeamFundHandlerTests.cs` and the `QuinielaTestSupport` helpers (`SeedJornadaAsync`, `SeedTicketAsync`, round and match seeding, `ClockAt`). Write first, per the spec scenarios: access (member allowed, club coach allowed, other-team user forbidden), empty list, each source's status, amount and date rules, the no-deadline undated ticket, ticket paid from the wallet appearing as ticket and charge, excluded wallet movement types and excluded `SanctionPayment` movement, mixed-type ordering, both filters and their combination, and and the SmartEnum comparisons translating in EF. Behavior that exists only in the endpoint (unknown or numeric `status`/`type` returning 400 ProblemDetails before the query is sent, and the 401 for an anonymous caller) cannot be observed from a direct-handler test, so it is verified in a separate endpoint-level test class, `GetTeamTransactionsEndpointTests`, over the real HTTP pipeline in the existing style of `GetTeamSanctionsEndpointTests.cs` (`[Collection(PostgresCollection.Name)]`, in-test authentication handler, real PostgreSQL). Run only the two new test classes.

**Existing Tests Broken**: None

## Step 2: Coach transactions page, service and route

- [x] Step 2: Coach transactions page, service and route

**Routing**: category=frontend-ui · context=medium · difficulty=medium

**Files Affected**:
- A Front/src/apps/coach/services/transactionService.ts
- A Front/src/apps/coach/pages/transactions/Transactions.tsx
- A Front/src/apps/coach/pages/transactions/Transactions.module.css
- A Front/src/apps/coach/pages/transactions/components/TransactionCard.tsx
- A Front/src/apps/coach/pages/transactions/components/TransactionCard.module.css
- A Front/src/apps/coach/pages/transactions/__tests__/Transactions.test.tsx
- M Front/src/apps/coach/routes.tsx

**What Will Be Done**: Add `transactionService.ts` in the style of `teamFundService.ts` (shared Axios client, exported `type`s) but throwing on failure. Build `TransactionCard` after `SanctionCard` (MUI `Paper` plus status `Chip`, CSS Module with the existing `--rffm-*` tokens, no table). Build the page after `Sanctions.tsx`: team from the `teamId` query parameter, falling back to `shared/hooks/resolveUserTeamId`, status and type filter button rows that re-request the list, empty-state and error handling through the `rffm.show_snackbar` bus plus an inline message. Register a lazy `/coach/transactions` route in `routes.tsx` wrapped in `RequireFeaturePermission` with `COACH_FEATURE_ROUTES.Sanctions`. UI rules come from the `team-transactions-list` spec (client requirement) and `.claude/rules/react.md`.

**Testing Strategy**: Vitest and Testing Library with the service mocked (`vi.mock` before imports, `vi.clearAllMocks()` in `beforeEach`), following `Sanctions.statusFilter.test.tsx`. Write first: cards with translated «Pagado» / «Pendiente de pago» and the pending amount, status filter and type filter requests, empty-list message, error message with no cards on a rejected request, `teamId` from the query string and the fallback resolution. Reviewed `routes.tsx` consumers: no existing test imports the coach routes module, so the added route stays compatible. Run only the new test file.

**Existing Tests Broken**: None

## Step 3: Header piggy-bank opens the transactions page with the web version bump

- [x] Step 3: Header piggy-bank opens the transactions page with the web version bump

**Routing**: category=frontend-code · context=small · difficulty=low

**Files Affected**:
- M Front/src/shared/components/ui/AppHeader/AppHeader.tsx
- M Front/src/shared/components/ui/AppHeader/__tests__/AppHeader.teamFundBalance.test.tsx
- M Front/package.json
- M Front/package-lock.json

**What Will Be Done**: Change the navigation target of `handleOpenTeamFund` to `/coach/transactions?teamId=<id>`, keeping the pending-sanctions badge and side menu on `/coach/sanctions` (`openspec/changes/team-transactions-window/specs/team-fund/spec.md`). Bump the web minor version (`feat`) with `npm version <x.y.z> --no-git-tag-version` so `package.json` and `package-lock.json` stay equal.

**Testing Strategy**: Update the existing click assertion to the new target first (Red), then change the handler (Green). Reviewed consumers: `AppHeader.pendingSanctionsBadge.test.tsx` asserts the badge target `/coach/sanctions`, which does not change, so it stays compatible. Run the `AppHeader` tests directory only.

**Existing Tests Broken**:
- `Front/src/shared/components/ui/AppHeader/__tests__/AppHeader.teamFundBalance.test.tsx` — runtime

## Required Documentation

### Spec files
- openspec/changes/team-transactions-window/specs/team-transactions-list/spec.md
- openspec/changes/team-transactions-window/specs/team-fund/spec.md
- openspec/specs/team-fund/spec.md

### Local files
- openspec/changes/team-transactions-window/proposal.md — approved scope, capabilities and the research notes on dates and amounts.
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Teams/Queries/GetTeamFund.cs — vertical-slice pattern to imitate: literal route, authorization, projected read, SmartEnum `.Name` output.
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Quiniela/QuinielaSupport.cs — `RequireRoleAsync`, `ParticipantRoles`, `LoadParticipantsAsync` and round deadline derivation to reuse.
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Quiniela/QuinielaLifecycle.cs — batch load of `RffmMatch` rows by round ids to imitate.
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Quiniela/GetQuinielaWallets.cs — only `TeamPlayer` -> `Player` display-name join to imitate.
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Players/Commands/SetPlayerSanction.cs — enum query parsing with `ValidationProblem` 400 to imitate.
- Back/ExtractionApi/src/RFFM.Api/Domain/Entities/TeamPlayers/TeamPlayerSanction.cs — fine, amount paid, start date and team link for the sanction source.
- Back/ExtractionApi/src/RFFM.Api/Domain/Entities/Teams/LotteryBook.cs — delivered and returned dates (`DateOnly`) and amount returned for the lottery source.
- Back/ExtractionApi/src/RFFM.Api/Domain/Entities/Teams/LotteryCampaign.cs — team owner, ticket price and tickets per book.
- Back/ExtractionApi/src/RFFM.Api/Domain/Entities/Teams/QuinielaTicket.cs — paid date and persisted payment status; effective status is derived, not stored.
- Back/ExtractionApi/src/RFFM.Api/Domain/Entities/Teams/QuinielaJornada.cs — team owner, price and RFFM round key for tickets.
- Back/ExtractionApi/src/RFFM.Api/Domain/Entities/Teams/QuinielaWallet.cs — team and owner of wallets reached by movements.
- Back/ExtractionApi/src/RFFM.Api/Domain/Entities/Teams/QuinielaWalletMovement.cs — type, signed amount and occurred date of wallet movements.
- Back/ExtractionApi/src/RFFM.Api/Domain/Entities/Teams/QuinielaEnums.cs — SmartEnum payment status, method and movement types.
- Back/ExtractionApi/src/RFFM.Api/Domain/Entities/Teams/QuinielaSchedule.cs — `PaymentDeadlineUtc` computation to reuse for unpaid tickets.
- Back/ExtractionApi/src/RFFM.Api/Domain/Entities/Teams/QuinielaMatchValidity.cs — validity predicate for matches feeding the deadline.
- Back/ExtractionApi/src/RFFM.Api/Domain/Entities/Teams/TeamFundMovement.cs — fund movement amount, source and occurred date.
- Back/ExtractionApi/src/RFFM.Api/Domain/Entities/Teams/TeamFundMovementSource.cs — source values; `SanctionPayment` must be excluded.
- Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/AppDbContext.cs — DbSets for every source table.
- Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/GetTeamFundHandlerTests.cs — real-PostgreSQL direct-handler test style to imitate.
- Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/QuinielaTestSupport.cs — seeding helpers for users, jornadas, tickets and fixed clock.
- Back/ExtractionApi/Directory.Build.props — API version to bump.
- Front/src/shared/components/ui/AppHeader/AppHeader.tsx — `handleOpenTeamFund` navigation target to change.
- Front/src/shared/components/ui/AppHeader/__tests__/AppHeader.teamFundBalance.test.tsx — existing assertion on the old target; must be updated.
- Front/src/shared/components/ui/AppHeader/__tests__/AppHeader.pendingSanctionsBadge.test.tsx — badge target stays `/coach/sanctions`; compatibility check only.
- Front/src/shared/hooks/resolveUserTeamId.ts — default-exported team resolution for the page fallback.
- Front/src/apps/coach/routes.tsx — lazy route and `RequireFeaturePermission` wrapper pattern around the Sanctions route.
- Front/src/apps/coach/constants/featureRoutes.ts — Sanctions feature key reused for the guard.
- Front/src/apps/coach/components/RequireFeaturePermission.tsx — guard behavior: denial by missing feature row.
- Front/src/apps/coach/pages/sanctions/Sanctions.tsx — page layout, filter buttons, empty state and error handling to imitate.
- Front/src/apps/coach/pages/sanctions/components/SanctionCard.tsx — card, status chip and CSS tokens to imitate.
- Front/src/apps/coach/pages/sanctions/__tests__/Sanctions.statusFilter.test.tsx — Vitest mocking style for coach pages.
- Front/src/apps/coach/services/teamFundService.ts — service module style (shared client, exported types).
- Front/package.json — web version to bump.

### External URLs
None

## Implementation Context

**Stack**: .NET 9 ASP.NET Core Minimal API with Mediator v3, EF Core 9 on PostgreSQL (three DbContexts: `AppDbContext`, `FederationDbContext`, `IdentityDbContext`), xUnit tests on a real PostgreSQL fixture; React 19 with TypeScript strict, Vite 7, MUI v5, Axios, CSS Modules, Vitest and Testing Library (web version 1.115.0).

**Conventions**:
- Backend feature = one `IFeatureModule` file under `Features/Coaches/<Area>/Queries` with literal routes (no `MapGroup`), query record, nested `Handler`, DTOs; SmartEnum values are returned as `.Name` strings; reads use `AsNoTracking()`.
- Team membership is enforced with `QuinielaSupport.RequireRoleAsync` (throws `ForbiddenAccessException`, mapped to 403 ProblemDetails in `ServiceCollectionExtensions.cs`); the sanctions, lottery, quiniela and fund features do not use the cache interfaces.
- Domain enums such as payment status, payment method, movement type and fund source are SmartEnum classes, so EF filters compare with the constants; backend tests call handlers directly against the PostgreSQL container with the `QuinielaTestSupport` helpers.
- Web pages are lazy routes wrapped in `RequireFeaturePermission`, which allows non-admins only for an exact seeded feature-route string; services use the single Axios `client`, and cross-app notices go through the `rffm.show_snackbar` event.
- UI is responsive cards (MUI `Paper`/`Chip`) with CSS Modules and the `--rffm-*` custom properties, no tables; test names are Spanish sentences and `__tests__/` sits next to the component.

**Avoid**:
- Do not call `SaveChangesAsync()` or write any data in the transactions handler; it is read-only and adds no migration.
- Do not return an `Expired` status or raw strings for errors: status is only `Pending`/`Paid`, and errors are ProblemDetails.
- Do not add a new feature-route key, seed rows, caching, an Axios instance, a table, `styled()` or inline styles, or `window.confirm`.
- Do not let the service swallow request errors; the page must be able to show the load failure.

**Test Command**:
- Backend: `dotnet test Back/ExtractionApi/tests/RFFM.Api.Tests/RFFM.Api.Tests.csproj --filter FullyQualifiedName~<TestName>`
- Frontend: `npx vitest run --config Front/vitest.config.ts --root Front <path>` (full web suite: `npm --prefix Front run test -- --run`)
