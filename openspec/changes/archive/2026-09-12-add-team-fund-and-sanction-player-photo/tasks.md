## 1. Domain — `TeamFundMovement`

- [x] 1.1 Add a failing xUnit test (`tests/.../TeamFundMovementTests.cs` or nearest sibling
      convention) asserting `TeamFundMovement.Create(...)` requires a non-empty `TeamId`, rejects
      `Amount == 0` unless it's an explicit correction to zero (per design.md Decisión 2, allow
      zero only via an `AdjustAmount`-style method, not `Create`), and defaults `OccurredAt` to
      UTC now when not supplied.
- [x] 1.2 Create `Domain/Entities/Teams/TeamFundMovement.cs` (`BaseEntity`, private constructor +
      `Create()` factory, mirroring `TeamPlayerSanction.cs`'s shape): `TeamId`, `Amount`
      (`decimal`), `Source` (`TeamFundMovementSource` SmartEnum), `SourceSanctionId` (`string?`),
      `OccurredAt` (`DateTime`, UTC), `Description` (`string?`). Add an `AdjustAmount(decimal)`
      method (narrow, symmetric intent-revealing update — mirrors `MarkFulfilled`/`Reopen` on
      `TeamPlayerSanction`) used by the update-delta flow in task 3.
- [x] 1.3 Create `Domain/Entities/Teams/TeamFundMovementSource.cs` as an `Ardalis.SmartEnum`
      (mirrors `SanctionSportivePunishmentType.cs`) with values `SanctionPayment` and
      `ManualAdjustment` (the latter unused by any endpoint yet — see design.md Non-Goals).
- [x] 1.4 Add `TeamFundMovements` navigation collection to
      `Domain/Aggregates/UserClubs/Team.cs` (read-only collection backed by a private list, same
      pattern as other `Team` navigation collections).
- [x] 1.5 Run the domain tests until green.

## 2. Persistence

- [x] 2.1 Create
      `Infrastructure/Persistence/Configuration/Entities/TeamFundMovementEntityConfiguration.cs`
      (`IEntityTypeConfiguration<TeamFundMovement>`, discovered via reflection — do not register
      manually): FK to `Team`, `SmartEnum` conversion for `Source` (`SmartEnum.EFCore`, mirrors
      `TeamPlayerSanctionEntityConfiguration.cs`'s handling of `Category`/
      `SportivePunishmentType`), a unique filtered index on `SourceSanctionId` where not null
      (design.md Decisión 2: at most one `SanctionPayment` movement per sanction).
- [x] 2.2 Add `DbSet<TeamFundMovement> TeamFundMovements { get; set; }` to `AppDbContext.cs`
      (schema `app`, alongside `DbSet<TeamPlayerSanction>`).
- [x] 2.3 Generate the EF migration:
      `.\manage-migrations.ps1` (or `dotnet ef migrations add AddTeamFundMovements
      --startup-project ../RFFM.Host` from `Back/ExtractionApi/src/RFFM.Api`, per
      `.claude/rules/dotnet.md` if this repo's script wraps that) — confirm exact invocation
      against `manage-migrations.ps1`'s existing usage before running.
- [x] 2.4 `dotnet build` — migration compiles, no errors.

## 3. Wire `AmountPaid` into the fund (`SetPlayerSanction.cs`)

- [x] 3.1 Add a failing integration/handler test: creating a sanction with `Fine: 100,
      AmountPaid: 40` results in a `TeamFundMovement` row (`Amount: 40`, `Source:
      SanctionPayment`, `SourceSanctionId` = the new sanction's id) and
      `GET /api/catalog/team/{teamId}/fund` (task 4) returns `Balance: 40`.
- [x] 3.2 Add a failing test: creating a sanction with no `AmountPaid` (or `0`) creates no
      movement row and the fund balance is unaffected.
- [x] 3.3 Add a failing test: editing that sanction's `AmountPaid` from `40` to `70` updates the
      *same* movement row's `Amount` to `70` (not a second row) and the fund balance becomes `70`
      (design.md Decisión 2 — update in place, not append).
- [x] 3.4 Add a failing test: editing `AmountPaid` down from `70` to `30` reduces the fund balance
      by the difference (balance becomes `30`), proving the decrease case documented in
      design.md Decisión 2.
- [x] 3.5 Add a failing test: editing `AmountPaid` from a positive value to `null` sets the
      linked movement's `Amount` to `0` (row kept, not deleted) and the fund balance reflects the
      removal.
- [x] 3.6 Add a failing test: two independent sanctions on the same team each recording
      `AmountPaid` sum correctly into one shared team-level `Balance`.
- [x] 3.7 Add a failing test: deleting a `Pending` sanction that has a recorded `AmountPaid`
      zeroes out its linked `TeamFundMovement` (`Amount` set to `0`, row kept) and the fund
      balance reflects the reversal (design.md Decisión 2's Delete rule, confirmed with the user).
- [x] 3.8 Implement the delta logic inside `SetPlayerSanction.cs`'s `POST` and `PUT` handlers
      (design.md Decisión 2), right after the existing `ValidateAmountPaid` check and before
      `db.SaveChangesAsync(ct)`, using the already-injected `AppDbContext db` — look up any
      existing movement via `db.TeamFundMovements.FirstOrDefaultAsync(m => m.SourceSanctionId ==
      sanction.Id, ct)`, then either `Create` or `AdjustAmount` per task 1.2's factory/method.
- [x] 3.9 Implement the same zero-out in `SetPlayerSanction.cs`'s `DELETE` handler (task 3.7).
- [x] 3.10 Run all tests in this section until green; re-run the full `SetPlayerSanction`-related
      test suite to confirm no regressions to the existing sanction CRUD behavior.

## 4. New read endpoint

- [x] 4.1 Add a failing test for `GET /api/catalog/team/{teamId}/fund`: returns `Balance: 0` and
      an empty `Movements` array for a team with no movements; returns the correct summed
      `Balance` and populated `Movements` (ordered `OccurredAt desc`) once movements exist;
      accessible to every authenticated role (mirrors the existing sanctions GETs' openness).
- [x] 4.2 Create `Features/Coaches/Teams/Queries/GetTeamFund.cs` following the standard
      `IFeatureModule` + `IQueryApp`/`IRequestHandler` pattern already used by
      `GetTeam.cs`/`GetTeams.cs` in the same folder (design.md Decisión 3) —
      `WithTags(TeamConstants.TeamFeature)`.
- [x] 4.3 Run the new endpoint's tests until green.

## 5. Backend verification

- [x] 5.1 `dotnet build` — no errors/warnings introduced.
- [x] 5.2 `dotnet test` — full suite green, including all tests added above (2 pre-existing
      failures unrelated to this change: `AdnLegibleImporterFullDocumentSpotCheckTests` /
      `GameModelSeederRealDocumentTests`, a real-document Zona-parsing gap in
      `AdnLegibleImporter.cs`, untouched by this change — confirmed via `git status`).
- [x] 5.3 `openspec validate add-team-fund-and-sanction-player-photo --strict` — spec deltas
      (`specs/team-fund/spec.md` ADDED, `specs/player-sanctions/spec.md` MODIFIED) authored
      during task 9 (documentation follow-through); validates clean.

## 6. Frontend — sanctions summary header (front-specialist, separate session, TDD)

- [x] 6.1 Add a `teamFundService.ts` (or extend `teamplayerSanctionService.ts`) with a typed
      `getTeamFund(teamId): Promise<{ balance: number; movements: ... }>` call to
      `GET /api/catalog/team/{teamId}/fund`.
- [x] 6.2 Write Vitest coverage (Red) for three new summary cards in `Sanctions.tsx`'s header:
      total fined (`Σ` of `sanction.fine` across all rows), total pending (`Σ` of
      `pendingAmount`/computed fallback across all rows, matching the existing per-row fallback
      logic already in `Sanctions.tsx`), and team fund balance (from `getTeamFund`) — each
      rendered with an MUI icon (suggested, not prescriptive, per design.md Open Question 2:
      `Gavel`/`ReceiptLong` for total fined, `HourglassEmpty`/`PendingActions` for pending,
      `Savings`/`AccountBalanceWallet` for team fund).
- [x] 6.3 Implement the three cards (Green) inside `Sanctions.tsx`'s `ContentLayout`, above or
      alongside the existing table, using CSS Modules (`Sanctions.module.css`) per
      `.claude/rules/react.md` — no inline `style={{}}`, no `styled()`.
- [x] 6.4 Refactor/verify all tests green; `npm run build`.

## 7. Frontend — sanctioned player photo (front-specialist, separate session, TDD)

- [x] 7.1 Write a failing Vitest test asserting each sanction row renders an `<img>` with the
      resolved photo (or the `defaultAvatar` fallback) for its player.
- [x] 7.2 Implement by reusing the exact pattern documented in design.md Decisión 4: resolve
      `player.urlPhoto` via `playerService.fetchPlayerPhoto(url)` into a
      `Record<string, string | null>` keyed by `player.id` when rows load (mirrors `Squad.tsx`'s
      `playerPhotos` state), fall back to `assets/avatar.svg`, add a `.playerAvatar` rule to
      `Sanctions.module.css` sized for a table cell.
- [x] 7.3 Run tests until green; `npm run build`.

## 8. Frontend — team fund balance icon in `AppHeader` (front-specialist, separate session, TDD)

- [x] 8.1 Add a `useTeamFundBalance` hook (`Front/src/shared/hooks/useTeamFundBalance.ts`, mirrors
      `useMyPendingSanctionsCount.ts`'s shape) that resolves a `teamId` by trying, in order:
      `getMyProfile().teamId` (works for Player/FamilyMember, and any future role with a
      `UserProfile.TeamId`), then `configurationCoachService.getCurrent()?.preferredTeamId`
      (works for Coach). If neither resolves, `teamId` stays `null` and the hook is not visible —
      unlike the sanctions badge, this hook is **not gated by role**: any authenticated user whose
      account resolves to a team sees the balance. Once a `teamId` resolves, call
      `getTeamFund(teamId)` (existing `teamFundService.ts`) and expose `{ visible, balance,
      teamId }` (`visible` true once a numeric balance is loaded).
- [x] 8.2 Write Vitest coverage (Red) for the hook: resolves via profile teamId; falls back to
      coach preferred team when profile has none; stays not-visible when neither resolves; stays
      not-visible (fails silently) if `getTeamFund` errors.
- [x] 8.3 In `Front/src/shared/components/ui/AppHeader/AppHeader.tsx`, render a `SavingsIcon`
      (mirrors the icon chosen for the summary card in task 6) with the current balance (e.g. a
      `Tooltip`/small label showing `${balance} €`) next to the existing pending-sanctions
      `IconButton` — visible whenever `useTeamFundBalance().visible` is true, independent of
      `pendingSanctions.visible`. Clicking it navigates to `/coach/sanctions` (reuse
      `handleOpenSanctions`'s `teamId` query-param pattern) — same destination as the sanctions
      icon, since the fund is surfaced there.
- [x] 8.4 Write/extend Vitest coverage (Red) for `AppHeader.tsx`: the fund icon renders for a
      Coach-role user even when the pending-sanctions badge is hidden (not Player/FamilyMember),
      and is hidden when `useTeamFundBalance` resolves no team.
- [x] 8.5 Implement (Green), keeping `AppHeader.module.css` CSS Modules only (no inline
      `style={{}}`/`styled()`), then refactor and verify all tests green; `npm run build`.

## 9. Documentation follow-through

- [ ] 9.1 After implementation and verification, run
      `openspec archive add-team-fund-and-sanction-player-photo` per the
      `openspec-archive-change` skill, creating `specs/team-fund/spec.md` and updating
      `specs/player-sanctions/spec.md`'s Purpose section for the new `AmountPaid` side effect.
