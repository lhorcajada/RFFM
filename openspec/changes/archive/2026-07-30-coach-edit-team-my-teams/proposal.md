## Why

In Coach (`Front/`), Settings → "Mis equipos" (`Front/src/apps/coach/pages/settings/components/MyTeams/TeamManager.tsx`)
lists the teams of the active season but has no way to edit a team's data — only
"Crear equipo" exists. A full edit form (name, category, league, RFFM competition/group,
shield/photo) already exists at a different route
(`Front/src/apps/coach/pages/clubTeams/edit/EditTeam.tsx`, reachable only from
`ClubTeams.tsx`), wired to a working backend endpoint (`PUT /api/catalog/team/{id}`,
`Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Teams/Commands/UpdateTeam.cs`). Coaches
managing their teams from Settings currently have no discoverable way to reach it.

Separately, editing a team currently has no ownership check: `UpdateTeamHandler` updates any
team it's given, gated only by the generic `ClubTeams` feature permission — any authenticated
user with that generic permission could edit a team they have no relationship to. The user
requesting this feature wants editing restricted to the team's own coach or a club director
(`Membership.RoleId`: `Directive = 1` or `Coach = 2` on `UserTeam`/`UserClub`, per
`Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/UserClubs/Membership.cs`), which is not
enforced anywhere today.

## What Changes

- Add an "Editar" button per team row/card in `TeamManager.tsx` that navigates to the existing
  `/coach/clubs/:clubId/teams/:teamId/edit` route (`EditTeam.tsx`) — reusing the existing form,
  not building a new one.
- The button is only rendered when the current user is Coach of that team or Directive of its
  club (frontend-side visibility; see below for the data needed to know this).
- Backend: add an authorization check in the `UpdateTeam` command (or its validator/a new
  pipeline check) so that only a user with `UserTeam.RoleId == Coach` for that team, or
  `UserClub.RoleId == Directive` for the team's club, can update it. Any other authenticated
  user gets `403 Forbidden` via `ProblemDetails`, even if they hold the generic `ClubTeams`
  feature permission.
- Backend: expose the current user's role for a given team/club so the frontend can decide
  whether to show "Editar" — extending an existing query (`GetTeams`/`GetUserClub`) or adding a
  new lightweight one is a `design.md` decision; `GetUserClub.cs` today ignores which club when
  a user belongs to several, so it cannot be reused as-is.
- No changes to the fields editable in `EditTeam.tsx` itself (name, category, league, shield)
  — this proposal is about discoverability from Settings and about adding the missing
  authorization, not about changing what can be edited.

## Capabilities

### New Capabilities
- `coach-team-edit-authorization`: only a team's coach or its club's director may update a
  team's data (`PUT /api/catalog/team/{id}`); enforced in the backend regardless of caller.

### Modified Capabilities
- `coach-settings-my-teams`: "Mis equipos" in Coach Settings gains an "Editar" entry point per
  team, visible only to that team's coach or the club's director, linking to the existing edit
  form.

## Impact

- **Frontend (`Front/`)**: `TeamManager.tsx` (add button + role-based visibility),
  `teamService.ts` (new call to fetch/consume the current user's role for the club/team if a
  new query is added), route already exists (`routes.tsx`) so no new route needed.
- **Backend (`Back/ExtractionApi/`)**: `UpdateTeam.cs` (authorization check), possibly a new
  query/extension in `Features/Coaches/UserClubs/` or `Features/Coaches/Teams/` to expose
  "my role for this team/club", `Common/Behaviors/` if the check is implemented as a pipeline
  behavior instead of inline in the handler (design decision).
- **Mobile**: none — this feature is Coach-web only; the original request mentioned "coach" but
  the actual Settings/"Mis equipos" surface described lives in `Front/`, not `Mobile/`
  (confirmed with the user).
- **Tests**: new FluentValidation/handler tests for the `UpdateTeam` authorization rule
  (`dotnet test`), new Vitest tests for the "Editar" button visibility and navigation in
  `TeamManager.tsx` (`npm run test`).
