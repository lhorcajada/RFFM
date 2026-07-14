## Context

`FeaturePermission` (route-level), `PagePermission` (UI-element-level), `IRequireFeaturePermission`,
and `FeaturePermissionBehavior` already exist in the codebase and are already registered last in the
Mediator pipeline (`ServiceCollectionExtensions.cs:155`). Nothing implements `IRequireFeaturePermission`
today, so the behavior is a no-op in production — every authenticated Coach-app user (including `Player`)
can call every Coach endpoint. `FeaturePermissionBehavior` already throws `ForbiddenAccessException` when
no matching `FeaturePermission` row exists for `(role, featureRoute)`, and `ForbiddenAccessException` is
already mapped to a 403 `ProblemDetails` in `ServiceCollectionExtensions.cs:179`. Administrator already
bypasses the check unconditionally.

The current seed data in `WebApplicationExtensions.SeedFeaturePermissionsAsync` (lines 326-357) uses
placeholder routes (`/coach/roster`, `/coach/season-prep`) that don't match any real frontend path and
have zero consumers — safe to replace.

`FeatureRoute` is a **logical identifier**, not a literal browser URL (confirmed by existing seed data
using `/coach/roster` while the real Squad page is `/coach/squad`). This design keeps that convention:
routes are stable strings the backend and (later) frontend agree on, independent of exact router paths.

## Goals / Non-Goals

**Goals:**
- Define a canonical `CoachFeatureRoutes` catalog covering the 8 Player-allowed dashboard features plus
  the concretely-identified non-allowed features reachable from the Coach dashboards.
- Seed `FeaturePermission` so `Player` has **Read only** on the 8 allowed routes and **no row** (→ 403)
  everywhere else.
- Seed `FeaturePermission` so `Administrator/Coach/ClubDirector` keep **ReadWrite** on every catalogued
  route (no regression for staff roles). `ClubMember` keeps ReadWrite specifically where it already has
  UI access today (verified: GameModels, per `canSeeGameModel` in `TeamDashboardCards.tsx`).
- Wire `IRequireFeaturePermission` onto the query/command records that back those routes, without
  touching handler logic (one-liner per record, per project convention).
- Verify `GetMyPermissions` already exposes what the frontend needs (`FeatureRoute` + `PermissionType`
  per role) — no contract change required.
- TDD: xUnit + Moq tests for `FeaturePermissionBehavior` (already partially testable) and for each newly
  guarded handler's authorization boundary; ≥80% coverage on touched handlers.

**Non-Goals (explicitly out of scope, follow-up changes):**
- Frontend card hiding (separate front-specialist change, consumes `GetMyPermissions` as-is).
- Admin-only areas not reachable from the Coach dashboard UI today: Users, Roles, Countries, Invitation,
  UserClubs, ClubJoinRequests, Competitions, Formations, Kits, Lineup, SeasonPrep-adjacent internals.
  These have no current Player-reachable UI path; gating them is lower risk/urgency and is a follow-up.
- Fine-grained per-field/`PagePermission` changes beyond the existing `Roster` page entries.
- `Sanciones`/`Lotería`/`Noticias`: **no backend endpoints exist yet** (frontend calls
  `/api/catalog/teamplayer/{id}/sanctions`, which 404s and is swallowed client-side; Lottery/News are
  static placeholder pages with zero API calls). We still seed `FeaturePermission` rows for these 3
  routes (future-proofing + so `GetMyPermissions` already reports them as allowed for Player), but there
  is no handler to annotate.
- Building real Sanctions/Lottery/News APIs — out of scope for this change.

## Decisions

### 1. Route catalog (logical `FeatureRoute` values)

Allowed for `Player` (Read):
| FeatureName | FeatureRoute | Backing handlers (RequiredPermission=Read) |
|---|---|---|
| Squad | `/coach/squad` | `GetPlayersByTeam`, `GetTeamPlayer`, `GetDemarcations` |
| Events | `/coach/attendance` | `GetSportEvents`, `GetSportEventItem` |
| AttendanceSummary | `/coach/attendance/summary` | `GetTrainingAttendanceSummary` |
| Convocations | `/coach/convocations` | `GetEventConvocations`, `GetEventPlayers`, `GetMatchParticipation` |
| Injuries | `/coach/injured` | (query side of `SetPlayerInjury`'s feature — see Risk below; no dedicated GET today, route seeded for future use) |
| Sanctions | `/coach/sanctions` | none yet (no backend) |
| Lottery | `/coach/lottery` | none yet (no backend) |
| News | `/coach/news` | none yet (no backend) |

Blocked for `Player` (no seeded row ⇒ `FeaturePermissionBehavior` throws `ForbiddenAccessException`),
seeded ReadWrite for `Administrator/Coach/ClubDirector` (+`ClubMember` where noted):
| FeatureName | FeatureRoute | Backing handlers (RequiredPermission=ReadWrite for commands, Read for queries) |
|---|---|---|
| Rivals | `/coach/rivals` | `CreateRival`, `UpdateRival`, `DeleteRival`, `UploadRivalPhoto`, `GetRivals` |
| Trainings | `/coach/trainings` | `Exercises/*`, `Sessions/*` (Create/Update/Delete/Get) |
| GameModels | `/coach/game-model` | `CreateGameModel`, `UpdateGameModel`, `DeleteGameModel`, `ToggleSkillMastered`, `GetGameModel*` — seeded ReadWrite also for `ClubMember` (matches existing `canSeeGameModel` UI gate) |
| SeasonAccess | `/coach/season-access` | all `SeasonAccess/*` commands/queries |
| Settings | `/coach/settings` | `ConfigurationCoach` (Get/Create/Update/Delete) |
| ClubManagement | `/coach/clubs` | `Clubs/Commands/*`, `Clubs/Queries/GetClub(s)` |
| ClubPlayers | `/coach/clubs/players` | `Players/Queries/GetPlayers` (club-level roster, distinct from `GetPlayersByTeam`) |
| ClubTeams | `/coach/clubs/teams` | `Teams/Commands/*`, `Teams/Queries/GetTeams`, `GetTeam` |
| ClubRegistrations | `/coach/clubs/registrations` | (identified in tasks.md; registrations flow commands) |

`SetPlayerInjury` (write) is intentionally left **ungated by this change**: gating it would require a
`Write`/`ReadWrite` requirement, which Player (Read-only) would then fail — but the task's own dashboard
card list treats "Lesionados" as a Player-visible feature. Since there is no injury *query* endpoint to
safely Read-gate today, and mis-gating the write endpoint risks breaking legitimate Coach usage under
time pressure, this file is called out explicitly as a Task item to decide/implement carefully with a
focused test (see tasks.md) rather than guessed here.

### 2. Player permission level = Read, not ReadWrite

Player is a football player, not a coach. All 8 allowed features are consumption of information about
themselves/their team (squad, schedule, attendance, match convocations). Granting Write would let a
Player mutate teammates' data. Read-only is the safe default; any future Player-writable action (e.g.
confirming their own convocation) is a separate, deliberate change.

### 3. `FeatureRoute` values are logical identifiers, replacing the current placeholder seed rows

The existing seed entries (`/coach/roster`, `/coach/season-prep`, `/coach/assistances`, `/coach/game-models`,
generic `/coach/clubs` for everything) have no consumers and don't match real routes. This change replaces
them with the catalog above. `CoachFeatureRoutes` becomes a `static class` of `const string` in
`Domain/Entities/CoachFeatureRoutes.cs` so both the seeder and the feature files reference the same
compile-time-checked constants (no magic strings duplicated).

### 4. No EF migration required

`FeaturePermission`/`PagePermission` tables already exist (migration `20260502130952_AddFeatureAndPagePermissions`).
Seeding is done imperatively in `SeedFeaturePermissionsAsync`, gated by an `Any()` existence check per row
— idempotent, safe to run on every startup.

## Risks / Trade-offs

- [Risk] Broad annotation of ~9 feature areas is a large mechanical diff → [Mitigation] one-line addition
  per record (`FeatureRoute`/`RequiredPermission` properties), no handler logic changes; reviewed via
  `dotnet build` + targeted tests per feature area, broken into tasks.md chunks.
- [Risk] Missing a role that currently has legitimate access to a blocked route (e.g. `ClubMember` on
  GameModels) → [Mitigation] cross-checked against frontend `hasRole`/`canSeeGameModel` gates before
  seeding; GameModels explicitly includes `ClubMember`.
- [Risk] `Injured`/Lesionados has no read endpoint to Read-gate, and gating the write endpoint would break
  the "Player can access Lesionados" requirement → [Mitigation] explicit task to resolve with a test
  proving the chosen behavior; not silently skipped.
- [Risk] Seed-only enforcement means a fresh/test database without seeding leaves everything open →
  [Mitigation] `FeaturePermissionBehavior` already fails closed (`permission == null` → Forbidden) except
  for Administrator, so absence of seed data blocks non-admins rather than allowing them — verified by
  existing behavior code, add a regression test.

## Migration Plan

1. Add `CoachFeatureRoutes` constants.
2. Replace seed entries in `SeedFeaturePermissionsAsync` with the new catalog (idempotent `Any()` guard
   already in place; old orphaned rows for `/coach/roster` etc. are simply superseded — no cleanup
   migration needed since nothing reads them).
3. Annotate handlers feature area by feature area (see tasks.md), building + testing after each.
4. No rollback complexity: this is additive authorization; reverting is a code revert, no data migration.

## Open Questions

- Exact `ClubRegistrations` backend feature file(s) to be confirmed during Task 4 (club dashboard area) —
  proposal identifies the frontend page but the precise backend command names need a final grep pass.
- Whether `SetPlayerInjury` should become Player-writable (deviating from the Read-only default) is
  deferred to a human product decision; this change ships with it **ungated** and flags the gap in
  tasks.md rather than guessing.
