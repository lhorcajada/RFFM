## Why

The Coach web app already ships a "Sanciones" screen (`Front/src/apps/coach/pages/sanctions/Sanctions.tsx`) that calls `GET/POST/PUT/DELETE /api/catalog/teamplayer/{id}/sanctions`, but no backend endpoint exists for this route today — the screen fails silently (the service swallows errors and falls back to empty arrays). We need the backend feature so the existing frontend works and so the upcoming Mobile app can consume the same contract. Additionally, the club wants sanctions split into two categories — competition sanctions (cards/expulsions in matches) vs. internal discipline sanctions (club/team rule violations) — which the current `SanctionRecord` frontend type does not yet model.

## What Changes

- Add a new backend feature `SetPlayerSanction` mirroring the existing `SetPlayerInjury` vertical-slice pattern (inline Minimal API endpoints, not Mediator ICommand, consistent with the sibling feature).
- New domain entity `TeamPlayerSanction` (analogous to `TeamPlayerInjury`) with a new required `SanctionCategory` field (`Competition` | `InternalDiscipline`).
- New EF Core migration adding the `TeamPlayerSanctions` table (schema `app`) plus entity configuration.
- Endpoints: `GET/POST /api/catalog/teamplayer/{id}/sanctions`, `PUT/DELETE /api/catalog/teamplayer/{id}/sanctions/{sanctionId}`, with an optional `?category=` query filter on GET so Front/Mobile can request one category at a time.
- Role-gated writes (`Coach,Administrator`) and open GET (all authenticated roles), mirroring `SetPlayerInjury`'s existing authorization pattern and its regression-test coverage.
- xUnit + Moq/Testcontainers tests written first (TDD), mirroring `InjuryEndpointAuthorizationTests`.

## Capabilities

### New Capabilities
- `player-sanctions`: Backend CRUD for tracking player sanctions (competition and internal-discipline categories) scoped to a team player, exposed via Minimal API endpoints under `/api/catalog/teamplayer/{id}/sanctions`.

### Modified Capabilities
(none — no existing spec covers sanctions)

## Impact

- **Backend only** (`Back/ExtractionApi/`): new feature file, domain entity, EF configuration, migration, DbSet, tests.
- No changes to `Front/` or `Mobile/` — this proposal only delivers the contract; frontend/mobile wiring is out of scope and will be tracked separately.
- The response DTO shape is designed to be a strict superset of the current (unused) frontend `SanctionRecord` type, plus the new `category` field, so the existing Front service/page can be updated later with a minimal diff.
