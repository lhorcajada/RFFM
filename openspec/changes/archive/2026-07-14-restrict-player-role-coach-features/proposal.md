## Why

Any authenticated Coach-app user — including role `Player` — can currently call every Coach API endpoint, because no `ICommand`/`IQueryApp` implements `IRequireFeaturePermission` yet and `FeaturePermissionBehavior` has no consumers. The frontend will soon hide non-Player dashboard cards, but that is cosmetic only: a Player who calls `/api/coaches/configuration`, `/api/rivals`, `/api/game-models`, club CRUD, etc. directly today succeeds. We need real API-level enforcement so a Player is limited to the 8 approved dashboard features regardless of UI.

## What Changes

- Introduce a `CoachFeatureRoutes` catalog of stable `FeatureRoute` constants for the Coach feature areas reachable from the team/club dashboards.
- Seed `FeaturePermission` rows in `WebApplicationExtensions` for: `Player` → **Read** on the 8 allowed routes (Squad, Events, AttendanceSummary, Convocations, Injuries, Sanctions, Lottery, News); `Administrator/Coach/ClubDirector/ClubMember` → **ReadWrite** on all catalogued routes (preserves current behavior for staff roles).
- Implement `IRequireFeaturePermission` on the query/command records behind the 8 allowed routes (Read requirement) and on the query/command records behind the identified out-of-scope routes (Rivals, Trainings, GameModels, SeasonAccess, Settings, Club CRUD + club-level Players/Teams/Registrations) so Player (and any role without a seeded entry) is rejected with a 403 `ProblemDetails`.
- Extend `GetMyPermissions` contract only if needed to make the allowed-feature set unambiguous for the frontend (likely no shape change — existing `FeaturePermissions` list already carries `FeatureRoute` + `PermissionType`).
- Add xUnit tests (Moq) for `FeaturePermissionBehavior` edge cases and for representative Coach handlers now guarded, plus a seed-data consistency test.
- **BREAKING** (intentional): Player calls to previously-open, now-restricted endpoints will start returning 403 instead of succeeding.

## Capabilities

### New Capabilities
- `coach-feature-permissions`: Feature-route permission catalog + seeding + enforcement wiring for Coach-app endpoints, scoped to role `Player` restriction to 8 dashboard features.

### Modified Capabilities
(none — no existing `openspec/specs/` capability governs this area yet)

## Impact

- `Back/ExtractionApi/src/RFFM.Host/DependencyInjection/WebApplicationExtensions.cs` (seed data)
- New: `Back/ExtractionApi/src/RFFM.Api/Domain/Entities/CoachFeatureRoutes.cs` (route catalog)
- Feature files under `Features/Coaches/{Players,SportEvents,Assistances,Convocations,Rivals,Trainings,GameModels,SeasonAccess,Settings,Clubs}` — add `IRequireFeaturePermission` to selected records only (no handler logic changes)
- `Features/Coaches/Permissions/GetMyPermissions.cs` — verified as sufficient contract for frontend
- New backend tests under matching `*.Tests.cs` files
- No EF migration needed (`FeaturePermission`/`PagePermission` tables already exist per migration `20260502130952_AddFeatureAndPagePermissions`); seed data is code-only (`HasData`/startup seeding — confirmed at implementation time)
- Frontend consumption of `GetMyPermissions` is a separate, later change (not in this scope)
