# implement.md — coach-team-user-management (FRONTEND ONLY, tasks.md §4-7)

You are the `openspec-implementer` subagent. Execute this script precisely. It covers **only**
frontend work under `Front/` — sections 4, 5, 6, and 7 of
`openspec/changes/coach-team-user-management/tasks.md`. Do **not** touch anything under
`Back/ExtractionApi/`. The backend is already implemented, tested, and green (sections 1-3 of
tasks.md, already marked `[x]`) — the two endpoints below are live and callable, this is not a
mock-first build.

Follow strict TDD (Red → Green → Refactor) per `.claude/rules/frontend-testing.md` and
`.claude/rules/react.md`. Do not write production code before a failing test exists for it.

Repo root: `C:\Proyects\MisProyectos\FutbolBase`
Frontend root: `Front` (all paths below are relative to this unless stated otherwise).

## Context you need (already researched — do not re-derive)

### The live API contract (authoritative — from design.md "API Contract" section)

```
GET /api/coaches/team-users?teamId={teamId}
Authorization: Bearer <jwt>

200 OK
{
  "teamId": "...",
  "callerIsCreator": true,
  "users": [
    {
      "membershipId": "...",       // UserTeam.Id — pass to DELETE below
      "userId": "...",
      "alias": "...",
      "email": "...",
      "membershipKind": "Coach",   // Membership.Key: Directive | Coach | ClubMember | Player | FamilyPlayer | Follower
      "joinedAt": "2026-01-15T10:00:00Z",
      "isCreator": false,
      "isSelf": false              // true when userId == caller's id
    }
  ]
}

400 Bad Request      — teamId missing/malformed. ProblemDetails.
402 Payment Required — ProblemDetails, scope's subscription inactive.
403 Forbidden        — ProblemDetails, caller has no UserTeam/UserClub access to this team.
404 Not Found        — ProblemDetails, team does not exist.
401 Unauthorized     — not authenticated (standard pipeline behavior).
```

```
DELETE /api/coaches/team-users/{membershipId}
Authorization: Bearer <jwt>

204 No Content
  — target's IdentityUser account deleted, along with every UserTeam/UserClub row it held.

400 Bad Request
  ProblemDetails — membershipId missing/malformed, OR caller attempted to delete themselves,
  OR target is the scope's creator ("No es posible eliminar al creador del espacio.").

402 Payment Required — ProblemDetails, scope's subscription inactive.

403 Forbidden
  ProblemDetails — caller lacks the required tier: not a team/club member at all, OR target's
  membershipKind is Coach/Directive and caller is not the scope's creator
  ("Solo el creador del espacio puede eliminar a otro entrenador.").

404 Not Found — ProblemDetails, no UserTeam with that membershipId.
401 Unauthorized — not authenticated.
```

UI rule (design.md, end of "API Contract"): a row never shows a delete button when `isSelf` or
`isCreator` is true. When `membershipKind` is `Coach` or `Directive` (and not self/creator), the
delete button shows only when the fetched `callerIsCreator === true`. Every other
`membershipKind` (not self/creator) always shows the delete button — the backend enforces the
real rule regardless; the frontend button visibility is a UX nicety, not the security boundary.

### Files that already exist and must NOT be modified except where explicitly listed

- `Front/src/apps/coach/routes.tsx` — **modify**: add one `lazy()` import + one `<Route>` (task
  6.2 below), nothing else in this file changes.
- `Front/src/apps/coach/pages/team-dashboard/TeamDashboardCards.tsx` — **modify**: destructure
  the already-declared `isPlayer` prop (currently accepted in `TeamDashboardCardsProps` at line
  21 but not destructured in the function signature at line 26-29) and add one new
  `DashboardCard` (task 6.2 below).
- `Front/src/apps/coach/pages/team-dashboard/TeamDashboard.tsx` — already passes
  `isPlayer={isPlayer}` to `TeamDashboardCards` (line 35) — **do not touch this file**, nothing
  needed here.
- `Front/src/shared/types/scope.ts` — already exports `MembershipKind` (the six-way string
  union) and `ProblemDetails` — **do not touch this file**, import from it.

### Patterns to mirror exactly

**Service file shape** — mirror `Front/src/apps/coach/services/teamRulesService.ts` exactly:
plain async functions calling the single shared Axios instance
(`import client from "../../../core/api/client"`), a `default` object export bundling them (not
a class instance). Its co-located test
(`Front/src/apps/coach/services/__tests__/teamRulesService.test.ts`) mocks the client module with
`vi.mock("../../../../core/api/client", () => ({ default: { get: ..., delete: ... } }))`
(note: **four** `../` from inside `__tests__/`, **three** from the service file itself — count
directory depth carefully, `services/__tests__/` is one level deeper than `services/`).

**Page shape** — mirror `Front/src/shared/pages/ScopeMembers/ScopeMembers.tsx` structure:
`BaseLayout` > `ContentLayout title="...">` > (loading spinner | MUI `Table`) + confirm `Dialog` +
`Snackbar`/`Alert`. Reuse verbatim (adapted to this page, do not import from `ScopeMembers.tsx`,
duplicate consciously per `.claude/rules/frontend-architecture.md` — these are small, page-local
helpers, not cross-app):
- `isAxiosErrorWithProblem` / `problemMessage` helpers (lines 39-60 of `ScopeMembers.tsx`).
- `formatDate` helper (lines 62-70).
- The `KIND_COLORS: Record<MembershipKind, ...>` chip-color map pattern (lines 72-79) — same six
  keys, any reasonable color choice, consistent with `ScopeMembers.tsx`'s.
- The confirm-dialog / snackbar state pattern (`showSnack`, a `Dialog` gated on
  `!!removeTarget`/here `!!deleteTarget`, disabled buttons + `CircularProgress` while the async
  call is in flight).
- The custom `Alert` `forwardRef` wrapper at the bottom of the file (lines 346-350).

Because `TeamUsers.tsx` lives at `Front/src/apps/coach/pages/team-users/TeamUsers.tsx` (one
level of nesting under `apps/coach/pages/`, same depth as `Front/src/apps/coach/pages/squad/Squad.tsx`),
import `BaseLayout`/`ContentLayout` as
`"../../../../shared/components/ui/BaseLayout/BaseLayout"` /
`"../../../../shared/components/ui/ContentLayout/ContentLayout"` — verified via
`Squad.tsx`'s own imports (four `../`), not `ScopeMembers.tsx`'s three (that file lives one
level shallower, directly under `shared/pages/ScopeMembers/`).

**`teamId` from the query string**: other team-scoped Coach pages read `?teamId=...` via
`useSearchParams()` from `react-router-dom` directly (see `Squad.tsx` line 73:
`const [squadSearchParams] = useSearchParams();`) — do **not** use `useTeamAndClub()` for this
page (that hook does more than just read the id and pulls in club/team fetch machinery this page
doesn't need); a plain `useSearchParams()` read of `teamId`, matching `ScopeMembers.tsx`'s own
`useSearchParams()` pattern for its `id`/`scope` params, is sufficient and is what design.md
Decision 5 actually means by "reading `teamId` from the query string the same way other pages
do" — the literal mechanism (`useSearchParams`), not necessarily the `useTeamAndClub` hook itself.
If `npm run build`/tests reveal `useTeamAndClub()` is genuinely simpler for a title/breadcrumb,
that's an acceptable judgment call — note it in your report either way.

## 4. `teamUsersService.ts` — Red then Green

### 4.1 Red — test file
Create `Front/src/apps/coach/services/__tests__/teamUsersService.test.ts`, mocking
`../../../../core/api/client` the same way `teamRulesService.test.ts` does (`mockGet`, `mockDelete`
— no `mockPut`/`mockPost` needed here).

Cover, each as its own `it`:
1. `getTeamUsers("team-1")` calls `client.get("/api/coaches/team-users", { params: { teamId: "team-1" } })`
   and returns `response.data` parsed as `GetTeamUsersResponse` — assert against a realistic fixture
   object matching the shape in the API Contract above (`teamId`, `callerIsCreator`, `users: [...]`
   with all eight fields per row).
2. `getTeamUsers` propagates a rejected promise (e.g. simulate a `403`) — `await expect(...).rejects.toBe(error)`.
3. `deleteTeamUserAccount("membership-1")` calls
   `client.delete("/api/coaches/team-users/membership-1")` (URL-encode the id via
   `encodeURIComponent` in the service and assert the mock was called with the encoded value if the
   id contains characters needing encoding is worth a separate case only if you think it adds real
   value — a plain alphanumeric id in the main test is sufficient, do not over-test URL encoding
   itself).
4. `deleteTeamUserAccount` propagates a rejected promise (e.g. simulate a `400` self-delete
   rejection) — `await expect(...).rejects.toBe(error)`.

Run `npm run test -- teamUsersService` from `Front/` — confirm all fail (module doesn't exist
yet).

### 4.2 Green — production file
Create `Front/src/apps/coach/services/teamUsersService.ts`:

```typescript
import client from "../../../core/api/client";
import type { MembershipKind } from "../../../shared/types/scope";

export type TeamUserDto = {
  membershipId: string;
  userId: string;
  alias: string;
  email: string;
  membershipKind: MembershipKind;
  joinedAt: string;
  isCreator: boolean;
  isSelf: boolean;
};

export type GetTeamUsersResponse = {
  teamId: string;
  callerIsCreator: boolean;
  users: TeamUserDto[];
};

const getTeamUsers = async (teamId: string): Promise<GetTeamUsersResponse> => {
  const { data } = await client.get<GetTeamUsersResponse>("/api/coaches/team-users", {
    params: { teamId },
  });
  return data;
};

const deleteTeamUserAccount = async (membershipId: string): Promise<void> => {
  await client.delete(`/api/coaches/team-users/${encodeURIComponent(membershipId)}`);
};

export default {
  getTeamUsers,
  deleteTeamUserAccount,
};
```

Run the tests from 4.1 — all green. Note: the test in 4.1 step 1 asserts
`client.get` was called with `"/api/coaches/team-users", { params: { teamId: "team-1" } }` — match
this call shape exactly (params object, not a query string built by hand), since that is what
`client.get`'s Axios config accepts and what the test will assert against.

## 5. `TeamUsers` page — Red then Green

### 5.1 Red — test file
Create `Front/src/apps/coach/pages/team-users/__tests__/TeamUsers.test.tsx`. Wrap the rendered
component in `<MemoryRouter initialEntries={["/coach/team-users?teamId=team-1"]}>` (so
`useSearchParams()` resolves `teamId`). `vi.mock("../../../services/teamUsersService", ...)`
declared before the component import (Vitest hoisting), mocking both `getTeamUsers` and
`deleteTeamUserAccount` as the default-exported object's methods (mirror how `ScopeMembers.test.tsx`
mocks `scopesApi` — read that file first for the exact mocking shape used in this codebase before
writing this test).

Cover, each as its own `it`:
1. Renders a loading state, then a table with one row per user (`alias`, `email`,
   `membershipKind` as a chip, `joinedAt` formatted via the page's own `formatDate`).
2. A row where `isSelf === true` never renders a delete button (`queryByRole("button", { name: /eliminar/i })`
   scoped to that row, or an equivalent `queryByLabelText` matching the `aria-label` you give the
   delete `IconButton`, e.g. `` `Eliminar a ${alias}` ``).
3. A row where `isCreator === true` never renders a delete button.
4. A row with `membershipKind: "Coach"` (not self/creator) renders a delete button only when the
   fetched `callerIsCreator === true`; assert no delete button when the mocked response has
   `callerIsCreator: false`.
5. A row with `membershipKind: "FamilyPlayer"` (not self/creator) always renders a delete button
   regardless of `callerIsCreator` (test both `true` and `false` fixture values, or at minimum the
   `false` case since case 4 already covers `true` for Coach — your call, keep it readable and
   non-redundant).
6. Clicking a row's delete button opens a confirmation dialog naming the target's `alias` — it does
   **not** call `deleteTeamUserAccount` before the dialog is confirmed (assert the mock was not
   called after the click, only after confirming).
7. Confirming the dialog calls `deleteTeamUserAccount(membershipId)`, removes the row from the
   rendered list on success, and shows a success snackbar/alert (assert the success message text or
   `role="alert"` content appears).
8. A failed `deleteTeamUserAccount` call (mock rejects with an Axios-shaped error carrying
   `response.data.detail`, e.g. `{ response: { status: 403, data: { detail: "Solo el creador..." } } }`)
   shows an error snackbar with that `detail` message and leaves the row in the list.
9. Empty `users: []` (with `getTeamUsers` resolving normally) renders an empty-state message, not
   an empty table body with just headers.
10. A `teamId` missing from the query string (render with
    `<MemoryRouter initialEntries={["/coach/team-users"]}>` instead) renders an explanatory message
    instead of calling `getTeamUsers` — assert the mocked `getTeamUsers` was never called.

Run `npm run test -- TeamUsers` from `Front/` — confirm all fail (component doesn't exist yet).

### 5.2 Green — production files
Create `Front/src/apps/coach/pages/team-users/TeamUsers.tsx` (default export) +
`Front/src/apps/coach/pages/team-users/TeamUsers.module.css`.

Structure (mirror `ScopeMembers.tsx` closely, adapted):
- `useSearchParams()` → `teamId = searchParams.get("teamId") ?? ""`; `const invalidTeamId = !teamId;`
- State: `users: TeamUserDto[]`, `callerIsCreator: boolean`, `loading`, `snackOpen`/`snackMsg`/`snackSeverity`,
  `deleteTarget: TeamUserDto | null`, `deleting: boolean`.
- `useEffect` on `[teamId]` calling an internal `loadUsers()` that, if `invalidTeamId`, returns
  immediately without calling the service; otherwise calls `teamUsersService.getTeamUsers(teamId)`,
  sets `users`/`callerIsCreator`, catches errors into an error snackbar via the duplicated
  `problemMessage`/`isAxiosErrorWithProblem` helpers.
- A local `canDelete(user: TeamUserDto): boolean` helper (single-responsibility, per
  `.claude/rules/react.md` §3.3 — keep it in this file, not extracted elsewhere):
  ```typescript
  function canDelete(user: TeamUserDto, callerIsCreator: boolean): boolean {
    if (user.isSelf || user.isCreator) return false;
    const isCoachTier = user.membershipKind === "Coach" || user.membershipKind === "Directive";
    return isCoachTier ? callerIsCreator : true;
  }
  ```
- `ContentLayout title="Gestión de usuarios"` (exact title per tasks.md 5.2).
- MUI `Table` with columns: Alias, Email, Rol (chip via the local `KIND_COLORS` map, "Creador" chip
  when `isCreator` — mirror `ScopeMembers.tsx` lines 246-261 exactly for this column's rendering
  logic), Fecha de alta (`formatDate(joinedAt)`), Acciones (delete `IconButton` gated by
  `canDelete(user, callerIsCreator)`, `aria-label={\`Eliminar a ${user.alias}\`}`,
  `onClick={() => setDeleteTarget(user)}`).
- Empty state: when `!loading && users.length === 0`, render a message row/paragraph — do not
  render a table with zero body rows and no message (mirror `ScopeMembers.tsx`'s
  `members.length === 0` branch at lines 233-241, adapt the copy, e.g. "No hay usuarios en este
  equipo todavía.").
- Invalid `teamId` branch: mirror `ScopeMembers.tsx`'s `invalidScope` branch (lines 170-176) —
  render an explanatory `Typography` instead of the table, and skip the `getTeamUsers` call
  entirely (the `useEffect`/`loadUsers` early-return above already ensures this).
- Confirm `Dialog` (mirror the `removeTarget` dialog, lines 307-329): title "Eliminar cuenta",
  body naming `deleteTarget?.alias` (and `deleteTarget?.email`), explicit warning that this deletes
  the account entirely (not just unlinks it) since that's materially different from
  `ScopeMembers.tsx`'s "desvincular" wording — do not reuse that copy verbatim, this is a harder
  action. On confirm: call `teamUsersService.deleteTeamUserAccount(deleteTarget.membershipId)`,
  on success filter the row out of `users` and show a success snackbar, on failure show an error
  snackbar via `problemMessage(err, "Error al eliminar la cuenta.")` and leave `users` unchanged,
  `finally` clear `deleting`/close-or-keep the dialog per `ScopeMembers.tsx`'s own
  `confirmRemove` pattern (it clears `removeTarget` only inside the `try`, i.e. only on success —
  match that: on failure the dialog stays open so the user sees the error and can retry or cancel).
- Snackbar/Alert: reuse the `forwardRef` `Alert` wrapper pattern from `ScopeMembers.tsx`'s bottom
  (lines 346-350), duplicated into this file.
- `TeamUsers.module.css`: only what's actually needed for layout not already covered by MUI's `sx`
  prop or the shared `ContentLayout`/table components — look at `ScopeMembers.module.css` first and
  bring over only the classes this page's JSX actually references (e.g. a loading-overlay wrapper,
  a muted-text class for the empty state) rather than copying the whole file speculatively.

Run the tests from 5.1 — all green.

### 5.3 Refactor
If `canDelete`'s body or the row-rendering JSX grows past what's already sketched above and starts
looking unwieldy inside the `.map()`, extract a small named sub-component or helper **within this
same file** (not a new shared file) per `.claude/rules/react.md` §3.3 — this logic is specific to
this one page. Re-run 5.1's suite — stays green. If no extraction is warranted, skip and say so.

## 6. Routing + dashboard entry point — Red then Green

### 6.1 Red — test file
Read `Front/src/apps/coach/pages/team-dashboard/__tests__/TeamDashboardCards.permissions.test.tsx`
first — it already exists and asserts permission-gated card visibility; **do not break it**. Add a
new, separate test file
`Front/src/apps/coach/pages/team-dashboard/__tests__/TeamDashboardCards.teamUsers.test.tsx`
(new file, not appended to the permissions one — different concern, per
`.claude/rules/frontend-testing.md` §2.1's "a test file can cover one aspect" guidance), mocking
`usePermissions` the same way the sibling file does (`hasFeatureAccess: () => true` is irrelevant
to this new card since it is **not** gated by `hasFeatureAccess` per design.md Decision 6 — mock it
anyway since the component still calls the hook for its other cards).

Cover:
1. When rendered with `isPlayer={false}`, `TeamDashboardCards` renders a link named
   "Gestión de usuarios" whose `href` is `` `/coach/team-users?teamId=${team.id}` `` for a non-null
   `team` fixture (`getByRole("link", { name: "Gestión de usuarios" })`, assert its `href`
   attribute).
2. When rendered with `isPlayer={true}`, the "Gestión de usuarios" link is absent
   (`queryByRole("link", { name: "Gestión de usuarios" })` is `null`).
3. When rendered with `isPlayer={false}` and `team={null}`, the link still renders with `href="/coach/team-users"`
   (no `teamId` query param) — mirror the `team?.id ? ... : ...` fallback pattern every other card
   in this file already uses.

Run `npm run test -- TeamDashboardCards.teamUsers` from `Front/` — confirm it fails (card doesn't
exist yet, or `isPlayer` isn't even wired to the render).

### 6.2 Green
Two edits:

**a) `Front/src/apps/coach/routes.tsx`**: add, alongside the other `lazy()` declarations near the
top (next to `TeamRules`/`Sanctions` etc.):
```typescript
const TeamUsers = lazy(() => import("./pages/team-users/TeamUsers"));
```
and, inside `CoachRoutesContent`'s `<Routes>`, alongside the `team-dashboard`/`dashboard` routes
(**not** wrapped in `RequireFeaturePermission`, per design.md Decision 6 — every other route in
this file *is* wrapped, this one deliberately is not):
```tsx
<Route path="team-users" element={<TeamUsers />} />
```
Place it near `<Route path="team-dashboard" element={<TeamDashboard />} />` for readability, not
alphabetically forced elsewhere in the file.

**b) `Front/src/apps/coach/pages/team-dashboard/TeamDashboardCards.tsx`**:
- Add `import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";` to the icon imports.
- Change the function signature from
  `export default function TeamDashboardCards({ team, selectedSeason }: TeamDashboardCardsProps) {`
  to
  `export default function TeamDashboardCards({ team, selectedSeason, isPlayer }: TeamDashboardCardsProps) {`
  (destructure the prop that's already declared in the interface at line 21 but currently unused).
- Add one more `DashboardCard`, gated by `!isPlayer` (not `hasFeatureAccess`, per design.md
  Decision 6), placed near the top of the cards list (e.g. right after the opening `<div>` or
  right before the `Squad` card — a natural "manage the team" entry point position, your call):
  ```tsx
  {!isPlayer && (
    <DashboardCard
      title="Gestión de usuarios"
      description="Administra las cuentas del equipo."
      icon={<ManageAccountsIcon style={{ fontSize: 40 }} />}
      to={team?.id ? `/coach/team-users?teamId=${team.id}` : "/coach/team-users"}
    />
  )}
  ```

Run the tests from 6.1 — green. Also re-run
`TeamDashboardCards.permissions.test.tsx` (its own existing suite) — confirm still green; if it
fails because it now unexpectedly renders/hides the new card, check whether it renders
`TeamDashboardCards` without passing `isPlayer` at all (look at that file's `renderCards()` helper)
— if so, the new card's `!isPlayer` gate with `isPlayer` defaulting to `undefined` must evaluate to
"card shown" (`!undefined === true`) consistently with how that file's existing assertions don't
already assert on this specific card's absence/presence; this should not break anything since that
file only asserts on the pre-existing 12 cards, but read its full content before touching
`TeamDashboardCards.tsx` to be sure no assertion incidentally collides.

### 6.3 Regression check
Run:
```
npm run test -- Front/src/apps/coach/pages/__tests__
npm run test -- team-dashboard
npm run build
```
(adjust the first path glob if `pages/__tests__` isn't a real directory — check with `Glob` first;
the intent is "every existing coach `pages/` test file still passes", run `npm run test` scoped as
tightly as you reasonably can, then the full suite in section 7 catches anything missed). All must
pass / build clean.

## 7. Frontend verification

1. From `Front/`, run `npm run test` for the **full** suite — 100% pass rate, zero skipped tests
   (`it.skip`/`describe.skip` is not acceptable — if you find yourself wanting one, stop and report
   why instead).
2. Run `npm run build` — clean, no new TypeScript strict errors, no new warnings you introduced.
3. From the repo root, run `openspec validate coach-team-user-management --strict` — must report no
   errors. If it does, read them and fix only if they concern something this frontend work
   introduced (do not touch proposal.md/design.md content itself unless a genuine drift is found —
   flag it in your report rather than silently rewriting the spec).
4. Re-read design.md's "API Contract" section (already reproduced above) against the final
   `TeamUsers.tsx` behavior you implemented: no delete button on a self or creator row ever, a
   delete button on Coach/Directive rows only when `callerIsCreator === true`, and the confirmation
   dialog is unskippable (no code path from the delete icon's `onClick` directly to
   `deleteTeamUserAccount` — it must always go through `setDeleteTarget` → dialog → confirm).
5. Open `openspec/changes/coach-team-user-management/tasks.md` and mark every checkbox in sections
   **4, 5, 6, and 7 only** as `[x]` (sections 1-3 are already `[x]` from the backend work — leave
   them as-is, do not re-touch).

## Do not do

- Do not touch anything under `Back/ExtractionApi/`.
- Do not modify `Front/src/shared/pages/ScopeMembers/ScopeMembers.tsx` or
  `Front/src/shared/services/scopes/scopesApi.ts` — those back the separate, creator-only billing
  page (design.md Non-Goals) and are explicitly out of scope.
- Do not wrap the new `team-users` route in `RequireFeaturePermission` — design.md Decision 6
  explains why (no matching `COACH_FEATURE_ROUTES`/`FeaturePermission` seed exists; gating is
  `!isPlayer` only, the backend enforces the real per-row rules).
- Do not add a new `COACH_FEATURE_ROUTES` entry or touch
  `Front/src/apps/coach/constants/featureRoutes.ts` — out of scope per design.md Decision 6's Open
  Question (flagged there as a follow-up, not part of this change).
- Do not create a new shared Axios instance — extend nothing, `teamUsersService.ts` imports the
  existing `core/api/client` default export directly.
- Do not create a barrel `index.ts` for `pages/team-users/`.
- Do not use `any` in TypeScript — use `unknown` + narrowing where the type is genuinely uncertain
  (e.g. parsing an Axios error's `response.data`), matching `ScopeMembers.tsx`'s own
  `isAxiosErrorWithProblem` pattern (which does use `as any` internally at line 42 — that is the
  one pre-existing exception in the file you're duplicating from; keep the duplication faithful
  rather than "fixing" it as a scope-creeping change, unless you'd rather use `unknown` + a type
  guard instead, which is also fine and arguably better — your call, note which you chose).

## Final report format

List: files created, files modified (with a one-line reason each), full `npm run test` result
summary (pass count, 0 failed, 0 skipped), `npm run build` result, `openspec validate` result, and
any deviation from design.md or judgment call you made that wasn't explicitly spelled out above
(e.g. exact card placement in `TeamDashboardCards.tsx`, whether you used `useTeamAndClub()` vs
plain `useSearchParams()`, how you handled the `isAxiosErrorWithProblem` `any` vs `unknown` choice).
