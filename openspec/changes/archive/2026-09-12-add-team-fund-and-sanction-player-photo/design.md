## Context

`TeamPlayerSanction` (Back/ExtractionApi/src/RFFM.Api/Domain/Entities/TeamPlayers/TeamPlayerSanction.cs)
already carries `Fine` and `AmountPaid`, with `PendingAmount` computed at read time in
`SetPlayerSanction.cs`'s `ToResponse`. This change adds a second, independent concept: money the
team/club actually holds ("bolsa del equipo"), which today has no representation at all. The user
has explicitly said this must be its own persisted entity — not merely `Σ AmountPaid` recomputed
on the fly — because other income/expense sources (kit sales, sponsor contributions, other fines
categories, manual adjustments) are expected to feed it later. This iteration only wires the
*automatic* sanction-payment source; no manual-adjustment endpoint yet.

Separately, the sanctions list (`Front/src/apps/coach/pages/sanctions/Sanctions.tsx`) identifies
rows by player name/alias only. Every other roster-like screen in `Front/` already resolves and
shows a player photo through one consistent pattern (`PlayerResponse.urlPhoto` →
`playerService.fetchPlayerPhoto(url)` → object-URL `<img>`, falling back to
`assets/avatar.svg`). This change reuses that pattern rather than inventing a new one.

## Goals / Non-Goals

**Goals:**
- Persist a per-`Team` fund balance that updates automatically when a sanction's `AmountPaid` is
  recorded or changed (increase or decrease), including on edit.
- Expose a read endpoint the frontend can call for the sanctions header summary cards.
- Design the persistence shape so a future manual-adjustment endpoint and future non-sanction
  income/expense sources need no schema rework.
- Define the exact contract for reusing the existing player-photo pattern in the sanctions list,
  down to file paths and function signatures, so front-specialist does not have to re-discover it.

**Non-Goals:**
- No manual adjustment endpoint (add/subtract arbitrary amounts) in this iteration — deliberately
  deferred; only the data model needs to anticipate it.
- No UI for browsing the fund's movement history in this iteration (the read endpoint may still
  return it; the summary cards only need the current balance).
- No changes to `TeamPlayerSanction`'s own fields, validation, or `PendingAmount` computation —
  those are unaffected; this change only adds a side effect when `AmountPaid` changes.
- No club-level or cross-team aggregation — the fund is strictly per-`Team`.

## Decisions

### Decisión 1 — Ledger (`TeamFundMovement`) over a single `Balance` counter on `Team`

**Chosen: a new `TeamFundMovement` entity, one row per balance-affecting event, with the current
balance computed either at read time (`SUM(Amount)`) or maintained as a denormalized, always-
recomputable cache.**

Two options were evaluated:

1. **Simple counter**: add `decimal Balance` (or similar) directly on `Team`, incremented/
   decremented in place by `SetPlayerSanction.cs`.
   - Pros: trivial to implement and query; no new table; matches the "don't over-design for
     hypotheticals" principle in `CLAUDE.md` if the feature never grows.
   - Cons: the user has *explicitly* asked for room to grow (manual adjustments, other income
     sources) in this same request — not a speculative future. A bare counter gives no audit
     trail (which sanction contributed what, when), can't be corrected without ad-hoc SQL if it
     ever drifts from reality, and would force a breaking schema change (new table + backfill +
     migration of existing "logic" out of the counter) the moment a manual adjustment or a second
     source is added — which is exactly the scenario the user described as imminent.

2. **Ledger (`TeamFundMovement`)**: one immutable-ish row per movement
   (`TeamId`, `Amount` signed decimal, `Source` SmartEnum, `SourceSanctionId` nullable FK,
   `OccurredAt`, `Description`), balance = `SUM(Amount)` over the team's rows (optionally cached).
   - Pros: audit trail for free; a future manual-adjustment endpoint is just "insert a row with
     `Source: ManualAdjustment` and no `SourceSanctionId`"; a future non-sanction source is just a
     new `Source` enum value; editing a sanction's `AmountPaid` naturally becomes "insert a
     correcting delta row" (or update the existing sanction-linked row — see Decisión 2) without
     touching unrelated rows; balance is always re-derivable/self-healing.
   - Cons: one more table, one more join for reads; balance requires either a `SUM` query (cheap
     at this data volume — a handful of sanctions per team per season) or a maintained cache.

**Decision: ledger.** This is not speculative over-engineering — the user named the two concrete
future features (manual adjustment, other income sources) as the reason for this choice *in the
same request*, which is precisely the case `CLAUDE.md`'s "don't over-design for hypotheticals"
carve-out doesn't apply to (it's a stated near-term need, not a hypothetical). Given expected
volume (sanctions per team are low, at most dozens per season), computing `SUM(Amount)` on read
is simple and fast enough — no denormalized cache column is added in this iteration, keeping the
write side a single `INSERT` with no read-modify-write race on a shared counter row.

```
TeamFundMovement : BaseEntity
  TeamId            string   (FK -> Team)
  Amount             decimal  (signed: positive = credit, negative = debit)
  Source             TeamFundMovementSource (SmartEnum: SanctionPayment | ManualAdjustment*)
  SourceSanctionId   string?  (FK -> TeamPlayerSanction, set iff Source == SanctionPayment)
  OccurredAt         DateTime (UTC)
  Description        string?  (free text, null for automatic sanction-payment rows)

  * ManualAdjustment is defined in the enum now (so the SmartEnum doesn't need a migration later)
    but no endpoint produces it yet — see Non-Goals.
```

`Team` (Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/UserClubs/Team.cs) gets a
`TeamFundMovements` navigation collection, mirroring how `TeamPlayer.Sanctions` (or equivalent)
already exposes related entities — no `Balance` column added to `Team` itself.

### Decisión 2 — Delta rule for edits (including `AmountPaid` decreasing)

Each `TeamPlayerSanction` can have **at most one** `TeamFundMovement` with
`Source == SanctionPayment` (enforced by a unique index on `SourceSanctionId` where not null,
mirroring how `TeamPlayerSanction.SourceEventId` is used for automatic-sanction idempotency).

- **Create** (`POST .../sanctions`): if `req.AmountPaid` is not null and > 0, insert one
  `TeamFundMovement` row with `Amount = req.AmountPaid`, `SourceSanctionId = sanction.Id`.
  `AmountPaid == null` or `0` creates no row.
- **Update** (`PUT .../sanctions/{id}`): compute
  `delta = (req.AmountPaid ?? 0) - (existingMovement?.Amount ?? 0)`.
  - If `delta == 0`: no-op.
  - If an existing movement row exists for this sanction: **update that row's `Amount` in place**
    to the new `req.AmountPaid` value (rather than inserting a second delta row) — this keeps
    "one sanction → at most one payment movement" true, keeps the ledger easy to reason about per
    sanction, and still gives a correct running balance since balance is `SUM(Amount)` over all
    rows, not `SUM(|Amount|)`. A reduction in `AmountPaid` (e.g. correcting a typo, or reversing
    an over-recorded payment) therefore reduces the fund balance by exactly the difference,
    symmetric with an increase.
  - If no existing movement row exists and `req.AmountPaid > 0`: insert one, same as create.
  - If `req.AmountPaid` becomes `null`/`0` and a movement row exists: set that row's `Amount` to
    `0` (keep the row for audit continuity — it still records "payment was recorded then
    reversed" via `OccurredAt`/history) rather than deleting it.
- **Delete** (`DELETE .../sanctions/{id}`): confirmed with the user — deleting a sanction reverses
  its recorded payment. If a `TeamFundMovement` row exists for `SourceSanctionId == sanction.Id`,
  set its `Amount` to `0` (same `AdjustAmount` method used by the update-decrease path; row is kept
  for audit continuity, not deleted) before/along with the sanction's own deletion. `DELETE` is
  already blocked for `Fulfilled` sanctions (prior change), so this only applies to `Pending`
  sanctions that had a partial `AmountPaid` recorded.

This rule lives in `SetPlayerSanction.cs`'s existing `POST`/`PUT` handlers (not a new Mediator
command — this file already documents why it's plain Minimal API handlers, not `ICommand`), right
after the existing `ValidateAmountPaid` check and before `db.SaveChangesAsync(ct)`, using the same
`AppDbContext db` already injected.

### Decisión 3 — Read endpoint shape

`GET /api/catalog/team/{teamId}/fund` (same route family as the existing
`GET /api/catalog/team/{teamId}/sanctions` in `SetPlayerSanction.cs`), open to every authenticated
role (read-only, mirrors the existing sanctions GETs), returns:

```csharp
public record TeamFundResponse(string TeamId, decimal Balance, TeamFundMovementResponse[] Movements);
public record TeamFundMovementResponse(
    string Id, decimal Amount, string Source, string? SourceSanctionId,
    DateTime OccurredAt, string? Description);
```

`Balance` = `SUM(Amount)` over the team's movements (0 if none). `Movements` is included now
(ordered by `OccurredAt desc`) since it's a cheap addition to the same query and unblocks a future
history UI without another endpoint — but the frontend summary cards in this iteration only
consume `Balance`. Confirmed: `Features/Coaches/Teams/` already exists (`Queries/GetTeam.cs`,
`Queries/GetTeams.cs`, etc.) with `TeamConstants.TeamFeature` already defined
(`Features/Coaches/Teams/TeamConstants.cs`). Unlike `SetPlayerSanction.cs` (which documents an
explicit, narrow exception for inline Minimal API handlers), `GetTeam.cs`/`GetTeams.cs` follow the
standard vertical-slice CQRS pattern: `IFeatureModule.AddRoutes` maps the route, sends an
`IQueryApp<TResponse>` via `IMediator`, handled by an `IRequestHandler<TQuery, TResponse>`. New
file `Features/Coaches/Teams/Queries/GetTeamFund.cs` follows that same standard pattern (a
`TeamFundQuery(string TeamId) : IQueryApp<TeamFundResponse>` + handler), `WithTags(TeamConstants.TeamFeature)`
— not the inline style.

### Decisión 4 — Player photo: exact pattern to reuse in `Sanctions.tsx`

Confirmed by inspecting `Front/src/apps/coach/pages/squad/Squad.tsx` (lines ~155-191) and
`Front/src/apps/coach/pages/attendance/AttendanceTabs.tsx`/`NotConvokedList.tsx`: there is no
`PlayerAvatar` shared component — every screen repeats the same three-step inline pattern:

1. **Data source**: `PlayerResponse.urlPhoto` (`Front/src/apps/coach/services/teamplayerService.ts`,
   field already present — `Sanctions.tsx`'s `SanctionRow.player` is already a `PlayerResponse`,
   so no service/type change is needed to get at `urlPhoto`).
2. **Resolution**: `playerService.fetchPlayerPhoto(url: string): Promise<string | null>`
   (`Front/src/apps/coach/services/playerService.ts`, line 18) — fetches
   `GET /api/catalog/player/photo?url=...` as a blob and returns an `URL.createObjectURL(blob)`
   object URL, or `null` on any failure. Called once per distinct player when the row list loads,
   collected into a `Record<string, string | null>` keyed by `player.id` (see `Squad.tsx`'s
   `playerPhotos` state, lines 80/174-191) — **not** per-render, to avoid refetching on every
   re-render.
3. **Fallback + rendering**:
   `import defaultAvatar from "../../../../assets/avatar.svg"` (relative path from
   `pages/sanctions/` mirrors `pages/attendance/AttendanceTabs.tsx`'s import depth — verify the
   exact relative segment count from `pages/sanctions/Sanctions.tsx`, since it's one directory
   shallower than `pages/attendance/components/`), then
   `const photo = playerPhotos[player.id] ?? defaultAvatar;` and
   `<img src={photo} alt={displayName} className={styles.playerAvatar} />` (add a
   `.playerAvatar`/`.playerAvatarInitials`-style rule to `Sanctions.module.css`, sized for a table
   cell — smaller than the cromo-style avatars in `AttendanceTabs.module.css`; do not reuse those
   classes across modules, CSS Modules are file-scoped by convention here anyway).

No backend change is needed for the photo — `urlPhoto` and `GET /api/catalog/player/photo` both
already exist and are already used by other screens.

## Risks / Trade-offs

- **[Risk] Race condition on concurrent sanction edits** for the same sanction updating its
  movement row simultaneously → **Mitigation**: EF Core's default optimistic concurrency (no
  explicit `[Timestamp]` today on `TeamPlayerSanction` either) is an accepted, pre-existing risk
  level in this codebase for this low-concurrency single-coach-per-team usage pattern; not
  introducing new mitigation beyond what sibling features already have.
- **[Risk] `SUM(Amount)` on every read** could become a cost at scale → **Mitigation**: sanction
  volume per team is small (season-bounded); revisit with a denormalized/cached balance only if
  this becomes measurably slow — explicitly deferred, not pre-optimized.
- **[Trade-off] One-movement-per-sanction constraint** (Decisión 2) is simpler than a full
  append-only ledger (which would insert a new correcting row per edit) but sacrifices some audit
  granularity (you see the final `AmountPaid` per sanction, not each edit's history). Acceptable
  given the user's stated need is "track the balance and where it came from by source/sanction,"
  not "audit every edit."

## Open Questions

1. ~~Deleting a `Pending` sanction that already has a recorded `AmountPaid`~~ — **Resolved**:
   confirmed with the user, see Decisión 2's Delete rule above (zero out the linked movement).
2. **Icon choices** for the three summary cards are left to front-specialist's judgment; suggested
   concepts only (not prescriptive): total fined → `Gavel` or `ReceiptLong`; total pending →
   `HourglassEmpty` or `PendingActions`; team fund → `Savings` or `AccountBalanceWallet`.
3. **Exact folder for the new read endpoint** (`Features/Coaches/Teams/Queries/GetTeamFund.cs` vs.
   colocating it inside `SetPlayerSanction.cs`'s file or a new `Features/Coaches/Teams/` feature
   module) should be confirmed against whatever `Features/Coaches/Teams/` convention (if any)
   already exists at implementation time — not verified further here since no code is being
   written in this proposal.
