# implement.md — user-activity-audit-log (BACKEND ONLY)

You are the `openspec-implementer` subagent. Execute this script precisely and completely. This
change is **backend-only** — everything happens under `Back/ExtractionApi/`. Do **not** touch
`Front/` or `Mobile/`. Calling the page-access endpoint from the Coach/Federation apps, and
building the audit screen UI, are separate, coordinated frontend changes that consume the
contracts defined here — you do not implement them.

Follow **strict TDD (Red → Green → Refactor)**: for every unit of behavior, write a failing test
first, confirm it fails for the right reason, then write the minimal code to make it pass. Do not
write production code before a failing test exists for it. Coverage targets (repo convention,
`CLAUDE.md`): **≥85% on new domain logic** (`UserActivityLog.Create`), **≥80% on new/modified
handlers**. No skipped tests (`[Fact(Skip = "...")]`) — if you're tempted to skip one, stop and
report why instead.

Repo root: `C:\Proyects\MisProyectos\FutbolBase`
Backend root: `Back/ExtractionApi` (all paths below are relative to this unless stated otherwise).

Authoritative source documents — **read these in full before writing any code**:
- `openspec/changes/user-activity-audit-log/proposal.md` — why, scope, impact.
- `openspec/changes/user-activity-audit-log/design.md` — the complete technical design, all 11
  decisions, the API contract, risks, and the two Open Questions (resolve both during this
  implementation — see tasks 6.1 and 8.2 below).
- `openspec/changes/user-activity-audit-log/tasks.md` — the full task breakdown this script
  summarizes; if anything here seems to contradict `tasks.md`/`design.md`, **design.md wins** —
  stop and report the discrepancy rather than silently picking one.

## 0. Conventions you must follow (verified by inspection of the real codebase, not assumptions)

- **Vertical slice**: one feature = one `.cs` file under `Features/Audit/` holding endpoint
  registration (`IFeatureModule.AddRoutes`) + request record + command/query + handler + validator,
  all in one file. Do not split a handler from its endpoint.
- **CQRS interfaces**: `RFFM.Api.Common.ICommand` (no response) for `RecordPageAccess`,
  `RFFM.Api.Common.IQueryApp<T>` for `SearchAuditLog` (`T : class`, satisfied by a `record` result
  type).
- **FluentValidation**: `RecordPageAccess`'s command gets an `AbstractValidator<T>` in the same
  file, mirroring `Features/Coaches/Players/Commands/UpdatePlayer.cs`'s `UpdatePlayerValidator`
  (plain `RuleFor(...).NotEmpty().MaximumLength(...)`, no custom `.WithErrorCode(...)` — confirm
  this is still the real convention per task 4 below before assuming it).
- **Errors**: `ProblemDetails` via the existing exception-mapping middleware
  (`ServiceCollectionExtensions.AddCustomProblemDetails`) — do not construct `ProblemDetails` by
  hand in an endpoint. `400` comes from `ValidationBehavior` catching FluentValidation failures
  automatically; no new exception types are needed for this change.
- **DbContext**: everything lives in `AppDbContext` (schema `app`) —
  `Infrastructure/Persistence/AppDbContext.cs`. Entity configs are discovered via reflection
  (`IEntityTypeConfiguration<T>`) — do not register them manually.
- **No auto-save pipeline behavior in this repo**: unlike some other RFFM.* projects, handlers
  call `_db.SaveChangesAsync(cancellationToken)` themselves at the end of `Handle`. `IAuditLogger`
  must NOT call `SaveChangesAsync` — it only `Add()`s to the shared `AppDbContext`, so the audit
  row commits atomically with whatever the calling handler is already persisting.
- **Real pipeline behavior order** (`DependencyInjection/ServiceCollectionExtensions.cs:181-187`):
  `LoggingBehavior` → `ValidationBehavior` → `TimeLoggingBehavior` → `FeaturePermissionBehavior` →
  `TeamMembershipBehavior` → `CachingBehavior` → `InvalidateCachingBehavior`. Nothing in this
  change needs a new pipeline behavior (see `design.md` Decision 3) — do not add one.
- **Tests use plain xUnit `Assert`**, not FluentAssertions (verified in
  `UpdateConvocationStatusHandlerTests.cs`).
- **Handler tests that touch `AppDbContext` use the real Postgres testcontainer fixture** —
  `[Collection(PostgresCollection.Name)]` + constructor-injected `PostgresContainerFixture
  fixture` (`tests/RFFM.Api.Tests/Fixtures/`), **not** EF InMemory and **not** a mocked
  `AppDbContext`. Only `ICurrentUserService`/`IHttpContextAccessor`/`IAuditLogger` are mocked with
  Moq where appropriate. Follow `UpdateConvocationStatusHandlerTests.cs`'s `SeedConvocationAsync`
  pattern for seeding real rows (`Club.Create(...)`, `Season.Create(...)`, `new Team(...)`, etc.).
- **Domain entity tests** (`UserActivityLogTests.cs`) are plain xUnit, no fixture, no Moq —
  construct the entity directly via `Create(...)` and assert.

## 1. Domain model — Red then Green

### 1.1 `AuditEventType`

No test file needed alone (bare catalog, mirrors `AppRoles.cs`). Create
`src/RFFM.Api/Domain/Entities/Audit/AuditEventType.cs`:
```csharp
namespace RFFM.Api.Domain.Entities.Audit
{
    /// <summary>
    /// Fixed, code-reviewed catalog of audited event types (openspec change
    /// user-activity-audit-log, design.md Decision 2). New types are added here as a code
    /// change, deliberately — not a DB-editable catalog like DocumentType.
    /// </summary>
    public sealed class AuditEventType
    {
        public static readonly AuditEventType PageAccess = new(1, "PageAccess");
        public static readonly AuditEventType ConvocationAccepted = new(2, "ConvocationAccepted");
        public static readonly AuditEventType ConvocationRejected = new(3, "ConvocationRejected");
        public static readonly AuditEventType PlayerEdited = new(4, "PlayerEdited");

        public int Id { get; }
        public string Name { get; }

        private AuditEventType(int id, string name)
        {
            Id = id;
            Name = name;
        }

        public static IEnumerable<AuditEventType> List() =>
            new[] { PageAccess, ConvocationAccepted, ConvocationRejected, PlayerEdited };

        public static AuditEventType FromName(string name)
        {
            var type = List().SingleOrDefault(t => string.Equals(t.Name, name, StringComparison.OrdinalIgnoreCase));
            return type ?? throw new ArgumentException($@"Unknown AuditEventType name: {name}", nameof(name));
        }

        public static AuditEventType FromId(int id)
        {
            var type = List().SingleOrDefault(t => t.Id == id);
            return type ?? throw new ArgumentException($@"Unknown AuditEventType id: {id}", nameof(id));
        }

        public override string ToString() => Name;
        public static implicit operator string(AuditEventType t) => t.Name;
    }
}
```

### 1.2 `UserActivityLog` entity — Red

Create `tests/RFFM.Api.Tests/UnitTests/UserActivityLogTests.cs` (plain xUnit, no fixture):
```csharp
#nullable enable
using RFFM.Api.Domain.Entities.Audit;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class UserActivityLogTests
    {
        [Fact]
        public void Create_WithAllRequiredFields_Succeeds()
        {
            var log = UserActivityLog.Create(
                userId: "user-1", roleName: "Coach", clubId: "club-1", teamId: "team-1",
                ipAddress: "127.0.0.1", eventType: AuditEventType.PageAccess,
                actionOrPage: "Roster", result: "Success", reason: null, subjectId: null);

            Assert.Equal("user-1", log.UserId);
            Assert.Equal("Coach", log.RoleName);
            Assert.Equal("club-1", log.ClubId);
            Assert.Equal("team-1", log.TeamId);
            Assert.Equal("127.0.0.1", log.IpAddress);
            Assert.Equal(AuditEventType.PageAccess.Name, log.EventType);
            Assert.Equal("Roster", log.ActionOrPage);
            Assert.Equal("Success", log.Result);
            Assert.Null(log.Reason);
            Assert.Null(log.SubjectId);
            Assert.True((DateTime.UtcNow - log.Timestamp).TotalSeconds < 5);
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        public void Create_ForConvocationRejected_RequiresNonEmptyReason(string? reason)
        {
            Assert.Throws<ArgumentException>(() => UserActivityLog.Create(
                "user-1", "Player", null, "team-1", null,
                AuditEventType.ConvocationRejected, "ConvocationStatusChanged", "Success", reason, "conv-1"));
        }

        [Fact]
        public void Create_ForConvocationRejected_WithReason_Succeeds()
        {
            var log = UserActivityLog.Create(
                "user-1", "Player", null, "team-1", null,
                AuditEventType.ConvocationRejected, "ConvocationStatusChanged", "Success", "Lesión", "conv-1");

            Assert.Equal("Lesión", log.Reason);
        }

        [Theory]
        [InlineData("PageAccess")]
        [InlineData("ConvocationAccepted")]
        [InlineData("PlayerEdited")]
        public void Create_ForNonRejectionEventTypes_AllowsNullReason(string eventTypeName)
        {
            var eventType = AuditEventType.FromName(eventTypeName);

            var log = UserActivityLog.Create(
                "user-1", "Coach", "club-1", null, null, eventType, "Action", "Success", null, null);

            Assert.Null(log.Reason);
        }

        [Fact]
        public void Create_AllowsClubIdTeamIdIpAddressSubjectIdAllNull()
        {
            var log = UserActivityLog.Create(
                "user-1", "Federation", null, null, null,
                AuditEventType.PageAccess, "Dashboard", "Success", null, null);

            Assert.Null(log.ClubId);
            Assert.Null(log.TeamId);
            Assert.Null(log.IpAddress);
            Assert.Null(log.SubjectId);
        }
    }
}
```
Run `dotnet test --filter UserActivityLogTests` from `Back/ExtractionApi` — confirm it fails to
compile (type doesn't exist). Proceed to Green.

### 1.2 `UserActivityLog` entity — Green

Create `src/RFFM.Api/Domain/Entities/Audit/UserActivityLog.cs`:
```csharp
using RFFM.Api.Domain.Entities.Audit;

namespace RFFM.Api.Domain.Entities.Audit
{
    /// <summary>
    /// Immutable record of an audited user action (openspec change user-activity-audit-log).
    /// No FK navigation properties to Club/Team/AspNetUsers by design (design.md Decision 8) —
    /// an audit trail must remain readable even if the entity it references is later deleted.
    /// </summary>
    public class UserActivityLog : BaseEntity, IAggregateRoot
    {
        public string UserId { get; private set; } = null!;
        public string RoleName { get; private set; } = null!;
        public string? ClubId { get; private set; }
        public string? TeamId { get; private set; }
        public DateTime Timestamp { get; private set; }
        public string? IpAddress { get; private set; }
        public string EventType { get; private set; } = null!;
        public string ActionOrPage { get; private set; } = null!;
        public string Result { get; private set; } = null!;
        public string? Reason { get; private set; }
        public string? SubjectId { get; private set; }

        private UserActivityLog() { }

        public static UserActivityLog Create(
            string userId, string roleName, string? clubId, string? teamId, string? ipAddress,
            AuditEventType eventType, string actionOrPage, string result, string? reason, string? subjectId)
        {
            if (string.IsNullOrWhiteSpace(userId))
                throw new ArgumentException("userId es obligatorio.", nameof(userId));
            if (string.IsNullOrWhiteSpace(roleName))
                throw new ArgumentException("roleName es obligatorio.", nameof(roleName));
            if (string.IsNullOrWhiteSpace(actionOrPage))
                throw new ArgumentException("actionOrPage es obligatorio.", nameof(actionOrPage));
            if (string.IsNullOrWhiteSpace(result))
                throw new ArgumentException("result es obligatorio.", nameof(result));
            if (eventType == AuditEventType.ConvocationRejected && string.IsNullOrWhiteSpace(reason))
                throw new ArgumentException("reason es obligatorio al rechazar una convocatoria.", nameof(reason));

            return new UserActivityLog
            {
                UserId = userId,
                RoleName = roleName,
                ClubId = clubId,
                TeamId = teamId,
                Timestamp = DateTime.UtcNow,
                IpAddress = ipAddress,
                EventType = eventType.Name,
                ActionOrPage = actionOrPage,
                Result = result,
                Reason = reason,
                SubjectId = subjectId
            };
        }
    }
}
```
Note `AuditEventType`'s `==` here relies on reference equality of the static singletons (same
pattern `ConvocationStatus`/`AppRoles` rely on when compared by reference elsewhere in this repo —
confirm this holds; if any call site instead compares by `.Name`, use `eventType.Name ==
AuditEventType.ConvocationRejected.Name` instead for safety). Run the tests from 1.2 — confirm
Green.

## 2. Persistence

### 2.1 Entity configuration

Create `src/RFFM.Api/Infrastructure/Persistence/Configuration/Entities/UserActivityLogEntityConfiguration.cs`:
```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities.Audit;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Entities
{
    internal class UserActivityLogEntityConfiguration : IEntityTypeConfiguration<UserActivityLog>
    {
        public void Configure(EntityTypeBuilder<UserActivityLog> builder)
        {
            builder.ToTable("UserActivityLogs");
            builder.HasKey(a => a.Id);

            builder.Property(a => a.UserId).IsRequired();
            builder.Property(a => a.RoleName).HasMaxLength(50).IsRequired();
            builder.Property(a => a.ClubId).IsRequired(false);
            builder.Property(a => a.TeamId).IsRequired(false);
            builder.Property(a => a.Timestamp).IsRequired();
            builder.Property(a => a.IpAddress).HasMaxLength(45).IsRequired(false); // IPv6 max length
            builder.Property(a => a.EventType).HasMaxLength(50).IsRequired();
            builder.Property(a => a.ActionOrPage).HasMaxLength(150).IsRequired();
            builder.Property(a => a.Result).HasMaxLength(20).IsRequired();
            builder.Property(a => a.Reason).HasMaxLength(500).IsRequired(false);
            builder.Property(a => a.SubjectId).IsRequired(false);

            // No FK navigation properties by design (design.md Decision 8) — soft references only.
            builder.HasIndex(a => new { a.ClubId, a.Timestamp });
            builder.HasIndex(a => new { a.TeamId, a.Timestamp });
            builder.HasIndex(a => a.UserId);
        }
    }
}
```

### 2.2 `AppDbContext`

Add near the other feature-grouped `DbSet`s in `src/RFFM.Api/Infrastructure/Persistence/AppDbContext.cs`
(e.g. after the "RBAC — feature and page permissions" block):
```csharp
// Audit log (user-activity-audit-log)
public DbSet<UserActivityLog> UserActivityLogs { get; set; }
```
Add the `using RFFM.Api.Domain.Entities.Audit;` directive at the top of the file.

### 2.3 Migration

From `Back/ExtractionApi`, run `.\manage-migrations.ps1` (or, if that script prompts
interactively in this environment, run directly:
`dotnet ef migrations add AddUserActivityAuditLog --project src/RFFM.Api --startup-project src/RFFM.Host`).
Inspect the generated migration — confirm it only adds the `UserActivityLogs` table with the
columns/indexes above, no unrelated changes. Apply it against the local dev DB and confirm it
succeeds.

## 3. `IAuditLogger` infrastructure service — Red then Green

### 3.1 Red

Create `tests/RFFM.Api.Tests/UnitTests/AuditLoggerTests.cs`, `[Collection(PostgresCollection.Name)]`
+ `PostgresContainerFixture`, mocking only `ICurrentUserService`/`IHttpContextAccessor`:
```csharp
#nullable enable
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Moq;
using RFFM.Api.Domain.Entities.Audit;
using RFFM.Api.Domain.Services;
using RFFM.Api.Infrastructure.Services;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class AuditLoggerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public AuditLoggerTests(PostgresContainerFixture fixture) => _fixture = fixture;

        private static Mock<ICurrentUserService> CurrentUser(string userId, string role) 
        {
            var mock = new Mock<ICurrentUserService>();
            mock.Setup(c => c.UserId).Returns(userId);
            mock.Setup(c => c.Role).Returns(role);
            mock.Setup(c => c.Roles).Returns(new[] { role });
            mock.Setup(c => c.IsAuthenticated).Returns(true);
            return mock;
        }

        private static Mock<IHttpContextAccessor> HttpContextWithForwardedFor(string ip)
        {
            var ctx = new DefaultHttpContext();
            ctx.Request.Headers["X-Forwarded-For"] = ip;
            var mock = new Mock<IHttpContextAccessor>();
            mock.Setup(a => a.HttpContext).Returns(ctx);
            return mock;
        }

        private static Mock<IHttpContextAccessor> HttpContextWithRemoteIp(string ip)
        {
            var ctx = new DefaultHttpContext();
            ctx.Connection.RemoteIpAddress = System.Net.IPAddress.Parse(ip);
            var mock = new Mock<IHttpContextAccessor>();
            mock.Setup(a => a.HttpContext).Returns(ctx);
            return mock;
        }

        private static Mock<IHttpContextAccessor> NoHttpContext()
        {
            var mock = new Mock<IHttpContextAccessor>();
            mock.Setup(a => a.HttpContext).Returns((HttpContext?)null);
            return mock;
        }

        [Fact]
        public async Task LogAsync_AddsRowToContext_WithoutCallingSaveChanges()
        {
            await using var db = _fixture.CreateDbContext();
            var logger = new AuditLogger(db, CurrentUser("user-1", "Coach").Object, NoHttpContext().Object);

            await logger.LogAsync(AuditEventType.PageAccess, "Roster", "Success");

            Assert.Equal(EntityState.Added, db.Entry(db.ChangeTracker.Entries<UserActivityLog>().Single().Entity).State);
            Assert.Equal(0, await db.UserActivityLogs.CountAsync()); // not yet saved
        }

        [Fact]
        public async Task LogAsync_UsesXForwardedFor_WhenPresent()
        {
            await using var db = _fixture.CreateDbContext();
            var logger = new AuditLogger(db, CurrentUser("user-1", "Coach").Object, HttpContextWithForwardedFor("203.0.113.5").Object);

            await logger.LogAsync(AuditEventType.PageAccess, "Roster", "Success");

            var entry = db.ChangeTracker.Entries<UserActivityLog>().Single().Entity;
            Assert.Equal("203.0.113.5", entry.IpAddress);
        }

        [Fact]
        public async Task LogAsync_FallsBackToRemoteIpAddress_WhenNoForwardedForHeader()
        {
            await using var db = _fixture.CreateDbContext();
            var logger = new AuditLogger(db, CurrentUser("user-1", "Coach").Object, HttpContextWithRemoteIp("127.0.0.1").Object);

            await logger.LogAsync(AuditEventType.PageAccess, "Roster", "Success");

            var entry = db.ChangeTracker.Entries<UserActivityLog>().Single().Entity;
            Assert.Equal("127.0.0.1", entry.IpAddress);
        }

        [Fact]
        public async Task LogAsync_NoHttpContext_LeavesIpAddressNull_NoException()
        {
            await using var db = _fixture.CreateDbContext();
            var logger = new AuditLogger(db, CurrentUser("user-1", "Coach").Object, NoHttpContext().Object);

            await logger.LogAsync(AuditEventType.PageAccess, "Roster", "Success");

            var entry = db.ChangeTracker.Entries<UserActivityLog>().Single().Entity;
            Assert.Null(entry.IpAddress);
        }
    }
}
```
Run `dotnet test --filter AuditLoggerTests` — confirm it fails (type doesn't exist).

### 3.2 Green

Create `src/RFFM.Api/Infrastructure/Services/IAuditLogger.cs`:
```csharp
using RFFM.Api.Domain.Entities.Audit;

namespace RFFM.Api.Infrastructure.Services
{
    /// <summary>
    /// Emits an audit event onto the shared AppDbContext without saving — the calling handler's
    /// own SaveChangesAsync persists the audit row atomically with the change it describes
    /// (openspec change user-activity-audit-log, design.md Decision 3).
    /// </summary>
    public interface IAuditLogger
    {
        Task LogAsync(
            AuditEventType eventType, string actionOrPage, string result,
            string? reason = null, string? subjectId = null, string? clubId = null, string? teamId = null,
            string? roleNameOverride = null, CancellationToken cancellationToken = default);
    }
}
```

Create `src/RFFM.Api/Infrastructure/Services/AuditLogger.cs`:
```csharp
using Microsoft.AspNetCore.Http;
using RFFM.Api.Domain.Entities.Audit;
using RFFM.Api.Domain.Services;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Infrastructure.Services
{
    public class AuditLogger : IAuditLogger
    {
        private readonly AppDbContext _db;
        private readonly ICurrentUserService _currentUser;
        private readonly IHttpContextAccessor _httpContextAccessor;

        public AuditLogger(AppDbContext db, ICurrentUserService currentUser, IHttpContextAccessor httpContextAccessor)
        {
            _db = db;
            _currentUser = currentUser;
            _httpContextAccessor = httpContextAccessor;
        }

        public Task LogAsync(
            AuditEventType eventType, string actionOrPage, string result,
            string? reason = null, string? subjectId = null, string? clubId = null, string? teamId = null,
            string? roleNameOverride = null, CancellationToken cancellationToken = default)
        {
            var userId = _currentUser.UserId ?? "unknown";
            var roleName = roleNameOverride ?? _currentUser.Role ?? "unknown";
            var ipAddress = ResolveClientIp(_httpContextAccessor.HttpContext);

            var log = UserActivityLog.Create(
                userId, roleName, clubId, teamId, ipAddress, eventType, actionOrPage, result, reason, subjectId);

            _db.UserActivityLogs.Add(log);
            return Task.CompletedTask;
        }

        private static string? ResolveClientIp(HttpContext? ctx)
        {
            if (ctx is null) return null;

            var forwardedFor = ctx.Request.Headers["X-Forwarded-For"].FirstOrDefault();
            if (!string.IsNullOrWhiteSpace(forwardedFor))
                return forwardedFor.Split(',')[0].Trim();

            return ctx.Connection.RemoteIpAddress?.ToString();
        }
    }
}
```
Register in `src/RFFM.Api/DependencyInjection/ServiceCollectionExtensions.cs`, next to the
`ICurrentUserService` registration: `services.AddScoped<IAuditLogger, AuditLogger>();`. Run the
tests from 3.1 — confirm Green.

## 4. Confirm validator error-code convention before writing `RecordPageAccess`

Open `Features/Coaches/Players/Commands/UpdatePlayer.cs` and 2 more validators of your choice
(e.g. `Features/Coaches/PlayerDocuments/UploadPlayerDocument.cs` if it exists, or any other
`AbstractValidator<T>` in `Features/`). If none set a custom `.WithErrorCode(...)`, do not add one
to `RecordPageAccessValidator` either — plain `RuleFor(...).NotEmpty().MaximumLength(100)` is
sufficient, relying on `ValidationBehavior`'s generic `ValidationFailed` code. If you find the real
convention differs from this, follow what you actually find and note the discrepancy in your
final report.

## 5. Page-access recording feature — Red then Green

### 5.1 Red

Create `tests/RFFM.Api.Tests/UnitTests/RecordPageAccessHandlerTests.cs`
(`[Collection(PostgresCollection.Name)]` + fixture, Moq `IAuditLogger`):
```csharp
#nullable enable
using System.Threading;
using System.Threading.Tasks;
using Moq;
using RFFM.Api.Domain.Entities.Audit;
using RFFM.Api.Features.Audit;
using RFFM.Api.Infrastructure.Services;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class RecordPageAccessHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;
        public RecordPageAccessHandlerTests(PostgresContainerFixture fixture) => _fixture = fixture;

        [Fact]
        public async Task Handle_ValidRequest_LogsPageAccessAndSaves()
        {
            await using var db = _fixture.CreateDbContext();
            var auditLoggerMock = new Mock<IAuditLogger>();
            var handler = new RecordPageAccess.Handler(db, auditLoggerMock.Object);

            await handler.Handle(new RecordPageAccess.RecordPageAccessCommand
            {
                PageIdentifier = "Roster", ClubId = "club-1", TeamId = "team-1"
            }, CancellationToken.None);

            auditLoggerMock.Verify(a => a.LogAsync(
                AuditEventType.PageAccess, "Roster", "Success",
                null, null, "club-1", "team-1", null, It.IsAny<CancellationToken>()), Times.Once);
        }
    }
}
```
Add validator-only tests inline or as a sibling `[Theory]` on empty/whitespace/over-length
`PageIdentifier` per `tasks.md` 5.2, using the same
`AbstractValidator<T>.TestValidate(...)`-or-direct-construction pattern already used by an
existing validator test in this repo (search `tests/` for an existing `*Validator*Tests.cs` and
mirror its exact style — if none exists, a direct `new RecordPageAccessValidator().Validate(cmd)`
+ `Assert.False(result.IsValid)` is sufficient).

Run — confirm it fails (type doesn't exist).

### 5.2 Green

Create `src/RFFM.Api/Features/Audit/RecordPageAccess.cs`:
```csharp
using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.Common;
using RFFM.Api.Domain.Entities.Audit;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Infrastructure.Services;

namespace RFFM.Api.Features.Audit
{
    /// <summary>
    /// Frontend calls this when a user enters an audited section (coarse-grained: once per
    /// section visit, not on every internal route change). PageIdentifier is the same string
    /// space as PagePermission.PageIdentifier. See openspec change user-activity-audit-log.
    /// </summary>
    public class RecordPageAccess : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/audit-log/page-access",
                    async (RecordPageAccessCommand command, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        await mediator.Send(command, cancellationToken);
                        return Results.Ok();
                    })
                .WithName(nameof(RecordPageAccess))
                .WithTags("Audit")
                .RequireAuthorization()
                .Produces(StatusCodes.Status200OK)
                .Produces(StatusCodes.Status400BadRequest);
        }

        public class RecordPageAccessCommand : ICommand
        {
            public string PageIdentifier { get; set; } = null!;
            public string? ClubId { get; set; }
            public string? TeamId { get; set; }
        }

        public class Handler : IRequestHandler<RecordPageAccessCommand, Unit>
        {
            private readonly AppDbContext _db;
            private readonly IAuditLogger _auditLogger;

            public Handler(AppDbContext db, IAuditLogger auditLogger)
            {
                _db = db;
                _auditLogger = auditLogger;
            }

            public async ValueTask<Unit> Handle(RecordPageAccessCommand request, CancellationToken cancellationToken = default)
            {
                await _auditLogger.LogAsync(
                    AuditEventType.PageAccess, request.PageIdentifier, "Success",
                    clubId: request.ClubId, teamId: request.TeamId, cancellationToken: cancellationToken);

                await _db.SaveChangesAsync(cancellationToken);
                return Unit.Value;
            }
        }

        public class RecordPageAccessValidator : AbstractValidator<RecordPageAccessCommand>
        {
            public RecordPageAccessValidator()
            {
                RuleFor(r => r.PageIdentifier).NotEmpty().MaximumLength(100);
            }
        }
    }
}
```
Run the tests from 5.1 — confirm Green.

## 6. Convocation accept/reject instrumentation — Red then Green

### 6.1 Resolve Open Question 1

Read `Domain/Entities/Teams/Team.cs` (adjust path if different) and confirm whether it exposes
`ClubId` directly. Also confirm `SportEvent`'s relation to `Team` (does `SportEvent` carry
`TeamId`, and is `Team` loaded via an additional `.Include(c => c.SportEvent.Team)` or does
`UpdateConvocationStatus.cs`'s existing `.Include(c => c.SportEvent)` already give you
`conv.SportEvent.TeamId`?). Record your finding as a one-line comment in the audit-logging call
you add in 6.3. If `Team.ClubId` is directly available and cheap (no extra query needed beyond
what's already loaded, or one extra `AsNoTracking()` lookup by `TeamId` is acceptable), stamp
`clubId` on the convocation audit rows too; otherwise leave `clubId: null` and rely on the
query-time scope resolution in `SearchAuditLog` (`design.md` Decision 6 already handles this via
`TeamId` alone for Coach; a ClubDirector's clubs are resolved from `UserClub`, and match this
row only if `SearchAuditLog`'s club-scope filter also considers team's club — if `clubId` is left
null here, confirm in task 8 that ClubDirector scope resolution still surfaces these rows via a
`TeamId`→`Club` join, or explicitly note in your final report that ClubDirector won't see
convocation events unless `clubId` is stamped, so the user can decide if that gap is acceptable).

### 6.2 Red

Open `tests/RFFM.Api.Tests/UnitTests/UpdateConvocationStatusHandlerTests.cs` and
`UpdateConvocationStatusSanctionCouplingTests.cs`. Every existing `new UpdateConvocationStatus.Handler(...)`
construction will break once you add the `IAuditLogger` constructor parameter — update all of them
to pass a `Mock<IAuditLogger>().Object` (or a shared helper) so existing tests keep compiling and
passing; this is not optional, do not leave them broken.

Add new failing test cases (append to `UpdateConvocationStatusHandlerTests.cs` or a new sibling
file `UpdateConvocationStatusAuditTests.cs` if that reads cleaner — your call, but keep it in
`UnitTests/`):
- Accepting (`NewStatusId = ConvocationStatus.Accepted.Id`, i.e. `2`) → `IAuditLogger.LogAsync`
  called once with `AuditEventType.ConvocationAccepted`, `reason: null`.
- Deconvoking with an explicit `ExcuseTypeId` (e.g. `ExcuseTypes.Injury.Id`) → called with
  `AuditEventType.ConvocationRejected`, `reason` equal to that excuse type's `Name` ("Lesión").
- Deconvoking with `ExcuseTypeId = null` → still called with a non-null `reason` (resolves to
  "Decisión técnica" per the handler's existing `?? 7` fallback — assert `reason == "Decisión
  técnica"`, not just non-null, to actually pin the value).
- A Player/FamilyMember attempting to modify another player's convocation (existing
  `ForbiddenAccessException` path) → `IAuditLogger.LogAsync` is **never** called (verify
  `Times.Never()`).

Run — confirm the new cases fail (behavior not yet implemented) and confirm the constructor-signature
fix alone doesn't accidentally make them pass for the wrong reason (i.e. genuinely check the Red
state before writing the `LogAsync` call).

### 6.3 Green

In `src/RFFM.Api/Features/Coaches/Convocations/UpdateConvocationStatus.cs`:
1. Add `private readonly IAuditLogger _auditLogger;` and take it in the `Handler` constructor.
2. After the `if (isNowDeconvoke) { ... } else { ... }` block resolves (i.e. right before the
   existing `await _db.SaveChangesAsync(cancellationToken);` line), insert:
```csharp
var eventType = isNowDeconvoke ? AuditEventType.ConvocationRejected : AuditEventType.ConvocationAccepted;
var reason = isNowDeconvoke
    ? ExcuseTypes.FromId(request.ExcuseTypeId ?? TechnicalDecisionExcuseTypeId).Name
    : null;
var auditRoleName = isPlayerOrFamilyRole
    ? roles.First(r => r.Equals("Player", StringComparison.OrdinalIgnoreCase) || r.Equals("FamilyMember", StringComparison.OrdinalIgnoreCase))
    : (_currentUser.Role ?? "Coach");

await _auditLogger.LogAsync(
    eventType, "ConvocationStatusChanged", "Success",
    reason: reason, subjectId: conv.Id, teamId: conv.SportEventId is null ? null : conv.SportEvent.TeamId,
    roleNameOverride: auditRoleName, cancellationToken: cancellationToken);
```
(Adjust `conv.SportEvent.TeamId` to the real property path confirmed in 6.1; if `isPlayerOrFamilyRole`
is scoped inside the `if` block earlier in the method rather than available at this point, hoist it
or recompute it — check the current method body, don't assume the variable is still in scope this
far down without verifying.) Add `using RFFM.Api.Domain.Entities.Audit;` and
`using RFFM.Api.Infrastructure.Services;` as needed.

Run all tests from 6.2 plus the full pre-existing suite in both files — confirm Green with zero
regressions.

## 7. Player-edit instrumentation — Red then Green

### 7.1 Red

Search `tests/RFFM.Api.Tests/` for any existing test covering `UpdateDeletePlayerHandler` /
`UpdatePlayerCommand` before creating a new file (avoid duplicating). If none exists, create
`tests/RFFM.Api.Tests/UnitTests/UpdatePlayerHandlerTests.cs`
(`[Collection(PostgresCollection.Name)]` + fixture, Moq `IAuditLogger`), seeding a real `Player`
row via the fixture (mirror how `UpdateConvocationStatusHandlerTests.cs` seeds a `Club` via
`Club.Create(...)` + `db.SaveChangesAsync()`), then:
```csharp
[Fact]
public async Task Handle_ValidCommand_LogsPlayerEditedAndSaves()
{
    // seed a Player row, capture its Id and ClubId
    // ...
    var auditLoggerMock = new Mock<IAuditLogger>();
    var handler = new UpdateDeletePlayerHandler(db, auditLoggerMock.Object);

    await handler.Handle(new UpdatePlayerCommand { Id = player.Id, Name = "New Name", Alias = "alias", ClubId = player.ClubId }, CancellationToken.None);

    auditLoggerMock.Verify(a => a.LogAsync(
        AuditEventType.PlayerEdited, "PlayerEdited", "Success",
        null, player.Id, player.ClubId, null, null, It.IsAny<CancellationToken>()), Times.Once);
}
```
Fill in the exact seeding call by reading `Domain/Entities/Players/Player.cs`'s factory method
signature first — do not guess it. Run — confirm it fails (constructor signature mismatch / type
doesn't compile).

### 7.2 Green

In `src/RFFM.Api/Features/Coaches/Players/Commands/UpdatePlayer.cs`:
1. Add `private readonly IAuditLogger _auditLogger;` to `UpdateDeletePlayerHandler`'s constructor.
2. After the `player.Update*(...)` calls, before `SaveChangesAsync`:
```csharp
await _auditLogger.LogAsync(
    AuditEventType.PlayerEdited, "PlayerEdited", "Success",
    subjectId: player.Id, clubId: request.ClubId, cancellationToken: cancellationToken);
```
Add `using RFFM.Api.Domain.Entities.Audit;` and `using RFFM.Api.Infrastructure.Services;`.

Run the test(s) from 7.1 — confirm Green.

## 8. Query endpoint — Red then Green

### 8.1 Resolve Open Question 2

Confirm with the design's stated default if no explicit user instruction is found in this
session's context: `pageNumber` default `1`, `pageSize` default `25`, max `100` (clamp, don't
error, on an out-of-range `pageSize`). Note this choice in your final report.

### 8.2 Red

Create `tests/RFFM.Api.Tests/UnitTests/SearchAuditLogHandlerTests.cs`
(`[Collection(PostgresCollection.Name)]` + fixture, Moq `ICurrentUserService`). Seed at least:
2 clubs, 2 teams (one per club, plus a 3rd team in one of the clubs to test the "multiple teams
per club" case), and `UserActivityLog` rows: some with `ClubId = club-A/TeamId = null`, some with
`TeamId = team-A1` (belongs to club-A), some with `TeamId = team-B1` (belongs to club-B). Seed
`UserClub`/`UserTeam` rows linking test user ids to specific clubs/teams. Cases:
- Federation/Administrator caller → all seeded rows returned, unfiltered.
- ClubDirector caller (linked to club-A via `UserClub`) → only rows with `ClubId == club-A` or
  `TeamId` belonging to one of club-A's teams (resolve the exact scope-join shape from
  `design.md` Decision 6 — if convocation rows only carry `TeamId` and no `ClubId`, the
  ClubDirector scope query must join `TeamId` → the team's club to include them; write the test
  first assuming this is required, then make the handler satisfy it).
- Coach caller (linked to `team-A1` via `UserTeam`) → only rows with `TeamId == "team-A1"`.
- `clubId`/`teamId`/`eventType`/`userId`/`from`/`to` filter params narrow further within scope.
- An out-of-scope `clubId`/`teamId` filter param (e.g. Coach passing club-B's id) → zero rows, not
  an error/exception.
- Pagination: seed >25 rows in one scope, confirm `pageSize=10` returns 10, `X-Total-Count`
  (or however the handler surfaces total — confirm via `GetNews.cs`'s
  `_httpContextAccessor.HttpContext!.Response.Headers["X-Total-Count"]` pattern) reflects the
  scoped total, not the global row count.

Run — confirm it fails (type doesn't exist).

### 8.3 Green

Create `src/RFFM.Api/Features/Audit/SearchAuditLog.cs` implementing `design.md` Decision 6 and the
API Contract section verbatim: `IFeatureModule` + `IQueryApp<UserActivityLogResponse[]>`,
`GET /api/audit-log`, `[Authorize(Roles = "Federation,Administrator,ClubDirector,Coach")]`,
`X-Total-Count` response header per the `GetNews.cs` pattern (including its defensive `try/catch`
around `_httpContextAccessor.HttpContext!...` for handler-unit-test contexts with no real HTTP
context). Resolve scope via `UserClub`/`UserTeam` lookups exactly as sketched in `design.md`
Decision 6 before applying request filter params as additional `Where` clauses.

Run the tests from 8.2 — confirm Green.

## 9. Full verification

1. `dotnet build` from `Back/ExtractionApi` — must be clean, zero warnings introduced by this change if the project treats warnings meaningfully (check existing build output for precedent).
2. `dotnet test` — full pass, zero skipped tests.
3. Confirm coverage: domain (`UserActivityLog`) ≥85%, new/modified handlers ≥80% — use whatever coverage tooling the repo already has configured (check for a `.runsettings`/coverlet config); if none exists, state so in your report rather than inventing a coverage number.
4. Manual smoke test via `dotnet run --project src/RFFM.Host`: `POST /api/audit-log/page-access`; accept then reject (with and without explicit `ExcuseTypeId`) a seeded convocation; edit a player; then `GET /api/audit-log` as Federation, as the scoped Coach, and confirm `403` for a Player/FamilyMember token.
5. Append a short "Resolved during implementation" note to `design.md`'s Open Questions section recording the real answers to Open Questions 1 and 2 (do not delete the original questions — append, so the design doc keeps its decision trail).

## 10. Report back

Summarize: files created/modified (full paths), test files and counts, the two Open Questions'
resolutions, any deviation from this script and why, and the exact `dotnet build`/`dotnet test`
output tail confirming a clean pass. Do not mark `tasks.md` checkboxes yourself unless
specifically asked — leave that to the orchestrating agent's review pass.
