## Context

RFFM currently has zero audit trail. Relevant real precedents in the codebase:

- **The three DbContexts** (`Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/`): `IdentityDbContext` (schema `identity`, ASP.NET Core Identity only), `AppDbContext` (schema `app`, virtually all app data — clubs, teams, players, convocations, permissions, news), `FederationDbContext` (schema `federation`, federation-wide settings like `FederationSetting`/`RffmSeasonPreference`, unrelated to per-club/per-team scoping). Audit records need club/team scoping and reference `Convocation`/`Player` rows that live in `app` — `AppDbContext` is the only correct home.
- **Convocation accept/reject** is `Features/Coaches/Convocations/UpdateConvocationStatus.cs` (`PUT /api/events/{eventId}/convocations/{convocationId}/status`). There is no distinct "Rejected" status — `ConvocationStatus` (`Domain/Aggregates/Assistances/ConvocationStatus.cs`) has `Pending`(1)/`Accepted`(2)/`Justified`(4)/`Deconvoke`(5). "Rejecting a call-up" is a Player/FamilyMember transitioning `NewStatusId` to `Deconvoke`(5), optionally with `ExcuseTypeId` (`Domain/Aggregates/Assistances/ExcusesType.cs`: Lesión, Estudios, Enfermedad, Problema familiar, Evento familiar, Cumpleaños, Decisión técnica, Sanción deportiva, Cita médica) — the handler already defaults `ExcuseTypeId ?? 7` ("Decisión técnica") when deconvoking, so a resolved reason always exists for this transition today.
- **Player edit** is `Features/Coaches/Players/Commands/UpdatePlayer.cs` (`PUT api/catalog/player`) — a plain `IRequest` (not `ICommand<T>`) handled by `UpdateDeletePlayerHandler`, with a co-located `FluentValidation` validator, no `[Authorize]` route restriction beyond the global default. It calls `_catalogDbContext.SaveChangesAsync` directly inside the handler — this repo does **not** have an auto-save pipeline behavior (unlike the CVL.SmartLocks rules in `.claude/rules/dotnet.md`, which describe a different codebase); every RFFM handler calls `SaveChangesAsync` itself, and this change follows that same real convention.
- **Scope/role model already exists**: `AppRoles` (`Domain/Entities/AppRoles.cs`) — `Administrator`, `Federation`, `Coach`, `ClubDirector`, `Player`, `FamilyMember`, `Fan`, `ClubMember`. `UserClub` (`Domain/Aggregates/UserClubs/UserClub.cs`, `ApplicationUserId`+`ClubId`+`RoleId`) and `UserTeam` (`Domain/Aggregates/UserClubs/UserTeam.cs`, `ApplicationUserId`+`TeamId`+`RoleId`+`LinkedTeamPlayerId`) are the existing club/team membership tables — exactly what's needed to resolve "which club is this ClubDirector's" / "which team is this Coach's" for scope filtering. No new membership concept is needed.
- **`ICurrentUserService`** (`Domain/Services/ICurrentUserService.cs`, impl `Infrastructure/Services/CurrentUserService.cs`) exposes `UserId`, `Role`, `Roles`, `IsAuthenticated` from JWT claims — the source of truth for "who is making this request" in every handler.
- **Real pipeline behavior order** (`DependencyInjection/ServiceCollectionExtensions.cs:181-187`): `LoggingBehavior` → `ValidationBehavior` → `TimeLoggingBehavior` → `FeaturePermissionBehavior` → `TeamMembershipBehavior` → `CachingBehavior` → `InvalidateCachingBehavior`. (Note: this differs from the generic order quoted in the back-specialist brief — the order above is what's actually registered in code and is authoritative.)
- **`PagePermission.PageIdentifier`** (`Domain/Entities/PagePermission.cs`) already models "identify a page", e.g. `"Roster"`. Reusing this exact string concept for the page-access audit event means front-specialist instruments with identifiers that already exist in the permission system, instead of inventing a second taxonomy.
- **Pagination precedent**: `Features/Coaches/News/GetNews.cs` — `pageNumber`/`pageSize`/`descending` query params, `Skip`/`Take`, total count returned via `X-Total-Count` response header (not in the JSON body).
- **`ProblemDetails` mapping** (`ServiceCollectionExtensions.AddCustomProblemDetails`): `DomainException` → 400 + `code`; `UnauthorizedAccessException` → 401 (no code); `ForbiddenAccessException` → 403 (no code); `NotFoundException` → 404 + `code`; `ConflictException` → 409 + `code`. `Domain/ErrorCodes.cs` is the single real catalog of `code` values — new codes go there, not as inline literals.
- No IP-capture code exists anywhere in the repo today (`grep` for `RemoteIpAddress`/`X-Forwarded-For` returns nothing) — this is new ground, not a pattern to mirror.

## Goals / Non-Goals

**Goals:**
- Record three event types — page access, call-up accept/reject (reason captured, never null on reject), player-edit — for every role, with user/role/club/team/timestamp/IP/action/result/reason.
- Instrument the *real*, already-shipped handlers (`UpdateConvocationStatus.cs`, `UpdatePlayer.cs`) as a side effect, with zero change to their existing request/response contracts or business rules.
- A single reusable emission mechanism any future handler can call with one line, without vertical slices depending on each other's files.
- A scope-safe, paginated, filterable query endpoint the future audit screen (front-specialist, separate change) can build against.
- IP capture that works behind whatever reverse proxy/load balancer the deployment uses, falling back gracefully when unavailable (e.g. local dev, unit tests).

**Non-Goals:**
- No frontend work. Calling the page-access endpoint from Coach/Federation apps, and building the audit screen UI, are separate coordinated changes.
- No retroactive backfill of historical actions — logging starts from the moment this change ships.
- No automated retention/deletion job — indefinite retention is an explicit decision (Decision 7), revisited only if the user asks later.
- No audit of *every* write in the system (e.g. training-session edits, ratings) — scope is exactly the three event types requested; extending coverage is a future, separate change per event type.
- No real-time notification/alerting on audit events (e.g. "notify federation on every rejection") — this change only records and exposes for query.

## Decisions

### 1. New entity `UserActivityLog`, table in `AppDbContext` (schema `app`)

Lives at `Domain/Entities/Audit/UserActivityLog.cs`, `IAggregateRoot`, extends `BaseEntity` (so it gets the standard `Id = Guid.NewGuid().ToString()`). Fields:

```csharp
public class UserActivityLog : BaseEntity, IAggregateRoot
{
    public string UserId { get; private set; } = null!;      // ICurrentUserService.UserId
    public string RoleName { get; private set; } = null!;    // resolved role at time of action (see Decision 5)
    public string? ClubId { get; private set; }               // nullable: Federation-role actions have no single club
    public string? TeamId { get; private set; }               // nullable: same reasoning, or club-level actions
    public DateTime Timestamp { get; private set; }           // UTC, set server-side (DateTime.UtcNow)
    public string? IpAddress { get; private set; }             // nullable: unavailable outside HTTP context
    public string EventType { get; private set; } = null!;    // AuditEventType SmartEnum name (Decision 2)
    public string ActionOrPage { get; private set; } = null!; // PageIdentifier, or a fixed action key (e.g. "ConvocationStatusChanged", "PlayerEdited")
    public string Result { get; private set; } = null!;       // "Success" | "Failure" (Decision 3)
    public string? Reason { get; private set; }                // nullable; required (enforced by caller) for call-up rejections
    public string? SubjectId { get; private set; }             // nullable: the entity acted on (e.g. ConvocationId, PlayerId) for future drill-down

    private UserActivityLog() { }

    public static UserActivityLog Create(
        string userId, string roleName, string? clubId, string? teamId, string? ipAddress,
        AuditEventType eventType, string actionOrPage, string result, string? reason, string? subjectId)
    { /* invariant: Reason required when eventType == ConvocationRejected — see Decision 3 */ }
}
```

Why a rich entity with a private constructor + factory, not a plain record: this repo's domain layer (`UserClub`, `UserTeam`, `Convocation`) consistently uses this shape, and it lets `Create()` enforce "reason required on rejection" as a domain invariant instead of trusting every call site.

**Table/config**: `Infrastructure/Persistence/Configuration/Entities/UserActivityLogEntityConfiguration.cs`, `builder.ToTable("UserActivityLogs")`, indexes:
```csharp
builder.HasIndex(a => new { a.ClubId, a.Timestamp });
builder.HasIndex(a => new { a.TeamId, a.Timestamp });
builder.HasIndex(a => a.UserId);
```
These three cover the three scope-filtered query shapes from Decision 6 (Federation: no club/team filter, ordered by `Timestamp`; ClubDirector: `ClubId` + `Timestamp` range; Coach: `TeamId` + `Timestamp` range) without a full table scan. No FK constraints to `Club`/`Team`/`AspNetUsers` — deliberately soft references (Decision 8).

Add `DbSet<UserActivityLog> UserActivityLogs` to `AppDbContext`.

**Alternative considered**: a separate `AuditDbContext`/schema (rejected — this data is club/team-scoped exactly like the rest of `app`, adding a 4th DbContext for one table is unjustified complexity; `FederationDbContext` is reserved for federation-wide *settings*, not per-club logs).

### 2. `AuditEventType` — `Ardalis.SmartEnum`-style catalog, not a raw string

Following the `AppRoles`/`ConvocationStatus` pattern (not `SmartEnum.EFCore`-backed since we don't need EF to query by it relationally — `EventType` is stored as its `Name` string column, filtered by exact string match, same posture as `ConvocationStatus.Name` usage elsewhere):

```csharp
// Domain/Entities/Audit/AuditEventType.cs
public sealed class AuditEventType
{
    public static readonly AuditEventType PageAccess = new(1, "PageAccess");
    public static readonly AuditEventType ConvocationAccepted = new(2, "ConvocationAccepted");
    public static readonly AuditEventType ConvocationRejected = new(3, "ConvocationRejected");
    public static readonly AuditEventType PlayerEdited = new(4, "PlayerEdited");
    // FromName/FromId/List() mirroring AppRoles.cs
}
```
Exactly 4 values for this change's scope — new event types (future changes) are added here, not via a DB-editable catalog (unlike `DocumentType`, which needed runtime extensibility per its own requirements; audit event types are a fixed, code-reviewed taxonomy by design, so a code change to add one is correct, not a shortcut).

### 3. Emission mechanism: injectable `IAuditLogger`, **not** a pipeline behavior

Two options were evaluated:

**A. A new pipeline behavior** (e.g. `AuditBehavior<TRequest,TResponse>`, marker interface `IAuditableRequest`) — modeled on `FeaturePermissionBehavior`/`TeamMembershipBehavior`. Rejected as the primary mechanism because:
- The three audited events don't map 1:1 onto "one command = one audit row". `UpdateConvocationStatus` needs *different* `EventType`/`Reason` depending on whether `request.NewStatusId` resolves to `Accepted` or `Deconvoke` — that branching is deep inside the handler's own logic (after loading `conv`, after the Player/FamilyMember ownership checks), not visible to a behavior wrapping the whole request/response. A behavior can log "this command ran", not "the convocation was specifically rejected with reason X" without re-deriving the same branching the handler already computed — duplicating logic across two files.
- Page-access has no natural "command with side effects" shape at all — it's a fire-and-forget "I visited this page" ping; forcing it through a generic behavior brings no benefit over a direct call to a service, and other request types would need a marker interface added defensively "just in case" even where nothing is audited, which is worse coupling than an explicit call.
- Pipeline behaviors in this codebase (Logging/Validation/TimeLogging/FeaturePermission/TeamMembership/Caching/InvalidateCaching) are all *generic, request-shape-agnostic* concerns — "did this run, how long did it take, is it cached, is it authorized". Audit content (club, team, reason, subject) is business-specific per feature, which is a handler-level concern in this codebase's own conventions, not a pipeline-level one.

**B. Injectable `IAuditLogger` (infrastructure service), called explicitly from inside the handler** — **chosen**. Mirrors how `UpdateConvocationStatus.cs` already injects `ISanctionConvocationEnforcementService` for a similar "cross-cutting effect triggered from deep inside domain branching" need. Contract:

```csharp
// Infrastructure/Services/IAuditLogger.cs
public interface IAuditLogger
{
    Task LogAsync(
        AuditEventType eventType, string actionOrPage, string result,
        string? reason = null, string? subjectId = null, string? clubId = null, string? teamId = null,
        CancellationToken cancellationToken = default);
}
```
Implementation (`AuditLogger`) resolves `UserId`/`RoleName` from `ICurrentUserService`, `IpAddress` from `IHttpContextAccessor` (Decision 4), stamps `Timestamp = DateTime.UtcNow`, builds `UserActivityLog.Create(...)`, adds it to `AppDbContext.UserActivityLogs`, and — critically — **does not call `SaveChangesAsync` itself**. It `Add()`s to the same `AppDbContext` instance the calling handler already holds (both are request-scoped/DI-scoped), so the handler's own trailing `SaveChangesAsync()` call persists the audit row in the *same transaction* as the business change it's auditing. This guarantees the audit row and the change it describes are atomic — either both commit or neither does — which a fire-and-forget logger or a separate `SaveChanges` call could not guarantee. Registered as `services.AddScoped<IAuditLogger, AuditLogger>()`.

**Alternative considered**: domain event (`AddDomainEvent` + a `MediatR`-style notification handler) — rejected: `BaseEntity.DomainEvents` in this codebase are dispatched by `INotification`/`Mediator.Publish`, and nothing in the current codebase actually consumes them yet (no `INotificationHandler` registrations found) — introducing that machinery for the first time, just for audit, is more moving parts than a direct injected service call, for no atomicity benefit over Option B (same-transaction guarantee already achieved by sharing `AppDbContext`).

### 4. IP capture

`AuditLogger` takes `IHttpContextAccessor` (already registered and used by `CurrentUserService`/`GetNews.cs`). Resolution order, since no proxy-header convention exists yet in this repo:
```csharp
private static string? ResolveClientIp(HttpContext? ctx)
{
    if (ctx is null) return null;
    var forwardedFor = ctx.Request.Headers["X-Forwarded-For"].FirstOrDefault();
    if (!string.IsNullOrWhiteSpace(forwardedFor))
        return forwardedFor.Split(',')[0].Trim(); // first hop = original client
    return ctx.Connection.RemoteIpAddress?.ToString();
}
```
`X-Forwarded-For` is checked first (covers the common case of a reverse proxy/load balancer in front of the API in production) with a direct fallback to `HttpContext.Connection.RemoteIpAddress` (correct for local dev / direct connections). `IpAddress` is nullable on the entity precisely because neither source is guaranteed (unit tests calling handlers directly with no `HttpContext`, or a call with no context available) — mirrors the existing `try/catch` posture in `GetNews.cs` around `_httpContextAccessor.HttpContext!.Response.Headers[...]`.

**Not implemented in this change**: validating/trusting `X-Forwarded-For` against a known proxy allowlist (`ForwardedHeadersMiddleware`) — flagged as a Risk below; out of scope because no such infrastructure exists yet in this repo to hook into.

### 5. Role captured per event: the role active for *this action*, not "all roles the user has"

`ICurrentUserService.Roles` can return multiple roles for a multi-role user. `AuditLogger.LogAsync` does not try to guess "the" role from the full claim set — callers pass the role context explicitly where it's unambiguous from the request itself, or `AuditLogger` falls back to `ICurrentUserService.Role` (first role claim) when the caller has nothing more specific. Concretely:
- `UpdateConvocationStatus.cs` already branches on `isPlayerOrFamilyRole` — it passes `roleName: isPlayerOrFamilyRole ? (matches Player or FamilyMember, whichever is in Roles) : "Coach"` when a Coach/Administrator forces a status change. This keeps the audit row's `RoleName` matching the actual authorization path taken, not just an arbitrary first claim.
- `UpdatePlayer.cs` and the page-access endpoint have no such branching — they pass no explicit role, so `AuditLogger` uses `ICurrentUserService.Role` (first role claim), acceptable because these actions aren't gated by a role-specific code path the way convocation status is.

### 6. Query endpoint scope enforcement — at the EF query, not in memory

`GET /api/audit-log` (`Features/Audit/SearchAuditLog.cs`), `[Authorize(Roles = "Federation,Administrator,ClubDirector,Coach")]` (Player/FamilyMember excluded at the route's `[Authorize]` attribute — never even reach the handler, giving a clean `403` via the standard ASP.NET Core auth pipeline, no custom check needed).

Handler resolves scope **before** building the `IQueryable`, then applies it as a `Where` clause (never materializes then filters):

```csharp
IQueryable<UserActivityLog> query = _db.UserActivityLogs.AsNoTracking();

var roles = (_currentUser.Roles ?? []).ToArray();
var isFederationOrAdmin = roles.Any(r => r.Equals(AppRoles.Federation.Name, ...) || r.Equals(AppRoles.Administrator.Name, ...));

if (!isFederationOrAdmin)
{
    if (roles.Any(r => r.Equals(AppRoles.ClubDirector.Name, ...)))
    {
        var clubIds = await _db.Set<UserClub>().AsNoTracking()
            .Where(uc => uc.ApplicationUserId == userId).Select(uc => uc.ClubId).ToArrayAsync(ct);
        query = query.Where(a => a.ClubId != null && clubIds.Contains(a.ClubId));
    }
    else // Coach
    {
        var teamIds = await _db.Set<UserTeam>().AsNoTracking()
            .Where(ut => ut.ApplicationUserId == userId).Select(ut => ut.TeamId).ToArrayAsync(ct);
        query = query.Where(a => a.TeamId != null && teamIds.Contains(a.TeamId));
    }
}
```
A `ClubDirector`/`Coach` belonging to multiple clubs/teams sees the union of all of theirs (`UserClub`/`UserTeam` rows are 1-to-many per user already, same pattern `TeamMembershipBehavior` uses for `AnyAsync`). Request/filter params (`clubId`, `teamId`, `userId`, `eventType`, `from`, `to`, `pageNumber`, `pageSize`) are applied as **additional** `Where` clauses layered on top of the scope filter (so a ClubDirector can narrow to one of *their* teams, but can never widen past their own clubs — an out-of-scope `clubId`/`teamId` param simply yields zero extra rows, not an error, matching how `GetNews.cs`-style list endpoints already ignore impossible filters rather than special-casing them).

Response follows the `GetNews.cs` pagination precedent: `X-Total-Count` header + `UserActivityLogResponse[]` body (no `seasonId`-style redundant param — audit rows aren't season-scoped).

### 7. Retention: indefinite, no automated deletion

Explicit decision, not an oversight: no scheduled job, no TTL, no manual delete endpoint in this change. If storage growth or compliance requirements later demand retention limits, that is a distinct, separate change (needs its own decision on retention period, legal-hold considerations, and whether Federation must be able to export before deletion) — out of scope here.

### 8. No FK constraints from `UserActivityLog` to `Club`/`Team`/`AspNetUsers`

`ClubId`/`TeamId`/`UserId` are stored as plain strings, not EF navigation properties with `HasOne().WithMany()`. Rationale: an audit log must remain readable even if the club/team/user it references is later deleted (a `Club` or `Team` deletion cascading into "your audit history now has holes" would defeat the purpose of an audit trail). This is a deliberate divergence from `PlayerDocumentEntityConfiguration`'s FK-with-cascade pattern (appropriate there because a deleted `TeamPlayer` really should take its documents with it) — audit rows are historical facts that must survive deletion of the things they describe.

### 9. Vertical slice file layout

New folder `Features/Audit/`:
- `RecordPageAccess.cs` — `ICommand`, `POST /api/audit-log/page-access`, any authenticated role, body `{ pageIdentifier: string, clubId?: string, teamId?: string }`. Validator: `PageIdentifier` required, max length 100 (mirrors `PagePermission.PageIdentifier` conventions). Calls `IAuditLogger.LogAsync(AuditEventType.PageAccess, request.PageIdentifier, "Success", clubId: request.ClubId, teamId: request.TeamId)`, then `SaveChangesAsync`.
- `SearchAuditLog.cs` — `IQueryApp<UserActivityLogSearchResult>` (not cached — `ICacheRequest` would go stale immediately and scope-filtering makes cache-key design not worth the complexity for a low-traffic admin screen), `GET /api/audit-log`, per Decision 6.

New domain folder `Domain/Entities/Audit/`: `UserActivityLog.cs`, `AuditEventType.cs`.

New `Infrastructure/Services/IAuditLogger.cs` + `AuditLogger.cs`, registered in `ServiceCollectionExtensions` alongside the existing `ICurrentUserService`/`ISanctionConvocationEnforcementService` registrations.

New `Infrastructure/Persistence/Configuration/Entities/UserActivityLogEntityConfiguration.cs`.

New `Domain/ErrorCodes.cs` constant: `AuditPageIdentifierRequired` (validator error code, `ValidationBehavior`'s existing `ValidationFailed` code already covers generic FluentValidation failures — this repo's validators typically don't set a custom `.WithErrorCode(...)` per rule today (see `UpdatePlayerValidator`), so **no new error code is actually required**; task list keeps this as a "confirm, don't assume" step).

### 10. Instrumentation of `UpdateConvocationStatus.cs`

Inject `IAuditLogger` into the existing `Handler`. After the status transition logic resolves (end of the `if (isNowDeconvoke) {...} else {...}` block, before `SaveChangesAsync`), call:
```csharp
var eventType = isNowDeconvoke ? AuditEventType.ConvocationRejected : AuditEventType.ConvocationAccepted;
var reason = isNowDeconvoke
    ? ExcuseTypes.FromId(request.ExcuseTypeId ?? TechnicalDecisionExcuseTypeId).Name  // never null — existing fallback guarantees a resolved reason
    : null;
var roleName = isPlayerOrFamilyRole
    ? roles.First(r => r.Equals("Player", ...) || r.Equals("FamilyMember", ...))
    : (currentUser.Role ?? "Coach");
await _auditLogger.LogAsync(eventType, "ConvocationStatusChanged", "Success", reason: reason,
    subjectId: conv.Id, teamId: conv.SportEvent.TeamId, cancellationToken: cancellationToken);
```
(`SportEvent.TeamId` — confirm exact property name against `Domain/Aggregates/Assistances/SportEvent.cs`/its parent aggregate during implementation; `Convocation` is already `.Include(c => c.SportEvent)`-loaded by this handler so no extra query is needed.) `ClubId` is intentionally omitted here (left `null`) unless `SportEvent`/`Team` cheaply exposes it without an extra join — the query-scope filter (Decision 6) still works for Coach via `TeamId` alone; a ClubDirector viewing convocation events would rely on the `TeamId`→club resolution done once at query time (via `UserClub`/`Team.ClubId`), not a redundant `ClubId` stamped on every row. **This needs one more real check during implementation**: does `Team` (`Domain/Entities/Teams/Team.cs`) expose `ClubId` directly? If yes, resolve and stamp it here too, since it's a cheap in-memory lookup once `SportEvent`/`Team` is loaded and simplifies the ClubDirector scope query (avoids a `Team`→`Club` join at read time). Flagged as a task-time decision, not deferred indefinitely.

Handler-thrown exceptions (`ArgumentException`, `UnauthorizedAccessException`, `ForbiddenAccessException`) still short-circuit *before* reaching the audit call, exactly as today — a rejected/failed authorization attempt is not currently logged as a `Result: Failure` audit row in this change (see Risks) because those exceptions leave the method before any status-transition branch is resolved, so there is nothing meaningful yet to attribute the event to beyond "someone tried and was denied" — out of scope for v1, callable out explicitly rather than silently dropped.

### 11. Instrumentation of `UpdatePlayer.cs`

Inject `IAuditLogger` into `UpdateDeletePlayerHandler`. After the `player.Update*` calls, before `SaveChangesAsync`:
```csharp
await _auditLogger.LogAsync(AuditEventType.PlayerEdited, "PlayerEdited", "Success",
    subjectId: player.Id, clubId: player.ClubId, cancellationToken: cancellationToken);
```
`Player.ClubId` already exists on the command/entity (`UpdatePlayerCommand.ClubId`) — no extra query needed. `TeamId` is left `null` — `Player` is a club-level catalog entity, not team-scoped (`TeamPlayer` is the team-scoped roster row; editing the base `Player` catalog record is what this endpoint does, per its route `api/catalog/player`), so there is no single team to attribute here; a Coach's `TeamId`-scoped query will not see these rows unless/until a future change also audits `TeamPlayer`-level edits specifically — flagged as an intentional scope boundary matching what `UpdatePlayer.cs` itself actually edits.

## API Contract (for the front-specialist)

All routes require authentication (`RequireAuthorization()`); role restrictions noted per route. All errors are `ProblemDetails`.

**`POST /api/audit-log/page-access`** — any authenticated role.
Request: `RecordPageAccessRequest { pageIdentifier: string, clubId?: string, teamId?: string }`
- `pageIdentifier` is the same string space as `PagePermission.PageIdentifier` (e.g. `"Roster"`, `"SeasonPrep"`) — front-specialist should instrument entry to a *section*, not every internal route change within it (per the "acceso a página" requirement: coarse-grained, not a router-change listener).
- `400` on missing/too-long `pageIdentifier` (standard `ValidationBehavior` shape, `code: "ValidationFailed"`).
Response: `200 OK`, empty body.

---

**`GET /api/audit-log`** — `Federation`, `Administrator`, `ClubDirector`, `Coach` only (`403` for `Player`/`FamilyMember`/`Fan`/`ClubMember` via route-level `[Authorize(Roles=...)]`).
Query params: `pageNumber` (default 1), `pageSize` (default 25, max TBD in tasks), `clubId?`, `teamId?`, `userId?`, `eventType?` (one of `AuditEventType.List()` names), `from?`/`to?` (ISO 8601 UTC, filters on `Timestamp`).
Scope (Decision 6): Federation/Administrator = unfiltered; ClubDirector = own clubs only; Coach = own teams only. Extra filter params narrow *within* scope, never widen past it.
Response `200`: `UserActivityLogResponse[]` + `X-Total-Count` header.
```
UserActivityLogResponse {
  id: string, userId: string, roleName: string,
  clubId: string | null, teamId: string | null,
  timestamp: string,   // ISO 8601 UTC
  ipAddress: string | null,
  eventType: string,   // "PageAccess" | "ConvocationAccepted" | "ConvocationRejected" | "PlayerEdited"
  actionOrPage: string,
  result: string,       // "Success" | "Failure"
  reason: string | null,
  subjectId: string | null
}
```

## Risks / Trade-offs

- **[Risk]** Denied/failed convocation-status attempts (thrown `ForbiddenAccessException`/`UnauthorizedAccessException`) are not logged as `Result: "Failure"` audit rows in this change (Decision 10) — a federation investigating "did someone try to tamper with another player's convocation" won't see failed attempts, only successful ones. → **Mitigation**: explicitly scoped out for v1 rather than silently dropped; flagged as a natural v2 extension (would need `IAuditLogger` calls before the early-return `throw`s, with less context available at that point).
- **[Risk]** `IpAddress` via `X-Forwarded-For` is trusted without validating the request actually came through a known proxy — a direct caller could spoof this header. → **Mitigation**: acceptable for v1 audit/accountability use (not a security control), explicitly flagged as a gap; hardening (via `ForwardedHeadersMiddleware` + `KnownProxies`) is a separate, infrastructure-level change affecting more than just audit.
- **[Risk]** `UpdatePlayer.cs` audits at the `Player` (club-catalog) level, not `TeamPlayer` (team-roster) level — a Coach querying "audit events for my team" will never see player-edit rows, only Federation/ClubDirector will (via `ClubId`). → **Mitigation**: matches what the endpoint actually edits (Decision 11); if per-team player-edit auditing is wanted later, `UpdateTeamPlayer.cs` (a different, existing handler) would need its own instrumentation in a follow-up change.
- **[Risk]** No FK constraints (Decision 8) means orphaned `ClubId`/`TeamId`/`UserId` values are possible and the query-scope join (Decision 6) silently excludes rows whose `ClubId`/`TeamId` no longer matches any live `UserClub`/`UserTeam` — acceptable since the alternative (cascading deletes into audit history) is worse for an audit trail's purpose.
- **[Risk]** Unbounded growth with no retention (Decision 7) — page-access events in particular could be high-volume. → **Mitigation**: explicitly the user's confirmed decision for v1; the composite indexes (Decision 1) keep scoped/paginated reads fast even as the table grows; revisit if/when volume becomes a real operational concern.

## Migration Plan

1. Add `UserActivityLog`, `AuditEventType` domain types + `UserActivityLogEntityConfiguration`.
2. Add `DbSet<UserActivityLog> UserActivityLogs` to `AppDbContext`.
3. `dotnet ef migrations add AddUserActivityAuditLog --startup-project ../RFFM.Host` (per `manage-migrations.ps1` convention) — new table only, no data migration.
4. Add `IAuditLogger`/`AuditLogger`, register in DI.
5. Add `Features/Audit/RecordPageAccess.cs` and `Features/Audit/SearchAuditLog.cs`.
6. Instrument `UpdateConvocationStatus.cs` and `UpdatePlayer.cs` (additive constructor parameter + one call each before their existing `SaveChangesAsync`).
7. Rollback: standard EF migration `Down()` drops `UserActivityLogs`; the two instrumented handlers roll back by reverting the code (no data-shape dependency the rest of the app relies on).

## Open Questions

1. **Does `Team` expose `ClubId` directly** for stamping `ClubId` on convocation-related audit rows (Decision 10)? Needs a real repo check during `tasks.md` execution — if yes, stamp it; if it requires an extra join, leave `ClubId` null on those rows and rely on the query-time `TeamId`→club resolution instead (still correct, just resolved at read time instead of write time).
2. **Max `pageSize` cap for `GET /api/audit-log`** — not specified by the user. Default proposed: 25 (matches `GetNews.cs`'s implicit convention), max 100 — needs explicit user confirmation before `implement.md`, or the implementer proceeds with this default per repo convention and flags it in the PR/summary.

Both are small, non-blocking implementation-time decisions, not gaps in the overall design — `tasks.md` calls them out explicitly so they aren't silently guessed during coding.
