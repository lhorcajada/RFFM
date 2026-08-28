## Context

**How a club-scoped Coach ends up with no team today.** `CreateUser.cs`
(`Features/Coaches/Users/Commands/CreateUser.cs:187-204`): a Coach registering with a
`ClubInvitationCode` gets a pending `ClubJoinRequest` — no `UserClub`, no Identity role yet. Once
approved (`ApproveClubJoinRequest.cs:128-133`), the handler adds exactly one row:
`_db.UserClubs.Add(new UserClub(joinRequest.ApplicationUserId, joinRequest.ClubId,
joinRequest.MembershipId))`, then assigns the `Coach` Identity role. **No `UserTeam` is ever
created for this path.** Contrast with a Coach who registers *without* a club code (the
free-trial/self-service path, `CreateUser.cs:118-122`): that coach becomes the creator of their
own new club (elsewhere in the club-creation flow, out of scope here) and, in practice, creates
their own first team through the normal team-creation UI — they hit "Mi equipo" only after
already having something to land on.

**Club-level `UserClub` access already implies "can manage every team in the club."**
`TeamEditAuthorization.CanEditAsync` (`Features/Coaches/Teams/TeamEditAuthorization.cs:9-28`):
```csharp
var isClubManager = await db.UserClubs.AnyAsync(uc =>
    uc.ApplicationUserId == userId && uc.ClubId == clubId &&
    (uc.RoleId == Membership.Directive.Id || uc.RoleId == Membership.Coach.Id), cancellationToken);
if (isClubManager) return true;
```
and `GetTeams.cs` (`TeamsQuery` handler) already lists **every** team in the club's active season
for a `UserClub` member, marking `CanEdit = isClubManager || coachTeamIds.Contains(t.Id)`. So the
authorization side of "let a club-level coach act on any of the club's teams" is **already
correct and needs no change**. The gap is purely about *which team the frontend currently shows*
— nothing sets a `teamId`/preference for this coach anywhere in the approval flow.

**How the frontend resolves "which team" today.** `useTeamAndClub.tsx:30-44` (`resolveTeamId`):
URL `?teamId=` param first, then `configurationCoachService.getAll()[0].preferredTeamId`, else
`null` → `CoachDashboard` renders with no team title/subtitle and `DashboardCards` (via
`useUserTeams.ts`) still lists team cards fetched through `getUserClubs()` → `getTeams(clubId)`
per club — so a club-level coach with no preference *can* reach any of their club's teams by
navigating to `/coach/dashboard` and clicking a card, **provided the club has an active season**
(`GetTeams.cs:70-73` throws `NoActiveSeason` otherwise, silently swallowed per-club by
`useUserTeams.ts:37-40`'s `catch`, leaving an empty "Acceso Rápido" section with no explanation).
This existing card-browsing path is **not removed** by this change — it remains a valid secondary
way to reach a team. What's missing is the *primary, discoverable* path the user explicitly
described: typing the team code they were given, right at the "Mi equipo" entry point, instead of
guessing that an empty dashboard means "go find a card."

**Existing code-validation patterns to reuse the shape of, not the substance of:**
- `ValidateTeamCode.cs` (`GET /api/catalog/team/by-code/{code}`): resolves a `Team` by
  `JoinCode`, **no ownership/club check at all** — used today only as a first step before
  `VerifyPlayerIdentity`, which re-scopes to the specific `TeamId` returned. Not reusable as-is
  here because it never checks the caller's existing club access, and our new endpoint must.
- `ValidateTeamJoinCode.cs` (`POST /api/invitations/team/validate`): creates a **new**
  `UserTeam` and calls `_scopeAuth.FindActiveScopeAsync` to reject the caller if they **already**
  belong to any scope (club or team) — by design, for a fresh joiner with no existing membership.
  **Not reusable as-is**: our coach already has an active scope (their `UserClub`), so this
  endpoint would incorrectly return `409 Conflict "Ya perteneces a otro espacio"` for exactly the
  user this change targets.
- `ConfigurationCoach.cs` (`Features/Coaches/Settings/ConfigurationCoach.cs`): the existing
  `PUT/POST /api/coaches/configuration` endpoints let an authenticated coach set
  `PreferredTeamId` to **any string**, with no validation that the team exists or that the coach
  has access to it (`UpdateConfigHandler`/`CreateConfigHandler`, no `Teams`/`UserClubs` lookup at
  all). This is the existing, un-validated write path `Settings.tsx`'s `TeamSelector` component
  relies on today for the *manual* "pick from a dropdown of teams you already have access to"
  flow. Our new endpoint writes to the same table but adds the validation this change actually
  needs (does this code belong to a team in *my* club?) before writing.

## Goals / Non-Goals

**Goals:**
- Give a club-scoped Coach (a `UserClub` with `RoleId == Coach`, no matching `UserTeam`) a
  direct, discoverable way — a code prompt at the "Mi equipo" entry point — to pick which team of
  their club to land on.
- Enforce, server-side, that the entered team code resolves to a team belonging to a club the
  caller already has Coach/Directive `UserClub` access to; never trust a client-supplied
  `clubId`/`teamId` pairing.
- Reuse the existing `CodeInputDialog` component and `ConfigurationCoach.PreferredTeamId` storage
  — no new dialog component, no new persistence entity.
- Keep `TeamEditAuthorization`, `GetTeams`, and the existing dashboard card-browsing path
  (`useUserTeams`) completely unchanged — this change only adds a second, faster way to arrive at
  the same already-authorized destination.

**Non-Goals:**
- Not creating a `UserTeam` row for this coach. Club-level `UserClub` access already grants edit
  rights to every team in the club (see Context); a `UserTeam` would be redundant bookkeeping and
  risks confusing `TeamEditAuthorization.CoachTeamIdsAsync` (which assumes a `UserTeam` means "a
  coach explicitly scoped to *this one* team", used for `GetTeams.CanEdit`'s second condition) —
  see Decision 2.
- Not changing how a self-service (free-trial) Coach registers or creates their first team — that
  path is unaffected and out of scope.
- Not changing `ValidateTeamCode`, `ValidateTeamJoinCode`, or the Player/FamilyMember/ClubMember
  onboarding branches in `useTeamAppEntry.ts` — this is an additive branch alongside them.
- Not letting a coach re-enter a team code to *switch* their preferred team from `Settings.tsx`
  differently than today — that manual dropdown flow is untouched. (A side benefit: since our new
  endpoint only fires when `preferredTeamId` is unset, a coach who already picked a team via
  `Settings` will not be re-prompted — see Decision 4.)
- Not addressing `GetTeams.cs`'s `NoActiveSeason` failure mode (silently empty dashboard cards
  for a club with no active season) — flagged as a pre-existing, separate gap in Risks, not fixed
  here.

## Decisions

### 1. New backend endpoint, not a reuse of `ValidateTeamJoinCode` or `ConfigurationCoach`'s raw CRUD
**Decision**: Add `POST /api/invitations/team/enter-as-coach` (feature file
`Features/Coaches/Invitation/Commands/EnterClubTeamAsCoach.cs`, same folder/style as
`ValidateTeamJoinCode.cs`) as a **new**, narrow, `IFeatureModule`.
**Why**: `ValidateTeamJoinCode` is scope-guarded for *first-time* joiners (`FindActiveScopeAsync`
rejects anyone with an existing `UserClub`/`UserTeam`) — reusing it would require weakening that
guard for everyone, which would break its actual purpose (preventing a Player from joining two
teams). `ConfigurationCoach`'s CRUD endpoints have no ownership validation at all — writing
directly through them from the frontend would mean trusting the client to have already confirmed
club/team ownership, which this change explicitly must not do (a malicious or buggy client could
set an arbitrary `PreferredTeamId`, and while that alone doesn't grant write access — real writes
still go through `TeamEditAuthorization`/`GetTeams`'s own checks — it would still let the coach
land on a dashboard showing a team's read-only management surface they have no legitimate
relationship to). A new, single-purpose endpoint keeps the validation exactly where it belongs
and matches the vertical-slice convention (one feature = one file).
**Alternative considered**: Loosen `ValidateTeamJoinCode`'s scope check to allow same-club
re-entry. Rejected — that endpoint's response/side effects (creates a `UserTeam`, checks
subscription seat billing implicitly via later flows) are shaped for a brand-new membership, not
"resolve which existing-access team to display," and conflating the two would make both harder to
reason about later.

### 2. No `UserTeam` row is created — only `ConfigurationCoach.PreferredTeamId` is written
**Decision**: The new endpoint does **not** call `_db.UserTeams.Add(...)`. It only upserts the
caller's `ConfigurationCoach` row with `PreferredTeamId = team.Id` (and `PreferredClubId =
team.ClubId`, for consistency with the shape `Settings.tsx` already persists).
**Why**: `TeamEditAuthorization.CanEditAsync` already grants this coach edit rights on this team
purely from their `UserClub` row — a `UserTeam` would be duplicate, unnecessary state.  Worse,
`TeamEditAuthorization.CoachTeamIdsAsync` and `GetTeams.cs`'s `coachTeamIds.Contains(t.Id)` use
`UserTeams` to mean "explicitly scoped to this one team" (relevant for a coach who joined a
*single* team without club-wide rights, e.g. via a hypothetical future team-level coach
invitation) — adding a `UserTeam` here would conflate "has an ambient preference" with "is
individually scoped," muddying that distinction for any future feature that reads `UserTeam` to
mean the latter.
**Alternative considered**: Create a `UserTeam(userId, team.Id, Membership.Coach.Id)` alongside
the `UserClub`, mirroring `ValidateTeamJoinCode`. Rejected per above — redundant given club-level
access already covers it, and risks the `CoachTeamIdsAsync` semantic drift just described.

### 3. Writing to `ConfigurationCoach` from a second feature file
**Decision**: `EnterClubTeamAsCoach.Handler` writes directly to
`_db.Set<RFFM.Api.Domain.Entities.Coaches.ConfigurationCoach>()` (same entity `ConfigurationCoach.cs`'s
handlers use), rather than internally invoking `CreateConfigCommand`/`UpdateConfigCommand` via
`IMediator.Send`.
**Why**: `ConfigurationCoach.cs`'s existing `CreateConfigHandler`/`UpdateConfigHandler` do a
plain, unconditional field overwrite with no domain invariants to preserve — there is no
behavior to reuse beyond "does a row for this coach already exist." A direct
`FirstOrDefaultAsync` + add-or-update in the new handler is simpler and avoids a same-request
mediator-calling-mediator hop (`.claude/rules/dotnet.md` favors direct, minimal handlers). This
does mean the "does the coach have a `ConfigurationCoach` row" existence check is now duplicated
in two files — acceptable, it's three lines, and the two features have genuinely different
authorization needs (open self-service CRUD vs. validated code-entry) that would be awkward to
merge into one handler.
**Alternative considered**: Send `CreateConfigCommand`/`UpdateConfigCommand` from inside
`EnterClubTeamAsCoach.Handler`. Rejected as unnecessary indirection for a two-field upsert with no
shared invariants.

### 4. Frontend trigger condition: `ChangeRoleDialog` → "Continuar" → check `preferredTeamId` first
**Decision**: In `useTeamAppEntry.ts`, `handleKeepRole` becomes:
1. `setChangeRoleOpen(false)`.
2. `const current = await configurationCoachService.getCurrent();`
3. If `current?.preferredTeamId` → `navigate("/coach/dashboard")` (unchanged existing behavior —
   `CoachDashboard` will resolve that `teamId` itself, exactly as it does today).
4. Else → open `CodeInputDialog` with a new `selectedUserType = "CoachClubTeam"` config
   (`title: "Código de equipo"`, same copy pattern as the existing team-code prompt), so the coach
   is asked for a code instead of landing on an empty dashboard.
**Why**: `preferredTeamId` is the same signal `CoachDashboard`/`useTeamAndClub` already trust to
decide whether there's "something to show"; reusing it here means the new prompt appears exactly
when — and only when — the existing dashboard would otherwise render empty for this coach, with
no new backend signal needed to detect the gap. It also means a coach who *did* configure a
preferred team via `Settings` is never re-prompted, and a coach who wants to switch teams can
simply clear their preference there (existing, unchanged UI) to get the prompt again.
**Alternative considered**: Add a new "does this coach have a `UserTeam`" backend check and use
that as the gating signal instead. Rejected — it wouldn't actually match reality for a
multi-team-club coach who intentionally has no single `UserTeam` and manages several teams by
`UserClub` access alone (they'd be gated on a signal that's never true for them, prompting every
single login); `preferredTeamId` is the correct, already-established "there's nothing to show"
signal, and it's already fetched by the dashboard, so this reuses an existing round trip's
semantics rather than inventing a new one.
**Scope of the check**: applied only inside the branch already gated by `hasRole("Coach")`
opening `ChangeRoleDialog` (`AppSelector.tsx:113-119`); Administrator's identical branch is
**unchanged** — Administrators are out of scope for this bug (see proposal.md).

### 5. Response shape and navigation on success
**Decision**: `EnterClubTeamAsCoach` returns `{ teamId, teamName }` (same shape as
`ValidateTeamCode.ValidateTeamCodeResponse`); the frontend then calls
`navigate(`/coach/dashboard?teamId=${teamId}`)` directly (skipping a second round trip to
`configurationCoachService`, since the endpoint already persisted the preference server-side).
**Why**: Matches the existing Player/FamilyMember code-entry pattern in `useTeamAppEntry.ts`
(`handleCodeAccept`'s existing branches already navigate with an explicit `teamId` after a
successful code validation) — no new response shape convention introduced.

## API Contract (for the frontend)

```
POST /api/invitations/team/enter-as-coach
Authorization: Bearer <jwt>              # role: Coach (Administrator not required to call this,
                                          # but not blocked either — server-side check is UserClub-based)
Body: { "code": "ABCD1234" }

200 OK
  { "teamId": "...", "teamName": "..." }
  — code resolved to a team whose ClubId matches a UserClub the caller has with
    RoleId in {Coach, Directive}; ConfigurationCoach.PreferredTeamId (and PreferredClubId)
    upserted for the caller.

400 Bad Request
  ProblemDetails — code missing/malformed (FluentValidation: NotEmpty, same length/charset rule
  as ValidateTeamCode.Validator: 8 alphanumeric chars).

404 Not Found
  ProblemDetails{ Title: "Código no válido", Detail: "..." } — no Team with that JoinCode exists.

403 Forbidden
  ProblemDetails{ Title: "Acceso denegado",
                   Detail: "Este código pertenece a un equipo de otro club." }
  — team exists but the caller has no UserClub (RoleId Coach/Directive) for that team's ClubId.

401 Unauthorized — not authenticated (unchanged, standard pipeline behavior).
```

The frontend (`useTeamAppEntry.ts`'s new branch in `handleCodeAccept`) follows the same
error-surfacing pattern already used for the Player/FamilyMember/ClubMember branches: show
`error.response?.data?.detail` in `CodeInputDialog`'s inline error text, and also dispatch
`rffm.show_snackbar`.

## Risks / Trade-offs

- **[Risk]** A coach whose club has no active season still cannot reach any team (`GetTeams.cs`
  throws `NoActiveSeason`) even after this change, because the new endpoint's success response
  only needs the target `Team` row to exist (not an active season) — so this specific failure
  mode is not hit by `EnterClubTeamAsCoach` itself, but the coach would still land on
  `/coach/dashboard?teamId=...` where downstream team-scoped pages may behave oddly without an
  active season. → **Mitigation**: out of scope for this change (pre-existing gap, see
  Non-Goals); flagged for a separate fix if it proves to matter in practice.
- **[Risk]** `preferredTeamId`-based gating (Decision 4) means a coach who manually clears their
  preferred team in `Settings` will see the code prompt again on next "Mi equipo" click, even
  though they already have full club access and could instead be shown the existing dashboard
  card list. → **Accepted**: this is the intended, more explicit UX per the bug report; the card
  list (`useUserTeams`) is still reachable by navigating to `/coach/dashboard` (e.g. via browser
  back or a direct link) for a coach who prefers browsing over typing a code.
- **[Trade-off]** Two backend write paths now exist for `ConfigurationCoach.PreferredTeamId`
  (the pre-existing, unvalidated CRUD in `ConfigurationCoach.cs`, and this change's validated
  upsert in `EnterClubTeamAsCoach.cs`). → **Accepted**: documented in Decision 3; the CRUD
  endpoints remain the manual-settings path (`Settings.tsx`'s `TeamSelector`), unchanged.

## Migration Plan

No database schema change — `ConfigurationCoach` already exists with `PreferredTeamId`/
`PreferredClubId` columns.
1. **Backend** (coordinate with back-specialist): implement
   `Features/Coaches/Invitation/Commands/EnterClubTeamAsCoach.cs` per the API contract above, with
   FluentValidation on the code shape (reuse `ValidationConstants.TeamJoinCodeLength`/pattern from
   `ValidateTeamCode.Validator`), and xUnit tests covering: unknown code (404), code for a team in
   a club the caller has no `UserClub` for (403), code for a team in the caller's club (200 +
   `ConfigurationCoach` row created/updated), and re-entry when a `ConfigurationCoach` row already
   exists (200 + row updated, not duplicated).
2. **Frontend**: add `enterClubTeamByCode` to `teamService.ts`; extend `useTeamAppEntry.ts`
   (`handleKeepRole` gating + new `handleCodeAccept` branch for `selectedUserType ===
   "CoachClubTeam"`); no changes to `AppSelector.tsx`'s JSX (only the hook's internal wiring
   changes) or to `CodeInputDialog.tsx` (reused as-is).
3. Ship backend first (additive, unused until the frontend calls it) or together — no ordering
   constraint; the frontend change is inert without the endpoint (its new branch simply wouldn't
   exist yet), so backend-first carries no risk of a broken intermediate state.
4. Run `dotnet test` (new handler tests) and `npm run test` (new hook/dialog tests) before
   marking tasks complete; `npm run build` must still pass.
