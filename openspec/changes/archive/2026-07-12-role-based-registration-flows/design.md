# Design — role-based-registration-flows (Backend)

Scope of this document: **backend only** (`Back/ExtractionApi/`). Frontend consumes the
contracts described here but its implementation is out of scope.

## Context

- `CreateUser` (`POST /api/register`, `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Users/Commands/CreateUser.cs`)
  today only accepts `AccountType` `Coach`/`Directive`, always creates a 7-day `Subscription`
  on the `Free` `PaymentPlan`, and returns `IResult` directly (no `ICommand<T>`/validator-driven
  DTO — the file already deviates from the "return a typed DTO" convention used elsewhere, it
  builds `ProblemDetails` by hand for every branch).
- `ValidateInvitationCode` (`api/invitations/club/validate`) and `ValidateTeamJoinCode`
  (`api/invitations/team/validate`), both in `Features/Coaches/Invitation/Commands/`, are
  `.RequireAuthorization()` endpoints that read `ClaimTypes.NameIdentifier` from the JWT,
  **mutate** state (`_db.UserClubs.Add(...)` / `_db.UserTeams.Add(...)`), assign an Identity
  role, and re-issue a JWT. They assume the caller already has an account. Today
  `ValidateInvitationCode` explicitly rejects `Membership.Coach` and `Membership.Directive`
  ("requieren cuenta pagadora, no código de invitación").
- `Membership` (`Domain/Aggregates/UserClubs/Membership.cs`) is the vocabulary used by both
  validate endpoints (`Directive, Coach, ClubMember, Player, FamilyPlayer, Follower`);
  `AppRoles` (`Domain/Entities/AppRoles.cs`) is the Identity/frontend vocabulary
  (`Administrator, Federation, Coach, ClubDirector, Player, FamilyMember, Fan, ClubMember`).
  `MembershipIdentityRoles` (`Features/Coaches/Invitation/MembershipIdentityRoles.cs`) is the
  existing, single source of truth mapping between the two — this design reuses it as-is and
  does not introduce a second mapper.
- `GetPlayersByTeam` (`Features/Coaches/Players/Queries/GetPlayersByTeam.cs`,
  `GET /api/catalog/team/{teamId}/players`) already returns the roster of a team
  (`PlayersByTeamResponse[]`, keyed by `TeamPlayer.Id` as `Id` and `Player.Id` as `PlayerId`).
  This is the existing feature the proposal refers to for "the player list" — no new Players
  feature is needed, only reuse of this query's handler logic.
- There is **no existing link** between an `ApplicationUser` and a specific `Player`/`TeamPlayer`
  record. `TeamPlayer.FamilyMembers` (`Domain/Entities/TeamPlayers/TeamPlayer.cs`) is unrelated
  contact-info data, not an account link — don't confuse the two. `UserTeam` (the join row created
  by `ValidateTeamJoinCode`) has no player reference today; this design adds one.
- There is **no existing per-club billing/seat concept**. `PaymentPlan`/`Subscription`
  (`Domain/Entities/PaymentPlan.cs`, `Subscription.cs`) model a single flat trial/paid
  subscription owned by one user (the scope "creator" — see `ScopeAuthorizationService`,
  `EnsureSubscriptionActiveOrEvictAsync`). Club-level per-seat billing for accepted
  coaches/members is new domain territory this design must define minimally (no payment
  gateway integration — proposal explicitly scopes that out).
- A **separate, pre-existing gate** already exists at login: `TokenService.GenerateTokenForUser`
  rejects login with `CodeMessages.LoginEmailNotConfirmed` when `IdentityUser.EmailConfirmed`
  is `false`. Every registration today sends a confirmation-request email to the **admin**
  (not the user) via `ConfirmUserTemplate`, and `ConfirmEmail.cs` is the endpoint the admin's
  link hits to flip `EmailConfirmed = true`. This is a **platform-level moderation gate**,
  orthogonal to the new **club-level acceptance gate** this change introduces for invited
  coaches. Both gates must be able to co-exist without confusing error messages (see
  "Interaction with the existing EmailConfirmed gate" below).
- `ErrorCodes` (`Domain/ErrorCodes.cs`) is the single source of truth for `ProblemDetails`
  `Extensions["code"]` values (see archived change `2026-07-11-unified-error-codes-i18n`). This
  design adds new constants there instead of literals, following that convention.

## Goals / Non-Goals

**Goals:**
- `POST /api/register` supports all 6 `AccountType` values with role-specific validation,
  atomically (either the whole registration succeeds — account + role + club/team link — or
  none of it does).
- Invalid/expired/foreign-role invitation codes are rejected **before** any account is created,
  with a clear `ErrorCodes` entry, and never leave a half-created user behind.
- A coach who registers with a club invitation code is not billed and has no access until the
  club (its creator/director) approves; approval is the trigger point for a per-seat billing
  hook (domain model + hook only, no gateway call).
- Player/FamilyMember registration exposes the team roster so the frontend can render a picker,
  and persists the chosen player link.
- Reuse `MembershipIdentityRoles` for all role-vocabulary translation; reuse
  `GetPlayersByTeam`'s query logic for the roster; do not fork either.

**Non-Goals:**
- No real payment gateway integration for per-seat billing — only the domain hook/entity that a
  future change wires up to Stripe/etc.
- No change to the existing admin `EmailConfirmed` moderation gate's own mechanics (email
  template, admin confirm link) beyond documenting how it interacts with the new club-acceptance
  gate.
- No change to `Fan`/Federation-app gating (already handled elsewhere, per proposal).
- Frontend `Register.tsx` rework — tracked by the front specialist, out of scope here.

## Decisions

### 1. Anonymous **preview** endpoints, join happens inside `CreateUser` — option (a)

The proposal frames this as the central open question. Decision: **option (a)**, anonymous
read-only preview endpoints, with the actual `UserClub`/`UserTeam` write happening inside
`CreateUser`'s own transaction.

**New anonymous endpoints** (both `AllowAnonymous()`, no side effects, no JWT issued):
- `POST api/invitations/club/preview` → `PreviewClubInvitationCode` feature.
- `POST api/invitations/team/preview` → `PreviewTeamInvitationCode` feature.

**Why (a) over (b) (two-phase: bare account → auto-login → call existing authenticated
endpoints):**
- (b) would require `CreateUser` to fabricate a JWT and call back into the mediator pipeline
  for a second command, effectively re-implementing a client of its own API in-process, or
  duplicating the join logic anyway — it doesn't actually avoid a fork, it just relocates it
  behind an internal HTTP-shaped hop for no benefit.
- (b) creates a window where a real Identity user exists with **no** role/club/team link if the
  second phase fails (e.g. code became invalid between phase 1 and phase 2 — a TOCTOU race that
  is *more* likely with two network round trips than with one transaction). This directly
  contradicts the goal "invalid codes must not let registration proceed."
- (a) keeps `POST /api/register` atomic and keeps the existing authenticated endpoints'
  contract **unchanged** for their current caller (a logged-in user joining a second club/team
  post-registration — e.g. the "join another space" flows already built on top of them). This
  matters because `ValidateInvitationCode`/`ValidateTeamJoinCode` also drive
  `EnsureSubscriptionActiveOrEvictAsync`-adjacent flows and re-issue a JWT — behavior that must
  stay intact for that caller.

**Why extract, not fork, the validation logic:** both preview handlers and the existing
authenticated handlers need the same three checks (membership-kind allowed for this
code-type, code exists, not-already-a-member/duplicate). Introduce two small static/internal
helper methods reused by both:
- `InvitationCodeLookup.FindClubByCode(AppDbContext, string code)` →
  `(Club? club, Membership? membershipAllowedCheck)` — actually kept simple: a
  `ClubInvitationValidation` static class with `Validate(AppDbContext, code, membershipKind)`
  returning a small result record (`Club`, `Membership`, or a `ProblemDetails`-shaped error),
  called by both `PreviewClubInvitationCode` and the existing `ValidateClubInvitationHandler`.
  Same pattern for teams (`TeamInvitationValidation`).
- These helpers do **not** touch `_db.UserClubs`/`_db.UserTeams` or Identity — only the
  membership/club/team lookup rules. The mutation (`Add(...)`, role assignment, JWT) stays in
  each caller (`ValidateClubInvitationHandler` for the authenticated post-login case,
  `CreateUser.Handler` for registration).
- Net effect: **zero duplicated business rules**, two call sites per validation, each doing its
  own side effects.

**Restriction lifted, precisely:** `ValidateClubInvitationHandler`/`PreviewClubInvitationCode`
still reject `Membership.Directive` for a code (a director never registers via invitation code —
unchanged). The `Membership.Coach` rejection is **lifted only in the club-code path**
(`ClubInvitationValidation`), since a coach *can* now join via club code. The **team-code path**
(`TeamInvitationValidation`, backing `ValidateTeamJoinCode`/`PreviewTeamInvitationCode`) keeps
rejecting `Coach`/`Directive`/`ClubMember` unchanged — coaches don't join via team code, only via
club code.

### 2. `CreateUser.Command` new shape

```csharp
public class Command : IInvalidateCacheRequest, IRequest<IResult>
{
    public string Alias { get; set; } = null!;
    public string Email { get; set; } = null!;
    public string Password { get; set; } = null!;
    public string AccountType { get; set; } = null!;       // one of AppRoles: Coach, ClubDirector, Player, FamilyMember, Fan, ClubMember

    // ClubDirector, and Coach without ClubInvitationCode
    public bool? TrialAccepted { get; set; }

    // Coach (with code) and ClubMember
    public string? ClubInvitationCode { get; set; }

    // Player and FamilyMember
    public string? TeamInvitationCode { get; set; }
    public string? TeamPlayerId { get; set; }   // TeamPlayer.Id chosen from the roster (not Player.Id — see §4)

    public string PrefixCacheKey => UserConstants.CachePrefix;
}
```

`AccountType` now accepts the full `AppRoles` catalog except `Administrator`/`Federation`
(those are provisioned out-of-band, not via self-registration — unchanged from today's implicit
behavior). `Validator` (FluentValidation) enforces the conditional shape declaratively:

```csharp
RuleFor(r => r.Alias).NotEmpty();
RuleFor(r => r.Email).NotEmpty().EmailAddress();
RuleFor(r => r.Password).NotEmpty();
RuleFor(r => r.AccountType).NotEmpty()
    .Must(BeAKnownSelfRegisterableRole);

When(r => IsClubDirector(r.AccountType) ||
          (IsCoach(r.AccountType) && string.IsNullOrWhiteSpace(r.ClubInvitationCode)), () =>
{
    RuleFor(r => r.TrialAccepted).Equal(true)
        .WithMessage(/* -> ErrorCodes.TrialAcceptanceRequired */);
});

When(r => (IsCoach(r.AccountType) && !string.IsNullOrWhiteSpace(r.ClubInvitationCode)) ||
          IsClubMember(r.AccountType), () =>
{
    RuleFor(r => r.ClubInvitationCode).NotEmpty();
});

When(r => IsPlayer(r.AccountType) || IsFamilyMember(r.AccountType), () =>
{
    RuleFor(r => r.TeamInvitationCode).NotEmpty();
    RuleFor(r => r.TeamPlayerId).NotEmpty();
});
```

This validator only enforces **shape** (required fields per role); it cannot check
"does this code actually exist" (needs DB access FluentValidation rules could do via injected
`AppDbContext`, but existing validators in this codebase are pure/sync — keep that convention).
Code existence/role-compatibility is re-checked in the `Handler` (it must be, regardless of what
the anonymous preview endpoint returned, since the code could be consumed/rotated between the
frontend's preview call and the actual submit — same TOCTOU concern as §1).

### 2a. Response shape — rename `RegisterPayingAccountResponse` → `RegisterAccountResponse`,
keep `IResult`, one type with a `Status` discriminant

**Correction to the Context section above**: `CreateUser` building `IResult` by hand isn't
actually a lone deviation to fix — it's the same pattern `ValidateClubInvitationHandler`
(`Features/Coaches/Invitation/Commands/ValidateInvitationCode.cs`) already uses for a command
with several non-200 outcomes (`Results.BadRequest`/`NotFound`/`Conflict`, all hand-built
`ProblemDetails`). The reason is structural, not accidental: `DomainException` (the codebase's
"throw and let middleware build `ProblemDetails`" convention, see `AddCustomProblemDetails` in
`DependencyInjection/ServiceCollectionExtensions.cs`) is **hard-coded to map to HTTP 400** —
`setup.Map<DomainException>(... StatusCodeProblemDetails(StatusCodes.Status400BadRequest) ...)`,
no per-exception status. Any handler that legitimately needs 404 (unknown code) or 409 (already
claimed/already decided) alongside 400 cannot use `DomainException` for those branches and must
return `IResult` directly, exactly like `ValidateClubInvitationHandler` does today. `CreateUser`
needs 404 (`ClubInvitationCodeInvalid`/`TeamInvitationCodeInvalid`) and 409
(`LinkedPlayerAlreadyClaimed`) alongside its 400s, so it **stays** `IRequest<IResult>` — moving it
to a typed `ICommand<T>` would either lose those status codes (collapse everything to 400 via
`DomainException`) or require inventing a per-status-code exception hierarchy, which is a
cross-cutting change well beyond this feature's scope. Every rejection branch still sets
`Extensions["code"]` from `ErrorCodes` by hand, same as `ValidateClubInvitationHandler` already
should (and per the Error Handling section below, now does).

**Response DTO — one type, not a split, with a `Status` discriminant:**

```csharp
public enum RegistrationStatus { Active, PendingClubApproval }

public class RegisterAccountResponse   // renamed from RegisterPayingAccountResponse
{
    public string UserId { get; set; } = string.Empty;
    public string[] Roles { get; set; } = Array.Empty<string>();
    public RegistrationStatus Status { get; set; }
    public SubscriptionDto? Subscription { get; set; }        // null unless Status == Active
                                                                // AND the role has a trial (ClubDirector, no-code Coach)
    public string? ClubJoinRequestId { get; set; }             // set only when Status == PendingClubApproval
}
```

Considered and rejected: splitting into genuinely distinct response types (e.g.
`Results<Ok<ActiveTrialAccountResponse>, Ok<ActiveNoSubscriptionAccountResponse>,
Ok<PendingClubApprovalAccountResponse>>` via `TypedResults`, .NET 7+'s union-return feature for
Minimal APIs). Rejected because the frontend consumer **already knows which outcome to expect**
before it gets a response — it picked the role, it knows whether it submitted a trial acceptance,
a club code, or neither (see the frontend section's `RegisterFormState.role`/`coachHasClubCode`).
A discriminated union return only earns its complexity when the caller must *infer* the outcome
from the response shape alone; here it doesn't have to, so one DTO with a `Status` field plus
nullable "only meaningful for this status" fields is honest without adding OpenAPI/`TypedResults`
machinery that Swashbuckle documents poorly for same-status-code multi-shape 200s anyway. This
also directly answers the frontend design's open question about
`PendingClubApprovalNotice`/whether a later "me" query is needed for the pending state (§6,
frontend Open Questions): `ClubJoinRequestId` is returned **immediately** at registration time, so
a future status-polling feature has a concrete id to query against without a separate backend
change to "find my pending request."

Rename applies everywhere the type is referenced: the `.Produces<RegisterPayingAccountResponse>`
attribute on the `api/register` route becomes `.Produces<RegisterAccountResponse>`, and
`Results.Ok(new RegisterPayingAccountResponse { ... })` in the handler becomes
`Results.Ok(new RegisterAccountResponse { ..., Status = RegistrationStatus.Active })` (or
`.PendingClubApproval` for the Coach-with-code branch, which never sets `Subscription`).
`SubscriptionDto` itself is unchanged (still nested, still nullable-by-omission today, now
nullable-by-type).

### 3. `CreateUser.Handler` — per-role branches, one transaction

`Handler` gains a `TransactionScope`-wrapped body (or `IDbContextTransaction` shared across
`AppDbContext` and the Identity operations — see "Migration Plan" note on cross-context
transactions) so that: Identity user creation, role assignment, `UserClub`/`UserTeam` insert (or
`ClubJoinRequest` insert for the pending-coach case), and `Subscription` insert either all commit
or all roll back. This is a **behavior tightening** versus today's `CreateUser`, which already
tolerates partial failure (subscription/email failures are caught-and-logged, not fatal) — that
laxity is fine for a subscription record, but not acceptable for a club/team membership row,
so the new branches must not reuse the "swallow and log" pattern for anything security/billing
relevant.

Branch table:

| AccountType | Pre-checks (before `CreateAsync`) | Post-create side effect | Subscription |
|---|---|---|---|
| `ClubDirector` | `TrialAccepted == true` else 400 `ErrorCodes.TrialAcceptanceRequired` | assign `AppRoles.ClubDirector` | Free 7-day trial (today's behavior, unchanged) |
| `Coach`, no code | `TrialAccepted == true` else 400 | assign `AppRoles.Coach` | Free 7-day trial (unchanged) |
| `Coach`, with `ClubInvitationCode` | `ClubInvitationValidation.Validate(code, Membership.Coach)` → club must exist, code valid, membership kind allowed (see §1) | create `ClubJoinRequest` (Pending) — **no** `UserClub` row yet, **no** Identity role yet (see §5) | none |
| `ClubMember` | `ClubInvitationValidation.Validate(code, Membership.ClubMember)` | create `UserClub` (active, `IsCreator=false`) + assign `AppRoles.ClubMember` | none |
| `Player` | `TeamInvitationValidation.Validate(teamCode, Membership.Player)` + `TeamPlayerId` belongs to that team's roster and isn't already linked (see §4) | create `UserTeam` with `LinkedTeamPlayerId` + assign `AppRoles.Player` | none |
| `FamilyMember` | same as `Player` but `Membership.FamilyPlayer` | create `UserTeam` with `LinkedTeamPlayerId` + assign `AppRoles.FamilyMember` | none |
| `Fan` | none | assign `AppRoles.Fan` | none |

All branches still run the existing `_scopeAuth`-style "already in a scope" check is **not**
applicable here (the user doesn't exist yet, so it can't already have a scope) — but the
**target club/team** duplicate-membership check (`alreadyInClub`/`alreadyInTeam` in the existing
validate handlers) doesn't apply either, since it's a *brand-new* user. What **does** apply: the
`TeamPlayerId` "not already linked to another account" check (new — see §4), because two
different family members could otherwise both try to claim the same player concurrently; enforce
it with a DB unique constraint (see §4), not just an application-level check, to close the race.

Every rejection path returns the same `ProblemDetails` shape already used elsewhere in
`CreateUser.cs` (`Results.BadRequest`/`Results.NotFound`/`Results.Conflict` with
`Extensions["code"]`), reusing `ErrorCodes` constants — see "Error Handling" below for the full
list of new codes.

### 4. Player roster + `LinkedTeamPlayerId`

`PreviewTeamInvitationCode`'s response gains a `Players` array reusing
`GetPlayersByTeam.PlayersByTeamRequestHandler`'s query (call it directly, or better: extract its
`Handle` body into a small internal static/query helper `TeamRosterQueries.GetRoster(AppDbContext,
teamId)` shared by both `GetPlayersByTeam` and `PreviewTeamInvitationCode`, to avoid a duplicated
LINQ projection). Response shape:

```csharp
public class ValidateTeamInvitationResponse   // and the new PreviewTeamInvitationResponse
{
    public string TeamId { get; set; }
    public string TeamName { get; set; }
    public string ClubId { get; set; }
    public string MembershipKind { get; set; }
    public string? Token { get; set; }           // only on the authenticated endpoint, null on preview
    public TeamRosterPlayerDto[] Players { get; set; } = Array.Empty<TeamRosterPlayerDto>();  // only when MembershipKind is Player/FamilyPlayer
}

public class TeamRosterPlayerDto
{
    public string TeamPlayerId { get; set; }   // = TeamPlayer.Id, this is what CreateUser.TeamPlayerId must reference
    public string PlayerId { get; set; }
    public string Name { get; set; }
    public string? LastName { get; set; }
    public string? UrlPhoto { get; set; }
    public int? Dorsal { get; set; }
    public bool AlreadyLinked { get; set; }     // true if another account already claimed this TeamPlayer
}
```

The roster is returned **as part of the code-validation response** (not a separate endpoint),
since the frontend always needs it right after a successful team-code validation for
Player/FamilyMember, and a separate call would just be a second anonymous endpoint leaking the
same data with an extra round trip. `AlreadyLinked` lets the frontend grey out taken players
without a second query.

**New relationship**: add nullable `LinkedTeamPlayerId` (FK to `TeamPlayer.Id`) on `UserTeam`
(`Domain/Aggregates/UserClubs/UserTeam.cs`), populated only for `Membership.Player`/
`Membership.FamilyPlayer` rows. `UserTeamEntityConfiguration` adds a unique filtered index
`(LinkedTeamPlayerId)` where `LinkedTeamPlayerId IS NOT NULL AND RoleId = Player`, so a given
player can have **one** `Player`-kind account (the player themself) — but note family members
are expected to share a player (a mother and father both linking to the same child), so the
uniqueness constraint applies **only to `Membership.Player`**, not to `Membership.FamilyPlayer`.
`AlreadyLinked` in the roster response reflects this same rule (computed per membership kind
requested).

### 5. Coach club-acceptance flow — new aggregate `ClubJoinRequest`

New entity, `Domain/Aggregates/UserClubs/ClubJoinRequest.cs` (`BaseEntity`, `IAggregateRoot`):

```csharp
public class ClubJoinRequest : BaseEntity, IAggregateRoot
{
    public string ApplicationUserId { get; private set; }
    public string ClubId { get; private set; }
    public int MembershipId { get; private set; }        // always Membership.Coach.Id for this change; kept generic for future reuse
    public ClubJoinRequestStatus Status { get; private set; }
    public DateTime RequestedAt { get; private set; }
    public DateTime? DecidedAt { get; private set; }
    public string? DecidedByUserId { get; private set; }  // null for Approved/Rejected only if never set; always null for Cancelled (see below)

    public Club Club { get; set; } = null!;
    public Membership Membership { get; set; } = null!;

    public static ClubJoinRequest Create(string applicationUserId, string clubId, int membershipId) { ... }
    public void Approve(string decidedByUserId) { /* guards Status == Pending, else DomainException */ }
    public void Reject(string decidedByUserId) { ... }
    public void Cancel() { /* guards Status == Pending, else DomainException; sets DecidedAt, leaves DecidedByUserId null — see "Applicant self-withdrawal" below */ }
}

public enum ClubJoinRequestStatus { Pending = 0, Approved = 1, Rejected = 2, Cancelled = 3 }
```

`Cancelled` is a new value on the existing `int` column — **no migration needed** beyond the one
already planned for the table itself (adding an enum member doesn't change the schema).

Why a new aggregate instead of a `Pending` status on `UserClub` itself: `UserClub` is read
throughout the app (`ScopeAuthorizationService.FindActiveScopeAsync`,
`EnsureSubscriptionActiveOrEvictAsync`, `GetUserClubs`, `GetScopeMembers`, ...) as "this user is
an active member of this club" — overloading it with a pending state would force every one of
those call sites to filter by status defensively, a much larger, riskier diff than adding one
new table that's only queried by the two new club-acceptance endpoints and the login-time gate.
A pending coach has **no** `UserClub` row at all until approved, so all existing club-membership
queries continue to work unmodified — this is the smallest-diff option consistent with vertical
slice (isolate the new concept in its own file/table rather than mutating a widely-shared one).

**This is a management surface, not just three CRUD-shaped endpoints.** Beyond letting a director
approve/reject a single request, the user explicitly asked for "un sistema en backend para la
gestión de aprobaciones" — so this design also covers: seeing decided requests (not just
pending), a cheap count for a notification badge, and letting the applicant withdraw before a
decision. It deliberately stops short of a full workflow/audit-trail feature (see "What's
intentionally not built" at the end of this subsection) — `DecidedAt`/`DecidedByUserId` already
on the entity make "history" a query-filter concern, not a new domain concept, so the extra
surface is small.

**New endpoints** (feature file `Features/Coaches/ClubJoinRequests/...`, mirroring
`RemoveScopeMember`'s authorization pattern — caller must be the club's creator, verified via
`IScopeAuthorizationService.EnsureCreatorAsync(userId, ScopeKinds.Club, clubId, ...)`, except
`CancelClubJoinRequest` which is applicant-only, see below):

- `GET api/clubs/{clubId}/join-requests?status={pending|decided|all}` (`GetClubJoinRequests` —
  renamed from `GetPendingClubJoinRequests` now that it covers history too) — creator-only,
  `IQueryApp<ClubJoinRequestDto[]>`. `status` defaults to `pending` (today's only behavior,
  unchanged for the primary "act on these" screen); `decided` returns `Approved`/`Rejected`/
  `Cancelled` (director's history view — "who did I approve/reject, and who withdrew");  `all`
  returns everything. One endpoint with a filter, not three near-duplicate list endpoints — the
  underlying query is the same shape (`ClubJoinRequests` filtered by `ClubId` + optional
  `Status` set), so a second/third endpoint would just be the same handler with a different
  `Where`. `ClubJoinRequestDto` includes `Status`, `RequestedAt`, `DecidedAt`, and — for decided
  rows — the deciding director's alias (resolved via `_userManager.FindByIdAsync(DecidedByUserId)`,
  null for `Cancelled` since nobody but the applicant closed it). No pagination: request volume
  per club is bounded by how many coaches ever apply to that one club, the same "roster-sized, not
  internet-sized" reasoning already used for `TeamPlayerPicker`'s roster list — add pagination
  later only if a real club shows this assumption is wrong.
- `GET api/clubs/{clubId}/join-requests/count` (`GetPendingClubJoinRequestsCount`) — creator-only,
  `IQueryApp<ClubJoinRequestCountDto>` returning `{ PendingCount: int }`. Split out from the list
  endpoint because a badge/notification indicator (e.g. on the director's dashboard or
  `AppSelector`, wherever the frontend decides to surface it) needs to be cheap to poll on every
  page load without pulling every pending applicant's alias/email — a single `COUNT(*)` query,
  `ICacheRequest`-eligible like other `IQueryApp` reads, invalidated by the same
  `IInvalidateCacheRequest` prefix as approve/reject/cancel below so the badge is never stale by
  more than one request-response cycle regardless of the default 1h `CachingBehavior` TTL. Kept
  because the alternative (frontend always fetching the full pending list just to read
  `.length`) forces a heavier payload onto a UI surface that only needs a number.
- `POST api/club-join-requests/{requestId}/approve` (`ApproveClubJoinRequest`) — creator-only:
  1. loads the `ClubJoinRequest`, guards `Status == Pending` and caller is the club creator
     (via `EnsureCreatorAsync`), 2. calls `request.Approve(callerUserId)`, 3. creates the
     `UserClub` row (`IsCreator=false`, `Membership.Coach`), 4. assigns `AppRoles.Coach` Identity
     role, 5. calls the billing hook (see below), 6. sends the applicant a "you've been
     accepted" email (reuse `EmailService`, new template e.g. `ClubJoinApprovedTemplate`), all
     in one transaction.
- `POST api/club-join-requests/{requestId}/reject` (`RejectClubJoinRequest`) — creator-only,
  same shape, no `UserClub`/billing/role, sends a rejection email instead.
- `POST api/club-join-requests/{requestId}/cancel` (`CancelClubJoinRequest`) — **applicant-only**,
  not creator-only: guards `Status == Pending` and that the caller's `NameIdentifier` claim equals
  `ClubJoinRequest.ApplicationUserId` (403 `ErrorCodes.ClubJoinRequestCancelForbidden` otherwise,
  same shape as the existing `ClubAccessDenied`/`TeamAccessDenied` 403s), then calls
  `request.Cancel()`. No email (the applicant already knows — they just clicked the button); no
  billing/role/`UserClub` to undo since none was ever created for a pending request. This closes
  the "wrong club code" gap: today, a coach who mistypes/mis-picks a club code at registration
  (per `CreateUser`'s `ClubJoinRequest`-create branch) has no self-service way out other than
  waiting for the director to reject it or contacting support — and they *can* reach this endpoint
  because login only gates on `EmailConfirmed` (§6), not club approval, so a pending coach already
  has a working JWT session. Resubmitting a **new** code after cancelling is explicitly out of
  scope here (it would need a new authenticated "join a club" command distinct from
  registration's `CreateUser` — a bigger, separate feature); a cancelled applicant's path back in
  today is the same as any other second-club-join scenario the proposal already excludes.
- **Director notification on new request** (not a new endpoint — a side effect inside
  `CreateUser.Handler`'s Coach-with-code branch): after the `ClubJoinRequest` is created, send the
  club's creator a best-effort email (reuse `EmailService`, new template
  `ClubJoinRequestReceivedTemplate`; creator's email resolved via the `UserClub` row where
  `IsCreator = true` for that club → `_userManager.FindByIdAsync(...).Email`), same
  "swallow-and-log, non-fatal" pattern as `SendConfirmationEmailAsync` — this isn't a security or
  billing operation, so a failed notification must not block registration. Without this, a
  director would only discover a pending request by remembering to check the management screen;
  the existing proposal only scoped an *approve/reject* email to the applicant, leaving the
  director's own "something is waiting on you" notification unaddressed — this closes that gap
  with the same email infrastructure already in place, no new channel.

**What's intentionally not built** (so this stays a focused management surface, not a workflow
engine): no separate audit-log entity — `Status`/`RequestedAt`/`DecidedAt`/`DecidedByUserId` on
the aggregate itself already answer "who decided what and when" without a second table; no
rejection-reason free-text field — not requested, and the existing rejection email already tells
the applicant the outcome; no re-open/undo of a decided request — `Approve`/`Reject`/`Cancel` are
one-way per §5's guard (`Status == Pending` required), matching how `UserClub`/`UserTeam`
membership rows aren't "undone" elsewhere in this codebase either (removal is a separate
`RemoveScopeMember`-style operation, not a reversal of the join decision); no in-app/push
notification channel — email is the only channel this codebase has (`EmailService`), and adding a
new one is a cross-cutting concern out of scope for a registration-flow change.

**Billing hook**: introduce `IClubSeatBillingService` with a single method
`Task<ClubSeatCharge> ChargeSeatAsync(string clubId, string newMemberUserId, int membershipId, CancellationToken ct)`,
called from `ApproveClubJoinRequest`'s handler right after the `UserClub` insert. Its only
implementation for this change (`ClubSeatBillingService`) does **not** call any payment gateway —
it persists a new lightweight ledger entity:

```csharp
public class ClubSeatCharge   // Domain/Entities/ClubSeatCharge.cs, plain EF entity like Subscription/PaymentPlan (not BaseEntity/aggregate — it's a billing record, not a domain-behavior entity, same reasoning as Subscription)
{
    public int Id { get; set; }
    public string ClubId { get; set; }
    public string ChargedUserId { get; set; }     // the accepted coach/member
    public int PriceCents { get; set; }            // resolved from a per-seat plan/config, out of scope to price here
    public DateTime ChargedAt { get; set; }
    public ClubSeatChargeStatus Status { get; set; }  // Pending = 0 (until a real gateway settles it), Waived = 1 (manual/free tier)
}
```

This gives the domain model and the exact hook point ("on approve, before returning 200") a
future payment-gateway change can wire a real charge into, without this change needing to decide
pricing/gateway. `PriceCents` sourced from a new `PaymentPlans` row (`"Seat"` plan, mirroring how
`CreateFreeTrialSubscriptionAsync` lazily creates the `"Free"` plan) — kept `Pending` status
until a future change settles it; `ApproveClubJoinRequest` does not block on billing succeeding
(billing failure is logged, approval still completes — consistent with today's
"subscription/email are best-effort" pattern in `CreateUser`, which is appropriate here because
this is a ledger record, not a security boundary).

### 6. Interaction with the existing `EmailConfirmed` (admin) gate

The pending-coach's `IdentityUser` is still created with `EmailConfirmed = false` like every
other registration, and the existing admin-confirmation email still fires unchanged (this
change does not touch that flow — Non-Goal). Net effect for a pending coach: **two** gates must
clear before they can use the product — admin `EmailConfirmed` **and** club `ClubJoinRequest`
approval, in no particular required order. `TokenService.GenerateTokenForUser` keeps its existing
`EmailConfirmed` check unchanged; a coach who is admin-confirmed but still club-pending logs in
fine (JWT issued — that part doesn't change) but has no `UserClub`/scope, so
`ScopeAuthorizationService.FindActiveScopeAsync` returns `null` for them, same as any brand-new
Fan account today. The frontend is responsible for showing a "pending club approval" state when
no active scope exists for a Coach-role user with an unresolved `ClubJoinRequest` — this needs a
small read affordance: extend `GetUserClubs`/an equivalent "my status" query with the caller's
own pending `ClubJoinRequest` (if any) so the frontend can distinguish "no club yet, browse/join"
from "waiting on approval". Exact endpoint left to implementation (likely folded into an existing
"me"/profile query rather than a new one — flag as an implementation-time check against current
frontend session-bootstrap calls).

## New/Changed Endpoints (summary)

| Method & Route | Feature file | Auth | Change |
|---|---|---|---|
| `POST api/register` | `Features/Coaches/Users/Commands/CreateUser.cs` | Anonymous | Changed: 6 roles, new command fields, transactional per-role branching |
| `POST api/invitations/club/validate` | `Features/Coaches/Invitation/Commands/ValidateInvitationCode.cs` | Authenticated | Changed: lift `Coach` restriction (keep `Directive` restriction); delegate rule-checking to shared `ClubInvitationValidation` |
| `POST api/invitations/team/validate` | `Features/Coaches/Invitation/Commands/ValidateTeamJoinCode.cs` | Authenticated | Changed: response gains `Players[]`; delegate rule-checking to shared `TeamInvitationValidation` |
| `POST api/invitations/club/preview` | new: `Features/Coaches/Invitation/Commands/PreviewClubInvitationCode.cs` | Anonymous | New |
| `POST api/invitations/team/preview` | new: `Features/Coaches/Invitation/Commands/PreviewTeamInvitationCode.cs` | Anonymous | New, response includes roster |
| `GET api/clubs/{clubId}/join-requests?status=` | new: `Features/Coaches/ClubJoinRequests/Queries/GetClubJoinRequests.cs` | Authenticated (club creator) | New; `status` filter (`pending`\|`decided`\|`all`) covers both the action queue and history |
| `GET api/clubs/{clubId}/join-requests/count` | new: `Features/Coaches/ClubJoinRequests/Queries/GetPendingClubJoinRequestsCount.cs` | Authenticated (club creator) | New; cheap count for a notification badge |
| `POST api/club-join-requests/{requestId}/approve` | new: `Features/Coaches/ClubJoinRequests/Commands/ApproveClubJoinRequest.cs` | Authenticated (club creator) | New |
| `POST api/club-join-requests/{requestId}/reject` | new: `Features/Coaches/ClubJoinRequests/Commands/RejectClubJoinRequest.cs` | Authenticated (club creator) | New |
| `POST api/club-join-requests/{requestId}/cancel` | new: `Features/Coaches/ClubJoinRequests/Commands/CancelClubJoinRequest.cs` | Authenticated (**applicant**, not creator) | New; applicant self-withdrawal before decision |

## Domain Model Changes

- New: `Domain/Aggregates/UserClubs/ClubJoinRequest.cs` (+ `ClubJoinRequestStatus` enum, now
  including `Cancelled` for applicant self-withdrawal — no schema impact, same `int` column), new
  `IEntityTypeConfiguration<ClubJoinRequest>` under
  `Infrastructure/Persistence/Configuration/Aggregates/UserClubs/`. New `DbSet<ClubJoinRequest>
  ClubJoinRequests` on `AppDbContext`.
- New email templates: `ClubJoinApprovedTemplate`, `ClubJoinRejectedTemplate` (already implied by
  the approve/reject endpoints), and `ClubJoinRequestReceivedTemplate` (new — notifies the club
  creator that a coach applied, sent from `CreateUser.Handler`'s pending-coach branch).
- New: `Domain/Entities/ClubSeatCharge.cs` (+ `ClubSeatChargeStatus` enum), new
  `IEntityTypeConfiguration<ClubSeatCharge>`, new `DbSet<ClubSeatCharge> ClubSeatCharges` on
  `AppDbContext`. A `"Seat"` `PaymentPlan` row is lazily created the same way `"Free"` is today.
- Changed: `Domain/Aggregates/UserClubs/UserTeam.cs` gains nullable `LinkedTeamPlayerId` (FK to
  `TeamPlayer.Id`) + a domain method to set it (validated: non-empty only for
  `Player`/`FamilyPlayer` membership). `UserTeamEntityConfiguration` gains the FK and the filtered
  unique index described in §4.
- Unchanged (used as-is, per proposal): `AppRoles`, `Membership`, `MembershipIdentityRoles`.
- New `ErrorCodes` constants (see below).
- New `IClubSeatBillingService`/`ClubSeatBillingService` under
  `Domain/Services/` (mirrors `ITokenService`/`TokenService` placement), registered in DI
  alongside the existing `IScopeAuthorizationService`.
- New shared validation helpers `ClubInvitationValidation`/`TeamInvitationValidation` — placed
  in `Features/Coaches/Invitation/` (sibling to the files that consume them), not `Domain/`,
  since they return `ProblemDetails`-shaped results (HTTP concern), consistent with how
  `ScopeAuthorizationService` already mixes domain lookups with `ProblemDetails`-flavored
  results for this same feature area.

## Migration Plan

Single EF migration on `AppDbContext` (schema `app`, `CatalogConnection`) covering:
1. `ClubJoinRequests` table (FKs to `Clubs`, `Memberships` i.e. `Roles`).
2. `ClubSeatCharges` table (FK to `Clubs`; `ChargedUserId` is an Identity user id, cross-schema,
   so **no** FK constraint to `identity.AspNetUsers` — same pattern already used by
   `UserClub.ApplicationUserId`/`Subscription.UserId`, which are plain strings without a DB-level
   FK across schemas today).
3. `UserTeams.LinkedTeamPlayerId` nullable column + FK to `TeamPlayers` + the filtered unique
   index from §4.
4. No changes to `IdentityDbContext` or `FederationDbContext`.

Run via `.\manage-migrations.ps1` (per repo convention) — single migration, one feature-branch
worth of schema change, no data backfill needed (all new tables/nullable column).

**Cross-DbContext transaction note**: `CreateUser.Handler` and `ApproveClubJoinRequest`'s handler
both need atomicity across Identity operations (`UserManager<IdentityUser>`, which uses its own
`IdentityDbContext`) and `AppDbContext` writes. Recommend wrapping the handler body in
`System.Transactions.TransactionScope(TransactionScopeAsyncFlowOption.Enabled)` — this works
regardless of whether `IdentityConnection`/`CatalogConnection` point at the same physical
Postgres database or two different ones (in the latter case Npgsql's ambient-transaction support
promotes to a distributed transaction; in the former, single-phase). This is called out
explicitly because today's `CreateUser` does **not** do this (subscription/email failures are
swallowed) — that laxity must not be copied into the new club/team-membership branches, per §3.

## Error Handling

New `ErrorCodes` constants (added to `Domain/ErrorCodes.cs`, grouped under a new
"Role-based registration (Features/Coaches/Users/Commands/CreateUser.cs, `api/register`)"
comment block, replacing/extending the existing `AccountTypeRequired` block):

| Constant | HTTP | Meaning |
|---|---|---|
| `ErrorCodes.TrialAcceptanceRequired` | 400 | ClubDirector/no-code-Coach registered without `TrialAccepted = true` |
| `ErrorCodes.ClubInvitationCodeRequired` | 400 | Coach-with-code/ClubMember missing `ClubInvitationCode` |
| `ErrorCodes.ClubInvitationCodeInvalid` | 404 | Code doesn't match any club |
| `ErrorCodes.ClubInvitationCodeNotAllowedForRole` | 400 | e.g. Directive attempting a club-code registration |
| `ErrorCodes.TeamInvitationCodeRequired` | 400 | Player/FamilyMember missing `TeamInvitationCode` |
| `ErrorCodes.TeamInvitationCodeInvalid` | 404 | Code doesn't match any team |
| `ErrorCodes.TeamInvitationCodeNotAllowedForRole` | 400 | e.g. ClubMember attempting a team-code registration |
| `ErrorCodes.LinkedPlayerRequired` | 400 | Player/FamilyMember missing `TeamPlayerId` |
| `ErrorCodes.LinkedPlayerNotInTeam` | 400 | `TeamPlayerId` doesn't belong to the validated team's roster |
| `ErrorCodes.LinkedPlayerAlreadyClaimed` | 409 | `Membership.Player` re-claim of an already-linked `TeamPlayer` (see §4 uniqueness) |
| `ErrorCodes.ClubJoinRequestNotFound` | 404 | Approve/reject/cancel on unknown/foreign request id |
| `ErrorCodes.ClubJoinRequestAlreadyDecided` | 409 | Approve/reject/cancel on a non-`Pending` request |
| `ErrorCodes.ClubJoinRequestCancelForbidden` | 403 | `Cancel` called by a user who isn't the request's own applicant |

Existing codes reused unchanged: `EmailIsAlreadyTaken`, `AliasIsAlreadyTaken`, `UserCreationFailed`,
`ClubAccessDenied`/`TeamAccessDenied`-style codes already used by `ScopeAuthorizationService` for
the "not the club creator" 403 on the new approve/reject (and list/count) endpoints (no new code
needed there — `EnsureCreatorAsync` already returns a "Acción no permitida" 403 that the new
endpoints surface as-is, same as `RemoveScopeMember` does). `ClubJoinRequestCancelForbidden` is a
separate, new code because `Cancel`'s authorization check is the mirror image of the others (must
**be** the applicant, not the creator) and deserves its own message rather than overloading a
creator-oriented "access denied" string. All new codes are added as `Extensions["code"]` on
`ProblemDetails` at every throw site, per the unified-error-codes-i18n convention — no bare
`DomainException(..., code: "")` introduced by this change.

## Risks / Trade-offs

- [Cross-DbContext transaction] — `TransactionScope` around Identity + `AppDbContext` ops is new
  to this codebase (today's handlers don't need it since they tolerate partial failure). Mitigate
  by scoping it tightly (only the new/changed branches in `CreateUser` and
  `ApproveClubJoinRequest`), and by an integration test that kills the process mid-transaction
  equivalent (simulate a thrown exception after the `UserClub` insert but before commit) to prove
  no orphan Identity user is left over.
- [New `ClubJoinRequest` aggregate vs. reusing `UserClub` with a status] — chosen for isolation
  (§5), trade-off is one more table and one more set of endpoints to maintain; accepted because
  it protects ~6 existing call sites that assume `UserClub` == active membership.
- [`ClubSeatCharge` as a bare ledger, no gateway] — a future billing change must still design the
  actual charge/webhook flow; this only guarantees the hook fires at the right domain moment
  (club-approval) and the record exists to reconcile against later.
- [Filtered unique index for `LinkedTeamPlayerId`] — Postgres supports partial unique indexes
  natively (`CREATE UNIQUE INDEX ... WHERE ...`), so this is a plain EF Core
  `HasIndex(...).HasFilter(...)`, no Postgres-specific workaround needed.
- [Management surface scope: history filter + count + cancel, but no audit log/reopen/reason
  field] — the risk of stopping here is a future ask ("why did you reject me?" / "let me undo
  that rejection") isn't served by today's model; accepted because none of those were requested
  and the aggregate's own `Status`/`DecidedAt`/`DecidedByUserId` fields make adding a reason field
  or a reopen path an additive, non-breaking change later (no re-migration of history needed, just
  a new nullable column/method) — not designing them in now avoids guessing at requirements nobody
  asked for.
- [`GetClubJoinRequests`'s `status` query param vs. three separate endpoints] — one endpoint with
  a filter is less RESTfully "pure" than `/join-requests`, `/join-requests/history`, but the
  handler logic is identical modulo a `Where` clause; three endpoints would be three copies of the
  same query for no isolation benefit (unlike `ClubJoinRequest` vs. `UserClub`'s isolation
  argument in §5, there's no call site here that would be harmed by one shared query).

## Open Questions

- Exact wording/placement of the "pending club approval" status surfaced to the frontend (§6) —
  **partially addressed** by §2a now returning `ClubJoinRequestId` directly in
  `RegisterAccountResponse`, so the frontend has a concrete id to query/poll against without
  waiting on a new backend lookup; whether that polling hits `GetClubJoinRequests` (filtered to
  the caller's own request) or a dedicated "my status" field on a profile/bootstrap query is still
  left to implementation — flag it in `tasks.md` as a decision point requiring a quick look at
  what the frontend's session-bootstrap already calls, to minimize new frontend wiring.
- Per-seat price for the `"Seat"` `PaymentPlan` (`PriceCents`) is a business decision, not an
  architecture one — implementation should default it to `0`/config-driven, not hardcode a
  number in code, and this can be revisited without another migration (data change only).

---

# Design — role-based-registration-flows (Frontend)

Scope of this document: **frontend only** (`Front/`). Consumes the contracts fixed above
(`POST /api/register`'s new `Command` shape, the two new anonymous preview endpoints, and the
`ErrorCodes` catalog). Does not touch `Back/ExtractionApi/`.

## Context

- `Register.tsx` (`Front/src/shared/pages/auth/register/Register.tsx`) is a single flat form:
  three text fields + a two-option `RadioGroup` (`Coach`/`Directive`, using the **wrong**
  vocabulary — the backend `AccountType` now takes `AppRoles` values, and `"Directive"` was never
  valid there; today's radio just happens to work because `Coach` is the only shared string).
  It posts straight to `coachAuthService.registerPayingAccount` with a fixed 4-field payload —
  no room for conditional fields.
- `RegisterPayingAccountPayload` (`Front/src/shared/types/scope.ts:27-32`) is typed
  `accountType: "Coach" | "Directive"` — too narrow for the new contract and needs to shed
  `"Directive"` in favor of `"ClubDirector"` (matches `AppRoles`/`UserTypeDialog`'s `UserType`).
- `UserTypeDialog.tsx` already has the correct 6-value union (`UserType`) and Spanish labels —
  reused as-is for the role selector; no new label set invented.
- `invitationsApi.ts` only wraps the two **authenticated** validate endpoints
  (`validateClubCode`/`validateTeamCode`, both under `.RequireAuthorization()` server-side) with
  a `VITE_USE_MOCK` mock path. The new anonymous preview endpoints are a different contract
  (no `token` in the response, team preview adds `Players[]`) and belong in the same file as
  sibling methods, not a new service file — same client, same mock convention.
- `errorMessages.ts` + `locales/{es,en}/errors.json` is the existing, generic
  code→i18n-key→message pipeline (`mapApiErrorToMessage`, keyed off `ProblemDetails.Extensions
  ["code"]`). It requires **no new mapping logic** — only new JSON entries for the codes listed
  in the backend section's Error Handling table. This change adds keys, it doesn't touch the
  pipeline.
- `CoachTrialDialog.tsx` is a self-contained, presentational confirm/cancel dialog (open,
  isProcessing, onClose, onAccept props) currently mounted post-login in `AppSelector`. Its copy
  ("7 días gratis... tras ese periodo se cobrará") is exactly the message needed at register-time
  for `ClubDirector`/no-code `Coach` — reused, not rewritten, by lifting it out of
  `AppSelector`'s directory into `shared/components/` (see Component Breakdown) so both call
  sites (post-login AppSelector flow, and the new pre-submit register flow) import the same
  component instead of forking copy.
- `Register.module.css` already caps the card at `max-width: 500px` and uses a responsive
  `.options` row (`flex-direction: row` only above 600px) — a reasonable base, but it was written
  for a 3-field form. The role-conditional sections (code input, roster picker) need their own
  responsive treatment (see UX section below); the existing module is extended, not replaced.

## Goals / Non-Goals

**Goals:**
- Replace the 2-option radio with the full 6-role selector, reusing `UserTypeDialog`'s
  `UserType` union and labels as the single source of truth for role strings/labels sent in
  `AccountType`.
- Gate submission behind whatever the selected role requires (trial confirm, code+validation,
  code+validation+player pick) — the submit button must be unable to fire until those
  role-specific preconditions are satisfied, mirroring how the backend validator now requires
  them.
- Live-validate club/team codes against the new anonymous preview endpoints as the user types
  (debounced), surfacing inline errors from the same `errorMessages.ts` pipeline used everywhere
  else — no bespoke error strings.
- Render the team roster (Player/FamilyMember) as a responsive, single-column-on-mobile picker
  that greys out `AlreadyLinked` entries for `Player` (not for `FamilyMember`, per backend §4).
- Ship this test-first: Testing Library tests exist before the corresponding UI branch is wired.

**Non-Goals:**
- The "pending club approval" post-registration status screen's exact data source is an open
  backend question (design.md §6, backend section) — this design only specifies the **shape** of
  the confirmation screen/copy shown right after a Coach-with-code submits successfully; wiring
  it to a live status query is deferred until the backend's "me"/bootstrap endpoint decision
  lands (flagged, not blocking this design).
- No rework of `AppSelector`'s own post-login `CoachTrialDialog` usage beyond relocating the
  component file so it can be shared — its existing call site/behavior there is unchanged.
- No visual redesign of unrelated auth pages (`Login.tsx`, `ForgotPassword.tsx`, etc.).

## Component Breakdown

`Register.tsx` becomes a **role-conditional single-page form**, not a multi-step wizard. Reasons:
a wizard (separate routes/steps with back/next) adds routing/state-restoration complexity for
what is, per role, at most one extra input (a code) plus one extra confirm (trial or roster
pick) — conditionally rendering sections beneath the role selector keeps the whole flow on one
screen, one `handleSubmit`, and lets the user see immediately what a role requires before
committing to it (important since some roles need a code they may not have handy). All new
pieces are extracted into small, single-responsibility components so `Register.tsx` itself stays
an orchestrator:

```
Front/src/shared/pages/auth/register/
  Register.tsx                       # orchestrator: role state, submit gating, calls services
  Register.module.css                # extended: .roleSection, .codeField, .rosterList, etc.
  components/
    RoleSelector.tsx                 # thin wrapper around the same UserType option list/labels
                                      # as UserTypeDialog, rendered inline (not a dialog) —
                                      # a RadioGroup here, not a re-mount of UserTypeDialog itself
    RoleSelector.module.css
    InvitationCodeField.tsx           # TextField + debounced preview-endpoint call + inline
                                      # error/success affordance; parameterized by
                                      # kind: "club" | "team" so it's one component for
                                      # Coach-with-code/ClubMember/Player/FamilyMember
    InvitationCodeField.module.css
    TeamPlayerPicker.tsx              # responsive roster list/grid, selection state, disables
                                      # AlreadyLinked rows per role rules
    TeamPlayerPicker.module.css
    PendingClubApprovalNotice.tsx     # post-submit success state for Coach-with-code (copy-only,
                                      # per Non-Goals — no live status polling yet)
    PendingClubApprovalNotice.module.css

Front/src/shared/components/
  TrialConfirmDialog.tsx             # relocated from
                                      # apps/coach/.../AppSelector/components/CoachTrialDialog.tsx
                                      # (renamed since it's no longer Coach/AppSelector-specific —
                                      # ClubDirector uses identical copy); same props
                                      # (open, isProcessing, onClose, onAccept)
  TrialConfirmDialog.module.css
```

`AppSelector`'s existing call site is updated to import `TrialConfirmDialog` from
`shared/components/` instead of its own `components/CoachTrialDialog.tsx` — a rename + move, no
behavior change, so its own tests keep passing unmodified. `UserTypeDialog.tsx` itself is
**not** reused as a component in `Register.tsx` (it's a modal picker for a different flow —
choosing a role *after* landing on `AppSelector`); only its `UserType` union and label array are
imported/duplicated-as-a-shared-constant. Concretely, promote `USER_TYPE_OPTIONS` (currently a
private `const` inside `UserTypeDialog.tsx`) to an exported constant in a small shared module —
e.g. `Front/src/shared/constants/userTypes.ts` — imported by both `UserTypeDialog.tsx` and the
new `RoleSelector.tsx`, so the label set has exactly one source of truth instead of two files
independently agreeing on Spanish strings.

## State Management

Plain local component state in `Register.tsx` via `useState`/`useReducer` — no new context, no
external state library, consistent with the rest of `shared/pages/auth/*`. Shape:

```ts
type RegisterFormState = {
  alias: string;
  email: string;
  password: string;
  role: UserType | "";                      // from the shared userTypes constant

  // Trial gate (ClubDirector, Coach without code)
  trialAccepted: boolean;                   // only meaningful once TrialConfirmDialog is accepted
  trialDialogOpen: boolean;

  // Coach-only branch toggle
  coachHasClubCode: boolean | null;          // null = not yet answered

  // Code + preview state (club: Coach-with-code, ClubMember; team: Player, FamilyMember)
  invitationCode: string;
  codeValidation:
    | { status: "idle" }
    | { status: "checking" }
    | { status: "valid"; club?: PreviewClubResponse; team?: PreviewTeamResponse }
    | { status: "invalid"; errorCode: string };

  // Player/FamilyMember roster pick
  selectedTeamPlayerId: string | null;

  isSubmitting: boolean;
  formError: string;
  successMessage: string;
};
```

A `useReducer` is preferred over a flat pile of `useState` calls once `role` changes, because
switching role must atomically reset every role-specific field (code, trial flags, roster
selection) — a single `SET_ROLE` action doing that reset in one place is less error-prone than
five separate `setX("")` calls scattered across an `onChange` handler (a real risk here: forget
one and a stale `TeamPlayerId` from a previous role selection leaks into a `Fan` submission).
Derived "can submit" state (`canSubmit`) is a plain computed boolean from the reducer state, not
stored — e.g.:

```ts
const canSubmit =
  alias && email && password && role &&
  (role === "Fan" ||
   (isTrialRole(role) && trialAccepted) ||
   (isClubCodeRole(role) && codeValidation.status === "valid") ||
   (isTeamCodeRole(role) && codeValidation.status === "valid" && selectedTeamPlayerId));
```

## Live Code Validation Flow

`InvitationCodeField` owns its own debounce (~500ms, `useEffect` + `setTimeout`, cleared on
unmount/keystroke — the existing codebase has no shared debounce hook, so a small local one is
added here rather than pulling in a dependency) and calls the appropriate preview method:

```ts
// invitationsApi.ts additions — same file, same client, same mock convention
async previewClubCode(code: string): Promise<PreviewClubCodeResponse> { ... }   // POST /api/invitations/club/preview
async previewTeamCode(code: string): Promise<PreviewTeamCodeResponse> { ... }   // POST /api/invitations/team/preview
```

Both are `AllowAnonymous` server-side (no auth header needed, no `token` in the response — unlike
the existing authenticated `validateClubCode`/`validateTeamCode`, which still exist unchanged for
their own caller per the backend design). New response types are added to `types/scope.ts`
alongside the existing `ValidateClubCodeResponse`/`ValidateTeamCodeResponse` (sibling types, not
a refactor of those) — `PreviewTeamCodeResponse` additionally carries `players: TeamRosterPlayer[]`.

Sequence: keystroke → debounce → `status: "checking"` (small inline spinner in
`InvitationCodeField`, mirroring `CoachTrialDialog`'s existing `CircularProgress` pattern) →
on success `status: "valid"` (green check adornment, and for team codes the parent flips
`TeamPlayerPicker` into view with the returned roster) → on failure `status: "invalid"` with the
`ErrorCodes` value from `ProblemDetails.Extensions["code"]` run through the existing
`getErrorMessage(errorCode)` (not `mapApiErrorToMessage(error)`, since here we already have the
parsed code, not a raw Axios error — same underlying i18n lookup). The field is marked
`error`/`helperText` from that message; **`canSubmit` stays false** until `status === "valid"`,
which is the actual gate — there's no separate "Validate" button, the field self-validates.

Because the code can still change between preview and submit (TOCTOU, same concern the backend
design calls out for its own preview/`CreateUser` split), the submit handler treats a
`ClubInvitationCodeInvalid`/`TeamInvitationCodeInvalid`/`LinkedPlayerAlreadyClaimed` response from
`POST /api/register` itself as an equally valid failure mode — it re-runs the same
`getErrorMessage` mapping and surfaces it as `formError` (not a silent retry), so the UI doesn't
assume the earlier preview result is still true.

## Team Player Picker (`TeamPlayerPicker.tsx`)

Input: `players: TeamRosterPlayer[]` from the team preview response
(`{ teamPlayerId, playerId, name, lastName, urlPhoto, dorsal, alreadyLinked }`), `role: "Player" |
"FamilyMember"`, `selectedId`, `onSelect`.

Layout: a single-column list of row-cards (not a `Table` — a roster of names/photos/dorsals reads
naturally as a list, and a `Table` forces horizontal scroll on narrow screens, which the "must be
responsive" requirement explicitly calls out as unverified today). Each row: `Avatar` (falls back
to initials if `urlPhoto` is null, same convention as existing player-list components elsewhere
in `apps/coach`), name + dorsal, a `Radio`-style selected state. MUI `List`/`ListItemButton` with
`sx` for spacing rather than a new CSS grid, since it's inherently a vertical list at every
breakpoint (no multi-column layout needed even on desktop — a roster is typically small, tens not
hundreds of players) — this also gets keyboard/aria semantics for free instead of reimplementing
radio-in-a-card manually.

- `role === "Player"`: rows where `alreadyLinked === true` render `disabled` with a small
  "Ya vinculado" caption (MUI `ListItemButton disabled` + `Typography variant="caption"`), not
  removed from the list — the user should see the full roster and understand *why* a name is
  unavailable, not wonder why the team looks smaller than expected.
- `role === "FamilyMember"`: no row is disabled for `alreadyLinked` (family members are allowed to
  share a player per backend §4); `alreadyLinked` is ignored for this role entirely.
- Long rosters: the list sits inside a `Box` with `maxHeight` + `overflowY: auto` (own scroll
  region, not page scroll) so the surrounding form doesn't grow unboundedly tall on a 20+ player
  roster — same "content scrolls in its own container" principle used elsewhere for wide tables.
- Empty roster (edge case: team preview succeeds but returns zero players) renders a plain
  `Alert severity="warning"` inline instead of an empty list, so the user isn't stuck staring at
  nothing with no explanation.

## Trial Confirm Gate

`TrialConfirmDialog` (relocated `CoachTrialDialog`) is opened, not skipped, the moment the user
picks `ClubDirector` or picks `Coach` + answers "no code" — i.e. as soon as the role resolves to
a trial-requiring branch, not deferred to submit time. Accept → `trialAccepted: true` in state,
dialog closes, rest of the form becomes submittable (given alias/email/password are also filled).
Cancel → dialog closes, `trialAccepted` stays `false` **and the role selection itself is reset**
to unselected (not left on `ClubDirector`/`Coach` with a permanently-blocked submit button) —
this matches the proposal's "cancel → registration is aborted" instruction literally: aborting
the trial aborts the role choice that required it, rather than leaving the user stuck on a role
they explicitly declined to accept terms for. `Register.tsx` never calls `POST /api/register`
with `trialAccepted: false`; the dialog is a client-side gate, not a value forwarded when false.

For `Coach`, the "do you have a club invitation code?" question is a simple MUI `RadioGroup`
(Yes/No) rendered once `role === "Coach"` is picked, controlling which downstream section shows
(`InvitationCodeField` vs. the trial gate above) — modeled as `coachHasClubCode` in state, not a
third `UserType` value, since it's a sub-branch of one role, not a new role.

## Test Strategy (TDD — written before each branch)

Per CLAUDE.md's mandatory Red→Green→Refactor, tests are written first, one file per new
component plus an extended `Register.test.tsx`. Representative cases (not exhaustive):

- `RoleSelector.test.tsx`: renders all 6 role options with the shared labels; `onChange` fires
  with the correct `UserType` value; changing role after a code was entered clears it (covered at
  the `Register.tsx` integration level, see below, since the reset is `Register`'s job).
- `InvitationCodeField.test.tsx`: shows a checking spinner while the (mocked) preview call is
  in-flight; shows a green/valid affordance and calls `onValid(response)` on success; shows the
  i18n-mapped error message and calls `onInvalid` on a rejected preview call; debounces so rapid
  keystrokes issue only one network call (fake timers).
- `TeamPlayerPicker.test.tsx`: renders one row per player; `Player` role disables `alreadyLinked`
  rows and they're not selectable (`getByRole('button', { name: /Ya vinculado/ })` has
  `aria-disabled`); `FamilyMember` role renders the same rows as enabled; selecting a row calls
  `onSelect(teamPlayerId)`; empty array renders the warning `Alert` instead of an empty list.
- `TrialConfirmDialog.test.tsx` (moved/renamed from the existing `CoachTrialDialog` test, if one
  exists — verified/updated at implementation time, not duplicated): accept calls `onAccept`;
  cancel calls `onClose`; buttons disabled while `isProcessing`.
- `Register.test.tsx` (integration, `render` with a mocked `invitationsApi`/`coachAuthService`):
  - Selecting `Fan` enables submit with just alias/email/password, no dialog, no code field.
  - Selecting `ClubDirector` opens `TrialConfirmDialog`; canceling resets role to unselected and
    keeps submit disabled; accepting closes the dialog and enables submit.
  - Selecting `Coach` then "no code" behaves like `ClubDirector`'s trial gate.
  - Selecting `Coach` then "yes code": trial dialog never opens; entering an invalid code (mocked
    rejection) shows the inline error and keeps submit disabled; entering a valid code enables
    submit; submitting posts `AccountType: "Coach"` + `ClubInvitationCode` (no `TrialAccepted`)
    and, on success, renders `PendingClubApprovalNotice` instead of the generic success message.
  - Selecting `Player`: invalid team code blocks submit; valid code reveals the roster; picking an
    `alreadyLinked` row is impossible (disabled); submit is blocked until a non-linked row is
    picked; successful submit posts `AccountType: "Player"` + `TeamInvitationCode` +
    `TeamPlayerId`.
  - Selecting `ClubMember`: mirrors the Coach-with-code code-gate, no roster, no trial.
  - A `ProblemDetails` with `Extensions.code === "LinkedPlayerAlreadyClaimed"` returned from the
    actual submit (not the preview) renders the corresponding i18n message as `formError` — proves
    the TOCTOU re-check path (not just the preview path) is wired to the same error pipeline.

## i18n

New keys added to both `Front/src/shared/i18n/locales/es/errors.json` and `locales/en/errors.json`
— one per backend `ErrorCodes` constant from the Error Handling table above
(`TrialAcceptanceRequired`, `ClubInvitationCodeRequired`, `ClubInvitationCodeInvalid`,
`ClubInvitationCodeNotAllowedForRole`, `TeamInvitationCodeRequired`, `TeamInvitationCodeInvalid`,
`TeamInvitationCodeNotAllowedForRole`, `LinkedPlayerRequired`, `LinkedPlayerNotInTeam`,
`LinkedPlayerAlreadyClaimed`, `ClubJoinRequestNotFound`, `ClubJoinRequestAlreadyDecided`) — no
code changes to `errorMessages.ts` itself, since `getErrorMessage`/`mapApiErrorToMessage` already
do a generic code→key lookup with a sane fallback for anything not yet translated.

## Responsive Notes

- `Register.module.css`'s existing `max-width: 500px` card stays the right container size; the
  new sections (`RoleSelector`, `InvitationCodeField`, `TeamPlayerPicker`) are all designed to fit
  inside it at any width down to a small phone (~320px) rather than requiring a wider layout —
  no new breakpoint-driven multi-column layout is introduced, since the form is inherently a
  single vertical flow.
- `RoleSelector`'s `RadioGroup` drops the existing `row` prop used for the old 2-option group
  (`row` for 6 options wraps awkwardly on mobile) — stacked vertically at all widths, consistent
  with `UserTypeDialog`'s own non-`row` `RadioGroup`.
- `TeamPlayerPicker` rows use `flexWrap`/truncation (`text-overflow: ellipsis` via CSS Module) on
  long player names so a long name + dorsal + avatar doesn't overflow a narrow row.
- Verify at implementation time with the existing Playwright setup at common mobile viewport
  widths (e.g. 360×740), since this is flagged in the proposal as "not verified today" — add it
  as an explicit `tasks.md` verification step rather than assuming the CSS Module changes are
  sufficient without a real viewport check.

## Risks / Trade-offs

- [Single-page conditional form vs. wizard] — chosen for simplicity given the shallow depth (one
  extra field + one extra gate per role), but if a future role needs a deeper multi-step flow
  this file will need re-splitting; acceptable now, revisit if role complexity grows.
- [`useReducer` migration] — `Register.tsx` today uses five independent `useState` calls; moving
  to a reducer is a larger diff than strictly necessary for `Fan`/`ClubDirector` alone, but it's
  the safer foundation once 6 roles with cross-field resets are in play — accepted trade-off,
  done once rather than incrementally patched per role.
- [Debounce hook is local, not shared] — no existing shared debounce utility in `shared/hooks/`;
  adding one here that's local to `InvitationCodeField` risks slight duplication if another
  feature needs debouncing later. Acceptable for now; promote to `shared/hooks/useDebouncedValue`
  if a second consumer appears (YAGNI otherwise).
- [`PendingClubApprovalNotice` is copy-only, no live status] — depends on the backend's open
  question (§6 of the backend section); if that lands as a new "me" field, this component gets a
  follow-up change to poll/display live status rather than a static message. Flagged, not blocking.

## Open Questions

- Whether `PendingClubApprovalNotice` should route the user straight to `/login` (current generic
  post-register behavior) or to a dedicated "pending" route — depends on the backend's decision in
  §6 (backend section) about where "my pending club request" is surfaced; default to reusing the
  existing post-register redirect-to-`/login` behavior until that lands, since login already
  succeeds for an admin-confirmed-but-club-pending coach per the backend design.
- Whether `RegisterPayingAccountPayload`/`registerPayingAccount` in `coachAuthService` should be
  renamed now that it covers all 6 roles, not just "paying accounts" — naming cleanup, not
  architecture; left to implementation to decide alongside the type changes it already needs.

---

# Design Addendum — Frontend: Club Join Requests Management (director-facing)

Scope: **frontend only**. Consumes the backend endpoints from §5 of the backend section:
`GET api/clubs/{clubId}/join-requests?status={pending|decided|all}` (`GetClubJoinRequests`),
`GET api/clubs/{clubId}/join-requests/count` (`GetPendingClubJoinRequestsCount`),
`POST api/club-join-requests/{requestId}/approve`, `POST api/club-join-requests/{requestId}/reject`.
The backend section also defines a fourth endpoint, `POST api/club-join-requests/{requestId}/cancel`
(applicant-only self-withdrawal) — that is a **different** surface (the *applicant's* own
in-progress-registration status, not the director's management page) and is out of scope here;
flagged for whoever designs the applicant-facing "pending approval" status screen referenced in
the Frontend Register section's `PendingClubApprovalNotice`/Open Questions above.

## Context

- The only existing club-management surface a director/creator has today is
  `Front/src/shared/pages/ScopeMembers/ScopeMembers.tsx` — a shared (not coach-app-specific) page
  reached via `?scope=club|team&id=...`, backed by `Front/src/shared/services/scopes/scopesApi.ts`
  (`ScopesApi`, singleton `scopesApi` export). It already shows the club's invitation code and a
  members table with row-level destructive actions (remove member), each gated by an inline MUI
  `Dialog` (not the shared `ConfirmDialog` at `Front/src/shared/components/ui/ConfirmDialog/ConfirmDialog.tsx`
  — both patterns coexist in the codebase; this addendum uses the shared `ConfirmDialog` since it's
  the more reusable of the two and approve/reject is a new surface, not a copy of existing code).
- There is **no** coach-app layout/header file (`apps/coach` has no `Layout.tsx`/`Header.tsx`/
  `Nav.tsx`) and **no** existing MUI `Badge`-style notification-count pattern anywhere in the app.
  This addendum does not invent a global notification system — it adds one small, local badge on
  the existing entry point a director already visits (see "Surfacing pending requests" below),
  proportionate to what exists today.
- `invitationsApi.ts` (`Front/src/shared/services/invitations/invitationsApi.ts`) only wraps the
  applicant-facing code-validation endpoints — unrelated to this director-facing surface. A new
  service file is added instead, following the `scopes/scopesApi.ts` sibling-folder convention.
- The backend deliberately split listing into a dedicated cheap `.../count` endpoint (for a
  badge) and a filterable `.../join-requests?status=` endpoint (`pending` default, `decided` for
  history, `all`) — this design uses both exactly as split, rather than deriving a count from the
  full list client-side, since the backend already optimized for that.

## Goals / Non-Goals

**Goals:**
- A club director can see all `Pending` join requests for a club they created and approve or
  reject each one, with a confirmation step before the (irreversible) decision.
- A director can also view **decided** requests (approved/rejected/cancelled) as a lightweight
  history, since the backend already exposes this via `status=decided` at no extra design cost —
  presented as a second tab on the same page, not a separate route.
- The page reuses `ScopeMembers`' established look (MUI `Table`, `Paper`, loading/empty/error
  states, `Snackbar` feedback) rather than inventing a new visual language for club management.
- A director who lands on the club's existing members page (`ScopeMembers`) can tell, at a glance,
  that pending requests exist and navigate to them in one click, using the dedicated count
  endpoint — no separate polling mechanism, no email-adjacent in-app inbox.
- Mobile-responsive: single-column card list on narrow viewports instead of a horizontally-cramped
  table, per the project's blanket mobile requirement.

**Non-Goals:**
- No global notification center / bell icon — out of proportion to what exists in the app today.
- No optimistic UI for approve/reject — these mutate billing/role state server-side (per backend
  §5), so the UI waits for the response before updating the list (consistent with how
  `ScopeMembers`' remove-member action already waits for the request to resolve).
- No applicant-facing cancel/withdraw UI — that's the `cancel` endpoint's caller, a different
  page/flow entirely (see the scope note above), not part of this director-facing design.
- No audit-trail UI beyond the plain decided-requests list the backend already returns
  (`Status`, `RequestedAt`, `DecidedAt`, deciding director's alias) — no filtering/sorting/export
  beyond the two tabs (Pending / Decided), matching the backend's own "stop short of a workflow
  engine" scoping in §5.

## Where it lives

**New page**: `Front/src/shared/pages/ClubJoinRequests/ClubJoinRequests.tsx` (+ co-located
`ClubJoinRequests.module.css`), placed as a sibling of `ScopeMembers` rather than under
`apps/coach/` — it is reached via `?clubId=...` the same way `ScopeMembers` is reached via
`?scope=club&id=...`, and registered in `Front/src/core/router/AppRouter.tsx` alongside
`ScopeMembers`' own route (both are cross-app, creator-facing club pages, not coach-app-specific
in routing terms, matching the existing precedent of `ScopeMembers` living outside
`apps/coach/routes.tsx`).

**Navigation entry point**: rather than adding a new nav item (there is no coach nav/header to add
one to), a small **"Solicitudes de entrenadores" button with a count badge** is added next to the
existing "Rotar código" button in `ScopeMembers.tsx`'s code `Paper` block (only rendered when
`scopeKind === "club"` — join requests are a club-only concept, teams don't have them), linking to
`/club-join-requests?clubId={scopeId}`. This is the one place a director already lands to manage
their club, so it is the natural, minimal-diff place to surface the badge — no new page needs to
be visited "by habit" for the director to discover pending requests.

## Surfacing pending requests (the "badge")

`ScopeMembers.tsx`'s existing `loadAll()` (its `Promise.all` of `getInvitation` +
`listScopeMembers`) gains a third parallel call, **only when `scopeKind === "club"`**:
`clubJoinRequestsApi.getPendingCount(scopeId)` → `GET api/clubs/{clubId}/join-requests/count`.
Because the backend already provides a dedicated `{ PendingCount: int }` endpoint (cache-backed,
invalidated on approve/reject), this is a cheap, single-purpose call — no need to fetch the full
list just to read `.length`. The count renders as a plain MUI `Badge` (`badgeContent={pendingCount}`,
`color="error"`, invisible when `pendingCount === 0`) wrapping the new button. This keeps the
"notification" concept scoped to exactly the place it's actionable, rather than a persistent
global indicator — proportionate per the task's own instruction not to invent a full notification
system.

## Component Breakdown

```
Front/src/shared/pages/ClubJoinRequests/
  ClubJoinRequests.tsx            # orchestrator: tabs (Pending/Decided), fetch, approve/reject, dialogs
  ClubJoinRequests.module.css     # table wrapper (desktop) / card list (mobile) styles

Front/src/shared/services/clubJoinRequests/
  clubJoinRequestsApi.ts          # class + singleton export, USE_MOCK gate, mirrors scopesApi.ts
  __mocks__/clubJoinRequestsMock.ts
```

No new shared components beyond reusing `ConfirmDialog` (`shared/components/ui/ConfirmDialog/`)
for both approve and reject — same component, different `title`/`description`/`confirmText`
props per action, avoiding two near-duplicate dialogs. The Pending/Decided split uses MUI `Tabs`/
`Tab` (two tabs, no routing per tab — `activeTab` is local state, not a query param, since it's a
sub-view of one page, not a distinct navigable resource).

`clubJoinRequestsApi.ts` (shape, mirroring `scopesApi.ts`'s method-per-endpoint, USE_MOCK-gated
pattern exactly):

```ts
export type ClubJoinRequestStatusFilter = "pending" | "decided" | "all";

export class ClubJoinRequestsApi {
  async list(clubId: string, status: ClubJoinRequestStatusFilter): Promise<ClubJoinRequestDto[]> { ... }  // GET api/clubs/{clubId}/join-requests?status=
  async getPendingCount(clubId: string): Promise<number> { ... }   // GET api/clubs/{clubId}/join-requests/count
  async approve(requestId: string): Promise<void> { ... }          // POST api/club-join-requests/{requestId}/approve
  async reject(requestId: string): Promise<void> { ... }           // POST api/club-join-requests/{requestId}/reject
}
export const clubJoinRequestsApi = new ClubJoinRequestsApi();
```

`ClubJoinRequestDto` (new type in `Front/src/shared/types/scope.ts`, sibling to `ScopeMember`):
`{ requestId: string; alias: string; email: string; requestedAt: string; status: "Pending" |
"Approved" | "Rejected" | "Cancelled"; decidedAt: string | null; decidedByAlias: string | null }`
— covers both tabs with one shape (`decidedAt`/`decidedByAlias` are simply `null` for `Pending`
rows), matching the backend's own single-DTO-with-a-status-filter design instead of two separate
response types for two tabs.

## Page behavior

Structural mirror of `ScopeMembers.tsx`: `BaseLayout` > `ContentLayout title="Solicitudes de
entrenadores"`, `useState`/`useEffect` (no react-query, consistent with the rest of the codebase),
a `loadAll(status)` that fetches the active tab's list on mount and on tab change (and re-fetches
the `pending` list after every approve/reject so it can't drift from server state — the badge
count is refetched too, via the same `getPendingCount` call, so `ScopeMembers`' badge and this
page never disagree for more than one round trip), `Snackbar`+`MuiAlert` for success/error
feedback using the same `problemMessage(err, fallback)` unpacking helper (either imported if it
gets promoted to a shared util, or duplicated locally same as today — flag as a minor
implementation-time call: `problemMessage` currently lives inline in `ScopeMembers.tsx`; if a
second page needs it verbatim, this is the moment to promote it to
`shared/utils/problemMessage.ts` rather than forking it a second time).

- **Loading**: `CircularProgress` in a centered `Box` (same as `ScopeMembers`'
  `styles.loadingOverlay`), replacing the table/card list, not blocking the page shell or the tabs.
- **Empty state**: no requests in the active tab — a single centered `Typography` message ("No hay
  solicitudes pendientes." / "Todavía no se ha decidido ninguna solicitud." depending on tab)
  inside the `Paper`/card container, matching `ScopeMembers`' empty `TableRow` convention but as a
  standalone block (there's no table to put an empty row inside on the mobile card layout — see
  Responsive below).
- **Error state**: fetch failure shows the `Snackbar` with `problemMessage(err, "Error al cargar
  las solicitudes.")`, same as every other list-fetch failure in `ScopeMembers`; the page still
  renders its empty/loaded shell underneath (no full-page error blocker), consistent with the
  existing convention of never hard-failing a whole page on a list-load error.
- **Approve/Reject actions** (Pending tab only — the Decided tab is read-only, no row actions):
  two `IconButton`s per row (`CheckCircleOutline` for approve, `CancelOutlined`/`DeleteOutline`
  for reject, both from `@mui/icons-material`, matching `ScopeMembers`' `DeleteOutlineIcon`
  icon-button convention) open the shared `ConfirmDialog` with role-specific copy:
  - Approve: "¿Aceptar a **{alias}** ({email}) como entrenador del club? Se le concederá acceso y
    se activará la cuota correspondiente." (mirrors the backend's billing-hook-on-approve
    behavior from §5, so the director isn't surprised by a charge appearing later).
  - Reject: "¿Rechazar la solicitud de **{alias}** ({email})? El usuario deberá solicitar unirse
    de nuevo con un código válido."
  - Both dialogs disable their confirm button and show `CircularProgress` while the corresponding
    request is in flight (`ConfirmDialog`'s existing `processing` prop), then close and trigger a
    refetch of both the pending list and the badge count (removing the row from Pending, and — if
    the director then switches to the Decided tab — it will now appear there) plus a success
    `Snackbar` on completion, or an error `Snackbar` (dialog stays open so the director can retry)
    on failure — same optimistic-nothing, wait-for-server pattern as `ScopeMembers`' remove-member
    flow.
- Decided-tab rows additionally show a `Chip` (`color="success"` Approved / `color="error"`
  Rejected / `color="default"` Cancelled) plus `decidedAt` and, when present, "por {decidedByAlias}"
  — `Cancelled` rows have no `decidedByAlias` (self-withdrawn, per backend §5) and render "—"
  instead, not a blank cell.
- Rows use the same `formatDate(iso)` helper already in `ScopeMembers.tsx` for `requestedAt`/
  `decidedAt` (promote to a shared util if/when `problemMessage` is promoted, same call).

## Responsive / mobile

- **Desktop/tablet (`>= 600px`, same breakpoint `ScopeMembers` already uses for its `.options`
  row)**: MUI `Table`. Pending tab: `Alias | Email | Fecha de solicitud | Acciones`. Decided tab:
  `Alias | Email | Estado | Decidido el | Decidido por` (no Acciones column, read-only) — same
  structure as `ScopeMembers`' members table, inside `TableContainer component={Paper}`.
- **Mobile (`< 600px`)**: the table is replaced with a vertical stack of `Card`/`Paper` rows (one
  per request: alias + email on one line, requested-at/decided-at as a `Typography
  variant="caption"`, and — Pending tab only — the two action `IconButton`s right-aligned below)
  rather than letting the 4-5-column table force horizontal scroll — this is the same "don't force
  horizontal scroll on narrow screens" principle the Frontend Register section already applied to
  `TeamPlayerPicker` (§ Team Player Picker, earlier in this document) instead of a `Table`. Toggled
  via CSS Modules (`.tableView`/`.cardView` classes with a `display: none` media-query swap,
  matching how the rest of the codebase does responsive layout switching — no JS-based
  `useMediaQuery` breakpoint branching needed for a pure display swap).
- MUI `Tabs` itself is already responsive by default (two short Spanish labels never wrap on any
  real viewport here, so the default `standard` variant is fine, no `variant="scrollable"` needed).
- Long alias/email strings truncate with `text-overflow: ellipsis` in both layouts (same
  `TeamPlayerPicker` convention).
- Verify at implementation time at the same 360×740 Playwright viewport flagged elsewhere in this
  document for the Register page — this page should get the same explicit mobile-viewport check
  as a `tasks.md` verification step, not an assumption.

## Test Strategy (TDD)

- `ClubJoinRequests.test.tsx`: renders loading state, then the pending list on the default tab;
  empty state when the mocked API returns `[]`; approve flow opens `ConfirmDialog`, confirming
  calls `clubJoinRequestsApi.approve(requestId)` and refetches both the pending list and the count
  (row disappears, success `Snackbar` shown); reject flow mirrors it; a rejected/failed API call
  on confirm keeps the dialog open and shows an error `Snackbar` instead of removing the row;
  switching to the Decided tab calls `list(clubId, "decided")` and renders status `Chip`s without
  row actions; mobile viewport (via a `matchMedia` mock or CSS-module class assertion, consistent
  with however existing responsive tests in this repo are written — check `ScopeMembers.test.tsx`
  or sibling tests for the established mocking approach before inventing a new one) renders the
  card layout instead of the table.
- The badge itself: a `ScopeMembers.test.tsx` addition (not a new file) verifying the badge shows
  the mocked pending count and is hidden when the count is `0`, and that clicking the button
  navigates to `/club-join-requests?clubId=...`.
- `ClubJoinRequestsApi`-level tests mirror `ScopesApi`'s own test conventions if one exists
  (`USE_MOCK` branch coverage).

## Risks / Trade-offs

- [Decided tab added even though the task only asked for approve/reject] — justified because the
  backend already returns it via the same `status=` filter at no extra backend cost; adding the
  tab now avoids a near-immediate follow-up change, and it's purely additive/read-only so it can't
  destabilize the approve/reject flow if deprioritized at implementation time (cut the tab, keep
  the rest).
- [No history/audit filtering beyond the two tabs] — deliberately deferred; the backend itself
  stops short of a workflow/audit-trail feature (§5 "What's intentionally not built"), so this page
  matches that scope rather than over-building UI for data the backend doesn't structure for it.
- [Reusing `ConfirmDialog` instead of `ScopeMembers`' inline `Dialog` pattern] — the two
  conventions coexist in the codebase today; this addendum picks the shared component since two
  new near-identical dialogs (approve/reject) are exactly the reuse case `ConfirmDialog` exists
  for, unlike `ScopeMembers`' single bespoke rotate/remove dialogs which predate it.

## Open Questions

- Whether the backend's parallel expansion of this area changes `GET
  api/clubs/{clubId}/join-requests`'s response shape further (e.g. adds club name for a
  multi-club view) — this design's `ClubJoinRequestDto` only requires the fields listed above, so
  additive fields don't break it; verify the final shape against this addendum at implementation
  time.
- Whether the applicant-facing cancel/withdraw UI (consuming `POST
  .../club-join-requests/{requestId}/cancel`) should live inside `PendingClubApprovalNotice`
  (Frontend Register section, above) or a separate "my registration status" page — out of scope
  for this addendum, flagged for whoever picks up that surface next.
