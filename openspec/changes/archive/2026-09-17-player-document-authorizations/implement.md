# implement.md — player-document-authorizations (BACKEND ONLY)

You are the `openspec-implementer` subagent. Execute this script precisely and completely. This
change is **backend-only** — everything happens under `Back/ExtractionApi/`. Do **not** touch
`Front/` or `Mobile/`. A separate, already-designed frontend change
(`openspec/changes/player-document-authorizations-frontend/`) will consume the contract you build
here; you do not need to read it, but do not contradict it either (it is referenced only for your
awareness that this contract has an external consumer).

Follow **strict TDD (Red → Green → Refactor)**: for every unit of behavior, write a failing test
first, confirm it fails for the right reason, then write the minimal code to make it pass. Do not
write production code before a failing test exists for it. Coverage targets (repo convention,
`CLAUDE.md`): **≥85% on new domain logic** (`DocumentType`/`PlayerDocument`), **≥80% on new
handlers/commands**. No skipped tests (`[Fact(Skip = "...")]`) — if you're tempted to skip one,
stop and report why instead.

Repo root: `C:\Proyects\MisProyectos\FutbolBase`
Backend root: `Back/ExtractionApi` (all paths below are relative to this unless stated otherwise).

Authoritative source documents — **read these two files in full before writing any code**:
- `openspec/changes/player-document-authorizations/design.md` — the complete technical design,
  including the full "API Contract" section with every DTO shape and error code.
- `openspec/changes/player-document-authorizations/specs/player-document-authorizations/spec.md`
  — the testable requirements/scenarios; every scenario should map to at least one test you write.

This implement.md is self-contained and reproduces everything you need from those files plus the
surrounding codebase, but if anything here seems to contradict `design.md`, **design.md wins** —
stop and report the discrepancy rather than silently picking one.

## 0. Conventions you must follow (repo-wide, verified by inspection — not assumptions)

- **Vertical slice**: one feature = one `.cs` file under `Features/Coaches/PlayerDocuments/`
  holding endpoint registration (`IFeatureModule.AddRoutes`) + request record + command/query +
  handler + validator, all in one file. Do not split a handler from its endpoint.
- **CQRS interfaces**: `RFFM.Api.Common.ICommand<T>` for writes (upload, review), `IQueryApp<T>`
  for reads (catalog list, per-player list, team-wide list, PDF report — the report is read-only,
  it doesn't mutate state, so it's a query even though it "generates" a file). Both interfaces
  require `T : class` — arrays and `record` DTOs satisfy this; `byte[]` also satisfies it if you
  need it directly (you won't — the report handler returns a `record ExportPdfResult(byte[]
  Bytes, string FileName, string ContentType)`, mirroring
  `Features/Coaches/SeasonPrep/SeasonPrepExportPdf.cs`).
- **FluentValidation**: every `ICommand` needs an `AbstractValidator<T>` in the same file. Mirror
  `Features/Coaches/Players/Commands/UploadPlayerPhoto.cs`'s `UploadPlayerPhotoValidator` for file
  validation shape (`RuleFor(r => r.File).NotNull().Must(...)`, etc.) — but note this feature's
  file/role validation is more nuanced (ownership, content-type allowlist, size) and is partly
  enforced by hand inside the endpoint delegate/handler (mirroring
  `Features/Coaches/Teams/InjuryProtocol/SetTeamInjuryProtocol.cs`'s `Results.ValidationProblem`
  style for the parts that need a `403`/dynamic role check FluentValidation can't express).
- **Errors**: every error is `ProblemDetails` with `extensions["code"]` from
  `Domain/ErrorCodes.cs` — a real, centrally-maintained catalog (not per-feature literals). Add
  new constants there, grouped with a comment referencing this change, exactly like every existing
  block in that file.
- **DbContext**: everything lives in `AppDbContext` (schema `app`) —
  `Infrastructure/Persistence/AppDbContext.cs`. `modelBuilder.ConfigureSmartEnum()` (line ~160,
  from the `SmartEnum.EFCore` package) already auto-configures any `Ardalis.SmartEnum` property on
  any entity — you do **not** need a manual `HasConversion` for `PlayerDocumentStatus`, just
  `builder.Property(d => d.Status).IsRequired()` in the entity config, same as
  `TeamPlayerSanctionEntityConfiguration.cs` does for its own SmartEnum properties (`Category`,
  `SportivePunishmentType`).
- **Entity configs** are discovered via reflection (`IEntityTypeConfiguration<T>`) — do not
  register them manually anywhere.
- **Tests use plain xUnit `Assert`**, not FluentAssertions (verified: `TeamInjuryProtocolAttachmentTests.cs`,
  `GetMyPermissionsHandlerTests.cs` — this repo's actual convention, distinct from generic
  `.claude/rules/testing.md` guidance written for a different codebase).
- **Handler tests that touch `AppDbContext`** use a real Postgres testcontainer fixture, not
  mocks/InMemory — `[Collection(PostgresCollection.Name)]` + constructor-injected
  `PostgresContainerFixture fixture` + `await using var db = _fixture.CreateDbContext();` (see
  `tests/RFFM.Api.Tests/UnitTests/GetMyPermissionsHandlerTests.cs` and
  `FeaturePermissionsSeedParityTests.cs` for the exact pattern). Mock only
  `ICurrentUserService`/`IStorageService` with Moq — never mock `AppDbContext` itself.
- **Domain entity tests** are plain xUnit, no fixture, no Moq — construct the entity directly and
  assert (see `TeamInjuryProtocolAttachmentTests.cs`).

## 1. Domain model — Red then Green

### 1.1 `PlayerDocumentStatus` SmartEnum

Create `src/RFFM.Api/Domain/Entities/PlayerDocuments/PlayerDocumentStatus.cs`:
```csharp
using Ardalis.SmartEnum;

namespace RFFM.Api.Domain.Entities.PlayerDocuments
{
    /// <summary>
    /// Persisted states of a PlayerDocument. "Pending" is intentionally NOT a member here — it is
    /// a DTO-only value synthesized by query handlers when no PlayerDocument row exists yet for a
    /// TeamPlayer + DocumentType pair (design.md Decision 3). Never persist "Pending".
    /// </summary>
    public sealed class PlayerDocumentStatus : SmartEnum<PlayerDocumentStatus>
    {
        public static readonly PlayerDocumentStatus Delivered = new(nameof(Delivered), 1);
        public static readonly PlayerDocumentStatus Approved = new(nameof(Approved), 2);
        public static readonly PlayerDocumentStatus Rejected = new(nameof(Rejected), 3);

        private PlayerDocumentStatus(string name, int value) : base(name, value)
        {
        }
    }
}
```
No test file needed for this one alone (a bare SmartEnum with no custom logic) — its behavior is
exercised indirectly by the `PlayerDocument` entity tests below.

### 1.2 `DocumentType` entity — Red

Create `tests/RFFM.Api.Tests/UnitTests/DocumentTypeTests.cs`:
```csharp
#nullable enable
using RFFM.Api.Domain.Entities.PlayerDocuments;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class DocumentTypeTests
    {
        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        public void Create_RequiresName(string name)
        {
            Assert.Throws<ArgumentException>(() => DocumentType.Create(name, "some description"));
        }

        [Fact]
        public void Create_PersistsNameDescriptionAndDefaultsIsActiveTrue()
        {
            var type = DocumentType.Create("Autorización físico", "Autorización para entrenar fuera de las instalaciones");

            Assert.Equal("Autorización físico", type.Name);
            Assert.Equal("Autorización para entrenar fuera de las instalaciones", type.Description);
            Assert.True(type.IsActive);
        }

        [Fact]
        public void Create_AllowsNullDescription()
        {
            var type = DocumentType.Create("Autorización físico", null);

            Assert.Null(type.Description);
        }
    }
}
```
Run `dotnet test --filter DocumentTypeTests` from `Back/ExtractionApi` — confirm it fails to
compile (type doesn't exist yet). That compile failure IS your Red state for a brand-new type;
proceed to Green.

### 1.2 `DocumentType` entity — Green

Create `src/RFFM.Api/Domain/Entities/PlayerDocuments/DocumentType.cs`:
```csharp
namespace RFFM.Api.Domain.Entities.PlayerDocuments
{
    /// <summary>
    /// A reusable, data-backed document/authorization type (e.g. "Autorización para realizar
    /// físico fuera de las instalaciones"). New types are added as rows, not code — see
    /// openspec change player-document-authorizations, design.md Decision 1.
    /// </summary>
    public class DocumentType : BaseEntity
    {
        public string Name { get; private set; } = null!;
        public string? Description { get; private set; }
        public bool IsActive { get; private set; }

        private DocumentType() { }

        public static DocumentType Create(string name, string? description)
        {
            if (string.IsNullOrWhiteSpace(name))
                throw new ArgumentException("El nombre del tipo de documento es obligatorio.");

            return new DocumentType
            {
                Name = name,
                Description = description,
                IsActive = true
            };
        }
    }
}
```
Note: do **not** add `Rename`/`Activate`/`Deactivate` methods — nothing in this change calls them
(no admin CRUD endpoint per design.md Non-Goal #3). Keep the entity minimal (YAGNI); add those
methods in a future change if/when an admin endpoint is actually built.

Run the tests from 1.2 — green.

### 1.3 `PlayerDocument` entity — Red

Create `tests/RFFM.Api.Tests/UnitTests/PlayerDocumentTests.cs`:
```csharp
#nullable enable
using RFFM.Api.Domain.Entities.PlayerDocuments;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class PlayerDocumentTests
    {
        [Fact]
        public void Create_SetsDeliveredStatusAndUploadMetadata()
        {
            var doc = PlayerDocument.Create(
                "team-player-1", "document-type-1", "autorizacion.pdf",
                "player-documents/team-player-1/document-type-1/abc.pdf", "application/pdf",
                uploadedByUserId: "user-1", uploadedOnBehalf: false);

            Assert.Equal("team-player-1", doc.TeamPlayerId);
            Assert.Equal("document-type-1", doc.DocumentTypeId);
            Assert.Equal(PlayerDocumentStatus.Delivered, doc.Status);
            Assert.Equal("autorizacion.pdf", doc.FileName);
            Assert.Equal("player-documents/team-player-1/document-type-1/abc.pdf", doc.StorageUrl);
            Assert.Equal("application/pdf", doc.ContentType);
            Assert.Equal("user-1", doc.UploadedByUserId);
            Assert.False(doc.UploadedOnBehalf);
            Assert.NotNull(doc.UploadedAt);
            Assert.Null(doc.ReviewedByUserId);
            Assert.Null(doc.ReviewedAt);
            Assert.Null(doc.ReviewNote);
        }

        [Theory]
        [InlineData("", "document-type-1")]
        [InlineData("team-player-1", "")]
        public void Create_RequiresTeamPlayerIdAndDocumentTypeId(string teamPlayerId, string documentTypeId)
        {
            Assert.Throws<ArgumentException>(() => PlayerDocument.Create(
                teamPlayerId, documentTypeId, "file.pdf", "url", "application/pdf", "user-1", false));
        }

        [Fact]
        public void ReplaceFile_ResetsToDeliveredAndClearsReviewFields_WhenPreviouslyApproved()
        {
            var doc = PlayerDocument.Create(
                "team-player-1", "document-type-1", "old.pdf", "old-url", "application/pdf", "user-1", false);
            doc.Approve("coach-1", "Todo correcto");

            doc.ReplaceFile("new.pdf", "new-url", "image/jpeg", "user-1", false);

            Assert.Equal(PlayerDocumentStatus.Delivered, doc.Status);
            Assert.Equal("new.pdf", doc.FileName);
            Assert.Equal("new-url", doc.StorageUrl);
            Assert.Equal("image/jpeg", doc.ContentType);
            Assert.Null(doc.ReviewedByUserId);
            Assert.Null(doc.ReviewedAt);
            Assert.Null(doc.ReviewNote);
        }

        [Fact]
        public void ReplaceFile_ResetsToDeliveredAndClearsReviewFields_WhenPreviouslyRejected()
        {
            var doc = PlayerDocument.Create(
                "team-player-1", "document-type-1", "old.pdf", "old-url", "application/pdf", "user-1", false);
            doc.Reject("coach-1", "Firma ilegible");

            doc.ReplaceFile("new.pdf", "new-url", "application/pdf", "user-1", true);

            Assert.Equal(PlayerDocumentStatus.Delivered, doc.Status);
            Assert.True(doc.UploadedOnBehalf);
            Assert.Null(doc.ReviewedByUserId);
            Assert.Null(doc.ReviewNote);
        }

        [Fact]
        public void Approve_FromDelivered_SetsApprovedStatusAndReviewMetadata()
        {
            var doc = PlayerDocument.Create(
                "team-player-1", "document-type-1", "file.pdf", "url", "application/pdf", "user-1", false);

            doc.Approve("coach-1", "Correcto");

            Assert.Equal(PlayerDocumentStatus.Approved, doc.Status);
            Assert.Equal("coach-1", doc.ReviewedByUserId);
            Assert.Equal("Correcto", doc.ReviewNote);
            Assert.NotNull(doc.ReviewedAt);
        }

        [Fact]
        public void Reject_FromDelivered_SetsRejectedStatusAndReviewMetadata()
        {
            var doc = PlayerDocument.Create(
                "team-player-1", "document-type-1", "file.pdf", "url", "application/pdf", "user-1", false);

            doc.Reject("coach-1", "Firma ilegible");

            Assert.Equal(PlayerDocumentStatus.Rejected, doc.Status);
            Assert.Equal("coach-1", doc.ReviewedByUserId);
            Assert.Equal("Firma ilegible", doc.ReviewNote);
        }

        [Fact]
        public void Approve_WhenNotDelivered_Throws()
        {
            var doc = PlayerDocument.Create(
                "team-player-1", "document-type-1", "file.pdf", "url", "application/pdf", "user-1", false);
            doc.Approve("coach-1", null);

            var ex = Assert.Throws<InvalidOperationException>(() => doc.Approve("coach-1", null));
            Assert.Contains("Delivered", ex.Message);
        }

        [Fact]
        public void Reject_WhenNotDelivered_Throws()
        {
            var doc = PlayerDocument.Create(
                "team-player-1", "document-type-1", "file.pdf", "url", "application/pdf", "user-1", false);
            doc.Reject("coach-1", "x");

            Assert.Throws<InvalidOperationException>(() => doc.Reject("coach-1", "y"));
        }
    }
}
```
Run `dotnet test --filter PlayerDocumentTests` — confirm it fails (type doesn't exist).

### 1.3 `PlayerDocument` entity — Green

Create `src/RFFM.Api/Domain/Entities/PlayerDocuments/PlayerDocument.cs`:
```csharp
namespace RFFM.Api.Domain.Entities.PlayerDocuments
{
    /// <summary>
    /// One document/authorization instance for a specific season-scoped TeamPlayer + DocumentType
    /// pair. Keyed by (TeamPlayerId, DocumentTypeId) — NOT by PlayerId/SeasonId, because TeamPlayer
    /// is already season-scoped (a new TeamPlayer.Id per season). See openspec change
    /// player-document-authorizations, design.md Decision 2.
    /// "Pending" is never persisted here — its absence (no row) IS the Pending state, synthesized
    /// by query handlers (design.md Decision 3).
    /// </summary>
    public class PlayerDocument : BaseEntity
    {
        public string TeamPlayerId { get; private set; } = null!;
        public string DocumentTypeId { get; private set; } = null!;
        public PlayerDocumentStatus Status { get; private set; } = null!;
        public string FileName { get; private set; } = null!;
        public string StorageUrl { get; private set; } = null!;
        public string ContentType { get; private set; } = null!;
        public DateTime UploadedAt { get; private set; }
        public string UploadedByUserId { get; private set; } = null!;
        public bool UploadedOnBehalf { get; private set; }
        public string? ReviewedByUserId { get; private set; }
        public DateTime? ReviewedAt { get; private set; }
        public string? ReviewNote { get; private set; }

        private PlayerDocument() { }

        public static PlayerDocument Create(
            string teamPlayerId, string documentTypeId, string fileName, string storageUrl,
            string contentType, string uploadedByUserId, bool uploadedOnBehalf)
        {
            if (string.IsNullOrWhiteSpace(teamPlayerId))
                throw new ArgumentException("El jugador es obligatorio.");
            if (string.IsNullOrWhiteSpace(documentTypeId))
                throw new ArgumentException("El tipo de documento es obligatorio.");

            var doc = new PlayerDocument
            {
                TeamPlayerId = teamPlayerId,
                DocumentTypeId = documentTypeId
            };
            doc.ReplaceFile(fileName, storageUrl, contentType, uploadedByUserId, uploadedOnBehalf);
            return doc;
        }

        /// <summary>
        /// Replaces the stored file, always resetting to Delivered and clearing any prior review
        /// — regardless of the previous status (design.md Decision 4). Callers are responsible for
        /// deleting the previous StorageUrl from IStorageService before/after calling this.
        /// </summary>
        public void ReplaceFile(
            string fileName, string storageUrl, string contentType, string uploadedByUserId, bool uploadedOnBehalf)
        {
            FileName = fileName;
            StorageUrl = storageUrl;
            ContentType = contentType;
            UploadedByUserId = uploadedByUserId;
            UploadedOnBehalf = uploadedOnBehalf;
            UploadedAt = DateTime.UtcNow;
            Status = PlayerDocumentStatus.Delivered;
            ReviewedByUserId = null;
            ReviewedAt = null;
            ReviewNote = null;
        }

        public void Approve(string reviewedByUserId, string? note)
        {
            EnsureDelivered();
            Status = PlayerDocumentStatus.Approved;
            ReviewedByUserId = reviewedByUserId;
            ReviewedAt = DateTime.UtcNow;
            ReviewNote = note;
        }

        public void Reject(string reviewedByUserId, string? note)
        {
            EnsureDelivered();
            Status = PlayerDocumentStatus.Rejected;
            ReviewedByUserId = reviewedByUserId;
            ReviewedAt = DateTime.UtcNow;
            ReviewNote = note;
        }

        private void EnsureDelivered()
        {
            if (Status != PlayerDocumentStatus.Delivered)
                throw new InvalidOperationException(
                    $"Solo se puede revisar un documento en estado Delivered (estado actual: {Status.Name}).");
        }
    }
}
```
Run the tests from 1.3 — green.

**Important**: the domain-level `InvalidOperationException` from `EnsureDelivered` is caught at the
*handler* level (section 6 below) and translated to `409 Conflict` with `ErrorCodes.PlayerDocumentNotDelivered`
— do not throw a `DomainException` from the entity itself for this case (there's no existing
`ConflictException`-mapped domain exception type reused elsewhere for this shape; a plain
`try/catch (InvalidOperationException)` in the handler, mapped to `Results.Conflict(...)` with the
ProblemDetails code, is simplest and keeps the entity framework-agnostic). If you find a cleaner
existing exception type already mapped to 409 in `ServiceCollectionExtensions.cs` (`ConflictException`
was mentioned at line 224 during design research), prefer throwing that instead of a raw
`InvalidOperationException` — check it first and use whichever produces a real `409` with the
right `code` extension with the least new code.

### 1.4 Add `ErrorCodes.cs` constants

Edit `src/RFFM.Api/Domain/ErrorCodes.cs`, add a new block at the end (before the closing brace),
following the file's existing comment convention (one comment block per feature, referencing the
file(s) that use it):
```csharp
// Player document authorizations (Features/Coaches/PlayerDocuments/*) - openspec change
// player-document-authorizations.
public const string DocumentTypeNotFound = "DocumentTypeNotFound";
public const string PlayerDocumentAccessForbidden = "PlayerDocumentAccessForbidden";
public const string PlayerDocumentInvalidFile = "PlayerDocumentInvalidFile";
public const string PlayerDocumentFileTooLarge = "PlayerDocumentFileTooLarge";
public const string PlayerDocumentNotFound = "PlayerDocumentNotFound";
public const string PlayerDocumentNotDelivered = "PlayerDocumentNotDelivered";
```
(`TeamPlayerNotFound` already exists in the file, from `player-family-members-crud` — reuse it,
do not redeclare.)

## 2. Persistence — Red then Green

### 2.1 Entity configurations

Create `src/RFFM.Api/Infrastructure/Persistence/Configuration/Entities/DocumentTypeEntityConfiguration.cs`:
```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities.PlayerDocuments;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Entities
{
    internal class DocumentTypeEntityConfiguration : IEntityTypeConfiguration<DocumentType>
    {
        public void Configure(EntityTypeBuilder<DocumentType> builder)
        {
            builder.ToTable("DocumentTypes");
            builder.HasKey(d => d.Id);
            builder.Property(d => d.Name).HasMaxLength(200).IsRequired();
            builder.Property(d => d.Description).HasMaxLength(1000).IsRequired(false);
            builder.Property(d => d.IsActive).IsRequired().HasDefaultValue(true);
        }
    }
}
```

Create `src/RFFM.Api/Infrastructure/Persistence/Configuration/Entities/PlayerDocumentEntityConfiguration.cs`:
```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities.PlayerDocuments;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Entities
{
    internal class PlayerDocumentEntityConfiguration : IEntityTypeConfiguration<PlayerDocument>
    {
        public void Configure(EntityTypeBuilder<PlayerDocument> builder)
        {
            builder.ToTable("PlayerDocuments");
            builder.HasKey(d => d.Id);

            builder.Property(d => d.TeamPlayerId).IsRequired();
            builder.Property(d => d.DocumentTypeId).IsRequired();
            builder.Property(d => d.Status).IsRequired();
            builder.Property(d => d.FileName).HasMaxLength(255).IsRequired();
            builder.Property(d => d.StorageUrl).HasMaxLength(1000).IsRequired();
            builder.Property(d => d.ContentType).HasMaxLength(100).IsRequired();
            builder.Property(d => d.UploadedAt).IsRequired();
            builder.Property(d => d.UploadedByUserId).IsRequired();
            builder.Property(d => d.UploadedOnBehalf).IsRequired().HasDefaultValue(false);
            builder.Property(d => d.ReviewedByUserId).IsRequired(false);
            builder.Property(d => d.ReviewedAt).IsRequired(false);
            builder.Property(d => d.ReviewNote).HasMaxLength(1000).IsRequired(false);

            builder.HasIndex(d => new { d.TeamPlayerId, d.DocumentTypeId }).IsUnique();

            builder.HasOne<RFFM.Api.Domain.Entities.TeamPlayers.TeamPlayer>()
                .WithMany()
                .HasForeignKey(d => d.TeamPlayerId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne<DocumentType>()
                .WithMany()
                .HasForeignKey(d => d.DocumentTypeId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
```
(No navigation properties on `PlayerDocument` to `TeamPlayer`/`DocumentType` — the existing
`TeamPlayer`/`DocumentType` entities don't need a back-reference collection for this feature, and
none of the six endpoints need EF `Include()` through a nav property; a plain `HasForeignKey`
without `WithMany(tp => tp.SomeCollection)` is fine and matches the "only add what's used" spirit
of this codebase. If `dotnet build`/EF model validation complains about a required navigation,
add a minimal one — but try without first.)

### 2.2 `AppDbContext` DbSets

Edit `src/RFFM.Api/Infrastructure/Persistence/AppDbContext.cs`, add near the other `DbSet<>`
declarations (e.g. next to `TeamInjuryProtocols`):
```csharp
public DbSet<RFFM.Api.Domain.Entities.PlayerDocuments.DocumentType> DocumentTypes { get; set; }
public DbSet<RFFM.Api.Domain.Entities.PlayerDocuments.PlayerDocument> PlayerDocuments { get; set; }
```
(Use a `using RFFM.Api.Domain.Entities.PlayerDocuments;` at the top instead of fully-qualifying,
matching the file's existing style — check the top of the file for its using-block convention
before choosing.)

### 2.3 Migration

From `Back/ExtractionApi`, run:
```
.\manage-migrations.ps1
```
(or, if that script prompts interactively in a way you can't drive non-interactively, fall back to
`dotnet ef migrations add AddPlayerDocumentAuthorizations --project src/RFFM.Api --startup-project src/RFFM.Host`
— check `manage-migrations.ps1`'s contents first to confirm the exact project/startup-project
paths it uses, and prefer it since it's the documented, canonical way this repo generates
migrations).

After the migration file is generated, **manually edit it** to seed the one `DocumentType` row via
raw SQL with a **fixed, hardcoded GUID** — do NOT use `Guid.NewGuid()` in a migration (it would
generate a different, non-reproducible id every time the migration is authored/replayed). Mirror
`20260405154302_SeedGameMomentZones.cs`'s `ON CONFLICT DO NOTHING` pattern, adapted for a `text`
primary key column (not the integer one that migration uses):
```csharp
protected override void Up(MigrationBuilder migrationBuilder)
{
    // ... the auto-generated CreateTable calls stay as EF Core generated them ...

    migrationBuilder.Sql(@"
        INSERT INTO app.""DocumentTypes"" (""Id"", ""Name"", ""Description"", ""IsActive"") VALUES
            ('11111111-1111-1111-1111-111111111111',
             'Autorización para realizar físico fuera de las instalaciones',
             'Autorización firmada por el jugador o su familia para entrenar/preparar físico fuera de las instalaciones del club.',
             true)
        ON CONFLICT (""Id"") DO NOTHING;
    ");
}

protected override void Down(MigrationBuilder migrationBuilder)
{
    migrationBuilder.Sql(@"DELETE FROM app.""DocumentTypes"" WHERE ""Id"" = '11111111-1111-1111-1111-111111111111';");

    // ... the auto-generated DropTable calls, but make sure this Sql delete runs BEFORE
    // DropTable so it doesn't error against an already-dropped table; EF generates Down() in
    // reverse order of Up() by default, so double check the ordering and move the DropTable
    // calls after this Sql (or before — whichever avoids operating on a dropped table) ...
}
```
Verify column names exactly match what EF Core actually generated for the `CreateTable` call in
this same migration file (Postgres/Npgsql quoting is case-sensitive with EF's default PascalCase
column names) — read the generated migration file's `CreateTable` block for `DocumentTypes` before
writing the `INSERT`, don't assume the exact casing/naming from this script.

Run `dotnet build` — clean. Apply the migration against your local dev DB (however
`manage-migrations.ps1`/the test fixture normally does it — check if `PostgresContainerFixture`
auto-applies migrations, since the Postgres-testcontainer-based handler tests below need this
table to exist).

## 3. Storage plumbing

No new file strictly required — the bucket name `"player-documents"` and path convention
`{teamPlayerId}/{documentTypeId}/{guid}{extension}` can be inline constants/string interpolation
inside `UploadPlayerDocument.cs` (section 5 below), mirroring how
`SetTeamInjuryProtocol.cs` inlines `AttachmentsBucket`/`MaxAttachmentSizeBytes` as `private const`
fields on its `IFeatureModule` class rather than a separate constants file. Do the same here: a
`private const string PlayerDocumentsBucket = "player-documents";` and
`private const long MaxFileSizeBytes = 10 * 1024 * 1024;` on `UploadPlayerDocument`'s class.

Reuse `SetTeamInjuryProtocol.cs`'s `ExtractFilePath(string storageUrl, string bucket)` helper
pattern (recovers the storage-relative path from either a bare `bucket/path` or absolute Supabase
URL) for the best-effort delete-before-replace step — duplicate that small static method into
`UploadPlayerDocument.cs` (it's a private 5-line helper, not worth extracting to a shared file for
one extra caller — if you find yourself needing it a third time in this codebase, that's the
signal to extract, not now).

## 4. Catalog feature — Red then Green

### 4.1 Red

Create `tests/RFFM.Api.Tests/UnitTests/PlayerDocumentTypesQueriesTests.cs`:
```csharp
#nullable enable
using RFFM.Api.Features.Coaches.PlayerDocuments;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class PlayerDocumentTypesQueriesTests
    {
        private readonly PostgresContainerFixture _fixture;

        public PlayerDocumentTypesQueriesTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        [Fact]
        public async Task Handle_ReturnsOnlyActiveDocumentTypes()
        {
            await using var db = _fixture.CreateDbContext();
            var active = RFFM.Api.Domain.Entities.PlayerDocuments.DocumentType.Create("Activo", null);
            db.DocumentTypes.Add(active);
            await db.SaveChangesAsync();

            var handler = new PlayerDocumentTypesQueries.Handler(db);
            var result = await handler.Handle(new PlayerDocumentTypesQueries.DocumentTypesQuery(), CancellationToken.None);

            Assert.Contains(result, r => r.Id == active.Id && r.Name == "Activo" && r.IsActive);
        }
    }
}
```
(Adjust the exact nested-type names — `Handler`/`DocumentTypesQuery`/response record name — to
whatever you actually name them in 4.2 below; keep this test file's names in sync with the
production code you write, this is illustrative of the shape, not a byte-for-byte contract.)

Run it — fails (feature doesn't exist).

### 4.2 Green

Create `src/RFFM.Api/Features/Coaches/PlayerDocuments/PlayerDocumentTypesQueries.cs`:
```csharp
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.PlayerDocuments
{
    public class PlayerDocumentTypesQueries : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/catalog/document-types",
                    async (IMediator mediator, CancellationToken ct) =>
                        await mediator.Send(new DocumentTypesQuery(), ct))
                .WithName(nameof(PlayerDocumentTypesQueries))
                .WithTags("PlayerDocuments")
                .Produces<DocumentTypeResponse[]>()
                .RequireAuthorization();
        }

        public record DocumentTypesQuery : IQueryApp<DocumentTypeResponse[]>;

        public record DocumentTypeResponse(string Id, string Name, string? Description, bool IsActive);

        public class Handler(AppDbContext db) : IRequestHandler<DocumentTypesQuery, DocumentTypeResponse[]>
        {
            public async ValueTask<DocumentTypeResponse[]> Handle(DocumentTypesQuery request, CancellationToken cancellationToken)
            {
                return await db.DocumentTypes
                    .AsNoTracking()
                    .Where(d => d.IsActive)
                    .Select(d => new DocumentTypeResponse(d.Id, d.Name, d.Description, d.IsActive))
                    .ToArrayAsync(cancellationToken);
            }
        }
    }
}
```
No FluentValidation needed (it's a parameterless query). No caching (`ICacheRequest`) either —
this endpoint returns actively-changing data at the pace this feature cares about (well, it barely
changes at all, but there's no admin CRUD to invalidate a cache against in this change; skip
`ICacheRequest`/`IInvalidateCacheRequest` entirely here — adding cache invalidation with nothing
that invalidates it is dead complexity).

Run the test from 4.1 — green.

## 5. Self-service (Player/FamilyMember) + on-behalf (Coach/Administrator) features — Red then Green

Both `GetPlayerDocuments` and `UploadPlayerDocument` share the same ownership-check shape. Extract
a small private static helper inside whichever file you write first and call it from the other —
do NOT duplicate the `UserTeam.LinkedTeamPlayerId` lookup logic twice; if both files need it,
either (a) put both endpoints in ONE file (acceptable — they're two closely-related actions on the
same resource, similar to how `SetTeamInjuryProtocol.cs` bundles 5 routes in one file) or (b) keep
them in two files and duplicate the ~5-line ownership check (also acceptable, matches
`UpdateTeamPlayer.cs`'s self-contained inline check) — your call, but do not create a third shared
file just for this one helper.

### 5.1 `GetPlayerDocuments` — Red

Create `tests/RFFM.Api.Tests/UnitTests/GetPlayerDocumentsTests.cs` (or a handler-focused test if
you structure the endpoint as inline Minimal API + a small internal service method — see the note
on architecture style below). Cover, each as its own test method against a real
`PostgresContainerFixture` (mock only `ICurrentUserService`):

1. A `TeamPlayer` with no `PlayerDocument` rows and one active `DocumentType` → the response
   contains one entry with `status: "Pending"` and null file fields.
2. A `TeamPlayer` with an `Approved` `PlayerDocument` for that type → the response reflects
   `status: "Approved"` with the file/review metadata populated.
3. A `Player`/`FamilyMember` role whose `UserTeam.LinkedTeamPlayerId` does NOT match the requested
   `teamPlayerId` → `403 Forbidden` with `ErrorCodes.PlayerDocumentAccessForbidden` (assert via
   whatever mechanism your test harness uses to assert `Results.Problem`/`IResult` outcomes — if
   you're testing an inline Minimal API delegate directly rather than a Mediator handler, you may
   need a lightweight functional/integration-style test instead of a pure unit test; use whichever
   existing precedent in `tests/RFFM.Api.Tests/` most closely matches testing an inline delegate
   with role/ownership branching — `UpdateTeamPlayer.cs` is exactly this shape, so look for its
   test file first (search `tests/` for `UpdateTeamPlayer`) and mirror that file's approach
   exactly, including whether it tests the handler logic extracted into a static/testable method
   vs. spinning up a test server).
4. A `Coach`/`Administrator` role can fetch ANY `teamPlayerId`'s documents (no ownership check).

**Architecture note**: like `UpdateTeamPlayer.cs` and `SetTeamInjuryProtocol.cs`, this endpoint's
ownership branching (`isPrivileged` check, `UserTeam.LinkedTeamPlayerId` comparison) is naturally
an **inline Minimal API delegate**, not a Mediator `ICommand`/`IQueryApp` — those two sibling
files intentionally bypass Mediator for exactly this reason (see `SetTeamInjuryProtocol.cs`'s own
top-of-file comment explaining why). Follow that same precedent for `GetPlayerDocuments.cs` and
`UploadPlayerDocument.cs` (both need the ownership branch) — use inline `app.MapGet`/`app.MapPost`
delegates with `[Authorize(Roles = "Coach,Administrator,Player,FamilyMember")]`, injecting
`AppDbContext`, `ICurrentUserService`, and (for upload) `IStorageService` directly into the
delegate, exactly like `UpdateTeamPlayer.cs` does. This means these two files do NOT implement
`ICommand`/`IQueryApp` — that's fine and consistent with the two closest precedents in this
codebase for "role-branching ownership check on a single resource." The purely role-gated
endpoints without ownership branching (`GetTeamPlayerDocumentsStatus`, `ReviewPlayerDocument`,
`ExportPlayerDocumentsReport`, and the catalog query above) DO use `ICommand`/`IQueryApp` per
normal convention, since they don't need this special-case bypass.

For testing an inline Minimal API delegate with ownership branching, if you cannot find a direct
unit-test precedent for `UpdateTeamPlayer.cs`'s delegate itself (it may only be covered by
functional/integration tests hitting a real test server), extract the branching logic (the
`isPrivileged`/`LinkedTeamPlayerId` check + the actual query) into a small internal static or
instance method that the Minimal API delegate calls, and unit-test THAT method directly against
the Postgres fixture — this keeps the delegate itself a thin wrapper (a few lines: parse
role/ownership → call the method → map result to `Results.Ok`/`Results.Problem`) while making the
actual logic fully unit-testable. This is a reasonable, minimal refactor beyond the exact shape of
`UpdateTeamPlayer.cs`/`SetTeamInjuryProtocol.cs` (which don't extract this) — justified because
those two files aren't under test today, but this new code must be, per the TDD mandate. Note this
deviation in your final report.

### 5.1 `GetPlayerDocuments` — Green

Create `src/RFFM.Api/Features/Coaches/PlayerDocuments/GetPlayerDocuments.cs`:
```csharp
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.PlayerDocuments
{
    // Ownership-branching inline Minimal API handler, mirroring UpdateTeamPlayer.cs's rationale
    // exactly: Player/FamilyMember may only read their OWN linked TeamPlayer's documents
    // (UserTeam.LinkedTeamPlayerId), Coach/Administrator may read anyone's.
    public class GetPlayerDocuments : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/catalog/teamplayer/{teamPlayerId}/documents",
                    [Authorize(Roles = "Coach,Administrator,Player,FamilyMember")]
                    async (string teamPlayerId, AppDbContext db, ICurrentUserService currentUser, CancellationToken ct) =>
                    {
                        var isPrivileged = IsPrivileged(currentUser);
                        if (!isPrivileged && !await IsOwnTeamPlayer(db, currentUser, teamPlayerId, ct))
                            return Results.Problem(
                                statusCode: StatusCodes.Status403Forbidden,
                                title: "No autorizado",
                                detail: "No tienes permiso para ver los documentos de este jugador.",
                                extensions: new Dictionary<string, object?> { ["code"] = ErrorCodes.PlayerDocumentAccessForbidden });

                        var teamPlayerExists = await db.TeamPlayers.AnyAsync(tp => tp.Id == teamPlayerId, ct);
                        if (!teamPlayerExists) return Results.NotFound();

                        var responses = await BuildResponses(db, teamPlayerId, ct);
                        return Results.Ok(responses);
                    })
                .WithName(nameof(GetPlayerDocuments))
                .WithTags("PlayerDocuments")
                .Produces<PlayerDocumentResponse[]>()
                .RequireAuthorization();
        }

        internal static bool IsPrivileged(ICurrentUserService currentUser)
            => (currentUser.Roles ?? Enumerable.Empty<string>())
                .Any(r => string.Equals(r, "Coach", StringComparison.OrdinalIgnoreCase) ||
                          string.Equals(r, "Administrator", StringComparison.OrdinalIgnoreCase));

        internal static async Task<bool> IsOwnTeamPlayer(AppDbContext db, ICurrentUserService currentUser, string teamPlayerId, CancellationToken ct)
            => await db.Set<UserTeam>().AsNoTracking()
                .AnyAsync(ut => ut.ApplicationUserId == currentUser.UserId && ut.LinkedTeamPlayerId == teamPlayerId, ct);

        internal static async Task<PlayerDocumentResponse[]> BuildResponses(AppDbContext db, string teamPlayerId, CancellationToken ct)
        {
            var activeTypes = await db.DocumentTypes.AsNoTracking().Where(d => d.IsActive).ToListAsync(ct);
            var existingDocs = await db.PlayerDocuments.AsNoTracking()
                .Where(pd => pd.TeamPlayerId == teamPlayerId)
                .ToListAsync(ct);

            return activeTypes.Select(type =>
            {
                var doc = existingDocs.FirstOrDefault(d => d.DocumentTypeId == type.Id);
                return doc is null
                    ? new PlayerDocumentResponse(type.Id, type.Name, teamPlayerId, "Pending", null, null, null, null, null, null, null)
                    : new PlayerDocumentResponse(
                        type.Id, type.Name, teamPlayerId, doc.Status.Name,
                        doc.FileName, doc.StorageUrl, doc.ContentType, doc.UploadedAt, doc.UploadedOnBehalf,
                        doc.ReviewedAt, doc.ReviewNote);
            }).ToArray();
        }

        public record PlayerDocumentResponse(
            string DocumentTypeId, string DocumentTypeName, string TeamPlayerId, string Status,
            string? FileName, string? Url, string? ContentType, DateTime? UploadedAt,
            bool? UploadedOnBehalf, DateTime? ReviewedAt, string? ReviewNote);
    }
}
```
Run the tests from 5.1 — green. (`internal static` visibility lets the test project call these
directly if `InternalsVisibleTo` is already configured for `RFFM.Api.Tests` — check
`RFFM.Api.csproj`/`AssemblyInfo` for an existing `InternalsVisibleTo` entry first; if none exists,
either add one (check how other `internal` types in this codebase are already tested — there may
be a precedent) or make these methods `public static` instead, whichever matches the codebase's
existing pattern for testing non-Mediator internals.)

### 5.2 `UploadPlayerDocument` — Red

Create `tests/RFFM.Api.Tests/UnitTests/UploadPlayerDocumentTests.cs`, covering (Postgres fixture +
Moq `IStorageService`):
1. Valid PDF upload by the owning `FamilyMember` → creates a `PlayerDocument` row with
   `Status = Delivered`, `UploadedOnBehalf = false`.
2. Valid image upload (`image/jpeg`) by `Coach` on behalf of a different player →
   `UploadedOnBehalf = true`.
3. Non-owning `Player`/`FamilyMember` → `403` `PlayerDocumentAccessForbidden`, `IStorageService.UploadAsync`
   never called (`Mock.Verify(..., Times.Never)`).
4. Missing/empty file → `400` `PlayerDocumentInvalidFile`.
5. Unsupported content type (e.g. `application/msword`) → `400` `PlayerDocumentInvalidFile`.
6. File over 10 MB → `400` `PlayerDocumentFileTooLarge`.
7. Re-upload over an existing `Approved` `PlayerDocument` → resulting row has `Status = Delivered`,
   `ReviewedAt`/`ReviewNote` are `null`, AND `IStorageService.DeleteAsync` was called for the
   previous file's path (verify the mock call, or at minimum that it was attempted — a delete
   failure should not prevent the new file from being saved; test that too as its own case if you
   want full coverage of the best-effort semantics, e.g. mock `DeleteAsync` to return `false`/throw
   and assert the upload still succeeds).

Run — fails.

### 5.2 `UploadPlayerDocument` — Green

Create `src/RFFM.Api/Features/Coaches/PlayerDocuments/UploadPlayerDocument.cs`, mirroring
`SetTeamInjuryProtocol.cs`'s upload route shape (inline delegate, `IFormFile`,
`Results.ValidationProblem` for 400s, `.DisableAntiforgery()`) plus `GetPlayerDocuments`'s
ownership check (reuse its `IsPrivileged`/`IsOwnTeamPlayer` static helpers — internal, same
namespace, no extra using needed beyond the class reference):

```csharp
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities.PlayerDocuments;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Infrastructure.Storage;

namespace RFFM.Api.Features.Coaches.PlayerDocuments
{
    public class UploadPlayerDocument : IFeatureModule
    {
        private const string PlayerDocumentsBucket = "player-documents";
        private const long MaxFileSizeBytes = 10 * 1024 * 1024;
        private static readonly HashSet<string> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase)
        {
            "application/pdf", "image/jpeg", "image/png"
        };

        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/catalog/teamplayer/{teamPlayerId}/documents/{documentTypeId}",
                    [Authorize(Roles = "Coach,Administrator,Player,FamilyMember")]
                    async (string teamPlayerId, string documentTypeId, IFormFile file,
                        AppDbContext db, ICurrentUserService currentUser, IStorageService storageService,
                        CancellationToken ct) =>
                    {
                        var isPrivileged = GetPlayerDocuments.IsPrivileged(currentUser);
                        if (!isPrivileged && !await GetPlayerDocuments.IsOwnTeamPlayer(db, currentUser, teamPlayerId, ct))
                            return Results.Problem(
                                statusCode: StatusCodes.Status403Forbidden,
                                title: "No autorizado",
                                detail: "No tienes permiso para subir documentos de este jugador.",
                                extensions: new Dictionary<string, object?> { ["code"] = ErrorCodes.PlayerDocumentAccessForbidden });

                        if (file is null || file.Length == 0 || !AllowedContentTypes.Contains(file.ContentType))
                            return Results.ValidationProblem(new Dictionary<string, string[]>
                            {
                                ["file"] = new[] { "El fichero debe ser un PDF, JPG o PNG." }
                            }, extensions: new Dictionary<string, object?> { ["code"] = ErrorCodes.PlayerDocumentInvalidFile });

                        if (file.Length > MaxFileSizeBytes)
                            return Results.ValidationProblem(new Dictionary<string, string[]>
                            {
                                ["file"] = new[] { "El fichero no puede superar los 10 MB." }
                            }, extensions: new Dictionary<string, object?> { ["code"] = ErrorCodes.PlayerDocumentFileTooLarge });

                        var teamPlayerExists = await db.TeamPlayers.AnyAsync(tp => tp.Id == teamPlayerId, ct);
                        if (!teamPlayerExists) return Results.NotFound();

                        var documentType = await db.DocumentTypes.FirstOrDefaultAsync(d => d.Id == documentTypeId, ct);
                        if (documentType is null)
                            return Results.Problem(
                                statusCode: StatusCodes.Status404NotFound,
                                title: "Tipo de documento no encontrado",
                                extensions: new Dictionary<string, object?> { ["code"] = ErrorCodes.DocumentTypeNotFound });

                        var existing = await db.PlayerDocuments
                            .FirstOrDefaultAsync(pd => pd.TeamPlayerId == teamPlayerId && pd.DocumentTypeId == documentTypeId, ct);

                        var storedFileName = $"{teamPlayerId}/{documentTypeId}/{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
                        var previousUrl = existing?.StorageUrl;

                        var url = await storageService.UploadAsync(PlayerDocumentsBucket, storedFileName, file, ct);

                        var uploadedOnBehalf = isPrivileged && !await GetPlayerDocuments.IsOwnTeamPlayer(db, currentUser, teamPlayerId, ct);

                        if (existing is null)
                        {
                            existing = PlayerDocument.Create(
                                teamPlayerId, documentTypeId, file.FileName, url, file.ContentType,
                                currentUser.UserId!, uploadedOnBehalf);
                            db.PlayerDocuments.Add(existing);
                        }
                        else
                        {
                            existing.ReplaceFile(file.FileName, url, file.ContentType, currentUser.UserId!, uploadedOnBehalf);
                        }

                        await db.SaveChangesAsync(ct);

                        if (previousUrl is not null)
                        {
                            var previousPath = ExtractFilePath(previousUrl, PlayerDocumentsBucket);
                            try { await storageService.DeleteAsync(PlayerDocumentsBucket, previousPath, ct); }
                            catch { /* best-effort, do not fail the upload */ }
                        }

                        return Results.Ok(new GetPlayerDocuments.PlayerDocumentResponse(
                            documentTypeId, documentType.Name, teamPlayerId, existing.Status.Name,
                            existing.FileName, existing.StorageUrl, existing.ContentType, existing.UploadedAt,
                            existing.UploadedOnBehalf, existing.ReviewedAt, existing.ReviewNote));
                    })
                .WithName(nameof(UploadPlayerDocument))
                .WithTags("PlayerDocuments")
                .Produces<GetPlayerDocuments.PlayerDocumentResponse>()
                .RequireAuthorization()
                .DisableAntiforgery();
        }

        /// <summary>Same helper as SetTeamInjuryProtocol.cs — recovers the storage-relative path
        /// from a stored URL that may be a bare "bucket/path" or an absolute public URL.</summary>
        private static string ExtractFilePath(string storageUrl, string bucket)
        {
            var marker = $"{bucket}/";
            var index = storageUrl.IndexOf(marker, StringComparison.Ordinal);
            return index >= 0 ? storageUrl[(index + marker.Length)..] : storageUrl;
        }
    }
}
```
**Check as you implement**: does `Results.ValidationProblem(...)` in this codebase's ASP.NET Core
version accept an `extensions` parameter directly, or do you need `Results.Problem` with a
`ValidationProblemDetails`-shaped body instead to attach `extensions["code"]`? Look at exactly how
`SetTeamInjuryProtocol.cs` attaches an error code to its own `Results.ValidationProblem` calls (it
currently does NOT attach a `code` extension to those — it only uses inline Spanish messages). If
`Results.ValidationProblem` genuinely can't carry a `code` extension in this ASP.NET Core version,
use `Results.Problem(statusCode: 400, ...)` with the `extensions` dictionary instead (same shape
already used above for the 403/404 cases), so the `code` always reaches the frontend — this is
required by design.md's contract table, don't drop it silently even if it means diverging from
`SetTeamInjuryProtocol.cs`'s exact call shape for this one case.

Run the tests from 5.2 — green.

### 5.3 Refactor
If `UploadPlayerDocument`'s delegate body feels too long after Green, extract the validation
block or the "resolve documentType + existing PlayerDocument" block into a small private static
method within the same file (not a new shared file). Re-run 5.1+5.2 suites — stays green.

## 6. Coach-scoped features — Red then Green

### 6.1 `GetTeamPlayerDocumentsStatus` — Red

Create `tests/RFFM.Api.Tests/UnitTests/GetTeamPlayerDocumentsStatusTests.cs` ([Collection(PostgresCollection.Name)]):
1. A team with 3 `TeamPlayer`s, one `Approved`, one `Delivered`, one with no `PlayerDocument` row
   → the query returns 3 rows with the correct statuses, the third being `"Pending"`.
2. Filters correctly to the requested `documentTypeId` only (a second, unrelated `DocumentType`
   with different statuses for the same players must not leak into the result).

Run — fails.

### 6.1 `GetTeamPlayerDocumentsStatus` — Green

Create `src/RFFM.Api/Features/Coaches/PlayerDocuments/GetTeamPlayerDocumentsStatus.cs`, a normal
`IQueryApp<T>` (no ownership branching needed — Coach/Administrator-only via `[Authorize(Roles = ...)]`
is expressed on the Minimal API route the way `PlayerDocumentTypesQueries` does, OR you can use
`RequireAuthorization()` + role check the same way, whichever pattern this file's sibling
`GetPlayersByTeam.cs` prefers — that file uses `IRequireFeaturePermission`/`CoachFeatureRoutes.Squad`
instead of a raw `[Authorize(Roles=...)]`; for THIS feature, do **not** introduce
`IRequireFeaturePermission` — there's no seeded `FeatureRoute` for the underlying API call itself
(only for the frontend PAGE, via Decision 10's `PlayerDocuments` route, which is a separate,
frontend-facing concern) — use a plain `[Authorize(Roles = "Coach,Administrator")]` on the Minimal
API route registration, matching `SetTeamInjuryProtocol.cs`'s write routes):

```csharp
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.PlayerDocuments
{
    public class GetTeamPlayerDocumentsStatus : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/catalog/team/{teamId}/documents",
                    [Authorize(Roles = "Coach,Administrator")]
                    async (string teamId, string documentTypeId, IMediator mediator, CancellationToken ct) =>
                        Results.Ok(await mediator.Send(new TeamPlayerDocumentsStatusQuery(teamId, documentTypeId), ct)))
                .WithName(nameof(GetTeamPlayerDocumentsStatus))
                .WithTags("PlayerDocuments")
                .Produces<TeamPlayerDocumentStatusResponse[]>()
                .RequireAuthorization();
        }

        // NOTE: no SeasonId here — Team is itself season-scoped (design.md Decision 7); teamId
        // alone already identifies a single season's roster, exactly like GetPlayersByTeam.cs.
        public record TeamPlayerDocumentsStatusQuery(string TeamId, string DocumentTypeId) : IQueryApp<TeamPlayerDocumentStatusResponse[]>;

        public record TeamPlayerDocumentStatusResponse(
            string TeamPlayerId, string PlayerId, string PlayerName, int? Dorsal,
            string Status, DateTime? UploadedAt, DateTime? ReviewedAt);

        public class Handler(AppDbContext db) : IRequestHandler<TeamPlayerDocumentsStatusQuery, TeamPlayerDocumentStatusResponse[]>
        {
            public async ValueTask<TeamPlayerDocumentStatusResponse[]> Handle(
                TeamPlayerDocumentsStatusQuery request, CancellationToken cancellationToken)
            {
                // Mirrors GetPlayersByTeam.cs's Where(tp => tp.TeamId == teamId) exactly — no
                // season filter, because a teamId can only ever have TeamPlayers from its own season.
                var roster = await db.TeamPlayers.AsNoTracking()
                    .Include(tp => tp.Player)
                    .Where(tp => tp.TeamId == request.TeamId)
                    .Select(tp => new
                    {
                        tp.Id,
                        tp.PlayerId,
                        Name = tp.Player.Name,
                        Dorsal = tp.Dorsal != null ? tp.Dorsal.Number : (int?)null
                    })
                    .ToListAsync(cancellationToken);

                var docs = await db.PlayerDocuments.AsNoTracking()
                    .Where(pd => pd.DocumentTypeId == request.DocumentTypeId && roster.Select(r => r.Id).Contains(pd.TeamPlayerId))
                    .ToListAsync(cancellationToken);

                return roster.Select(r =>
                {
                    var doc = docs.FirstOrDefault(d => d.TeamPlayerId == r.Id);
                    return new TeamPlayerDocumentStatusResponse(
                        r.Id, r.PlayerId, r.Name, r.Dorsal,
                        doc?.Status.Name ?? "Pending", doc?.UploadedAt, doc?.ReviewedAt);
                }).ToArray();
            }
        }
    }
}
```
(Check whether EF Core can translate `roster.Select(r => r.Id).Contains(...)` against an
in-memory list within the second query — if it errors on translation, materialize `roster`'s ids
into a `List<string>`/`string[]` first via `.ToList()` before the second query, which you're
already doing since `roster` itself is materialized with `.ToListAsync()` above — this should Just
Work since `roster` is already a plain C# list at that point, not an `IQueryable`.)

Run 6.1's tests — green.

### 6.2 PDF report generator — Red then Green

Create `tests/RFFM.Api.Tests/UnitTests/PlayerDocumentsReportPdfGeneratorTests.cs`: at minimum, one
test asserting `GeneratePdfAsync(...)` (or whatever you name the method) returns a non-empty
`byte[]` starting with the PDF magic bytes (`%PDF`, i.e. `0x25 0x50 0x44 0x46`) for a small fixture
list of rows. Look at `Services/Export/SeasonPrepPdfGenerator.cs` first for its exact public method
signature/DI registration shape and mirror it as closely as sensible — this generator is much
simpler (one table, no template modes), so don't copy its full complexity, just its QuestPDF
bootstrapping pattern (`Document.Create(...)`, `.GeneratePdf()`, DI lifetime).

Create `src/RFFM.Api/Services/Export/PlayerDocumentsReportPdfGenerator.cs` with a method like:
```csharp
public byte[] GeneratePdf(string teamName, string documentTypeName, string seasonName, IReadOnlyList<(string PlayerName, int? Dorsal, string Status)> rows)
```
building a simple one-page QuestPDF document: header (team, document type, season, generated-at
`DateTime.UtcNow`), then one row per player (name, dorsal, status — translate status to Spanish:
Pending→"Pendiente", Delivered→"Entregado", Approved→"Aprobado", Rejected→"Rechazado", matching the
Spanish-first convention used everywhere else in this backend's user-facing strings). Register it
in DI (`Program.cs`/`ServiceCollectionExtensions.cs` — find where `SeasonPrepPdfGenerator` is
registered and add this one the same way, same lifetime).

Run the test — green.

### 6.3 `ExportPlayerDocumentsReport` — Red then Green

Create `tests/RFFM.Api.Tests/UnitTests/ExportPlayerDocumentsReportTests.cs`: handler test asserting
the returned `ExportPdfResult.ContentType == "application/pdf"` and non-empty `Bytes`, given a
small roster/documents fixture in the Postgres fixture.

Create `src/RFFM.Api/Features/Coaches/PlayerDocuments/ExportPlayerDocumentsReport.cs`:
```csharp
app.MapGet("/api/catalog/team/{teamId}/documents/report",
        [Authorize(Roles = "Coach,Administrator")]
        async (string teamId, string documentTypeId, IMediator mediator, CancellationToken ct) =>
        {
            var result = await mediator.Send(new ExportPlayerDocumentsReportQuery(teamId, documentTypeId), ct);
            return result is null
                ? Results.NotFound()
                : Results.File(result.Bytes, result.ContentType, result.FileName);
        })
```
The handler: loads the `Team` (404 if missing) with `.Include(t => t.Season)`, reuses
`GetTeamPlayerDocumentsStatus.Handler`'s query logic (either by calling
`mediator.Send(new TeamPlayerDocumentsStatusQuery(...))` internally — simplest, avoids duplicating
the join — or by extracting a shared private static method both handlers call; sending a nested
Mediator request from within another handler is an accepted pattern in this codebase, e.g.
`SeasonPrepExportPdf.cs`'s handler already does `_mediator.Send(new GetSportEventItem.SportEventItemQuery {...})`
internally — mirror that), then calls `PlayerDocumentsReportPdfGenerator.GeneratePdf(...)` with
the team's name, the `DocumentType.Name` (load it, 404 `DocumentTypeNotFound` if missing), and
`team.Season.Name`.

`ExportPdfResult` record: reuse the exact same shape as `Features/Coaches/SeasonPrep/SeasonPrepExportPdf.cs`'s
`ExportPdfResult(byte[] Bytes, string FileName, string ContentType)` — either reference that
existing record directly (it's `public`, in a different namespace — add a `using` and reuse it
rather than redeclaring an identical record) or declare a local one if reuse feels awkward across
features; prefer reuse if it compiles cleanly without dragging in unrelated `SeasonPrep` coupling.

Filename: `$"Documentos_{documentType.Name}_{team.Season.Name}_{DateTime.UtcNow:yyyyMMdd}.pdf"` —
sanitize spaces/special characters if needed for a valid filename (check if `SeasonPrepExportPdf.cs`
already does any filename sanitization you should mirror; if not, a simple
`.Replace(" ", "_")` on the interpolated parts is enough, don't over-engineer this).

Run the tests from 6.2+6.3 — green.

## 7. `ReviewPlayerDocument` — Red then Green

### 7.1 Red
Create `tests/RFFM.Api.Tests/UnitTests/ReviewPlayerDocumentTests.cs` (Postgres fixture):
1. Approve a `Delivered` document → `200`, response `status: "Approved"`, `reviewedAt` set.
2. Reject a `Delivered` document with a note → `200`, `status: "Rejected"`, `reviewNote` matches.
3. Review a `teamPlayerId`/`documentTypeId` pair with no row → `404` `PlayerDocumentNotFound`.
4. Review an already-`Approved` document again → `409` `PlayerDocumentNotDelivered`, status
   unchanged.
5. `Player`/`FamilyMember` role attempting to call this route → `403` (covered by the
   `[Authorize(Roles = "Coach,Administrator")]` attribute itself — if you can get ASP.NET Core's
   authorization middleware exercised in your test harness; otherwise this is acceptable to leave
   as attribute-only enforcement without a dedicated unit test, since role-based `[Authorize]` is
   framework behavior already exercised by many other sibling endpoints' own test suites — don't
   invent new test infrastructure just for this one attribute if none already exists for testing
   `[Authorize(Roles=...)]` directly at the unit level in this repo).

### 7.2 Green
Create `src/RFFM.Api/Features/Coaches/PlayerDocuments/ReviewPlayerDocument.cs` as an `ICommand<T>`
(this one has no ownership branching — Coach/Administrator-only, straightforward):
```csharp
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.PlayerDocuments
{
    public class ReviewPlayerDocument : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPatch("/api/catalog/teamplayer/{teamPlayerId}/documents/{documentTypeId}/review",
                    [Authorize(Roles = "Coach,Administrator")]
                    async (string teamPlayerId, string documentTypeId, ReviewPlayerDocumentRequest request,
                        IMediator mediator, CancellationToken ct) =>
                        await mediator.Send(new ReviewPlayerDocumentCommand(teamPlayerId, documentTypeId, request.Approve, request.Note), ct))
                .WithName(nameof(ReviewPlayerDocument))
                .WithTags("PlayerDocuments")
                .Produces<GetPlayerDocuments.PlayerDocumentResponse>()
                .RequireAuthorization();
        }

        public record ReviewPlayerDocumentRequest(bool Approve, string? Note);

        public record ReviewPlayerDocumentCommand(string TeamPlayerId, string DocumentTypeId, bool Approve, string? Note)
            : ICommand<GetPlayerDocuments.PlayerDocumentResponse>;

        public class Handler(AppDbContext db, ICurrentUserService currentUser)
            : IRequestHandler<ReviewPlayerDocumentCommand, GetPlayerDocuments.PlayerDocumentResponse>
        {
            public async ValueTask<GetPlayerDocuments.PlayerDocumentResponse> Handle(
                ReviewPlayerDocumentCommand request, CancellationToken cancellationToken)
            {
                var doc = await db.PlayerDocuments
                    .FirstOrDefaultAsync(d => d.TeamPlayerId == request.TeamPlayerId && d.DocumentTypeId == request.DocumentTypeId, cancellationToken);

                if (doc is null)
                    throw new NotFoundException("PlayerDocument", ErrorCodes.PlayerDocumentNotFound);

                try
                {
                    if (request.Approve) doc.Approve(currentUser.UserId!, request.Note);
                    else doc.Reject(currentUser.UserId!, request.Note);
                }
                catch (InvalidOperationException)
                {
                    throw new ConflictException("PlayerDocument", ErrorCodes.PlayerDocumentNotDelivered);
                }

                await db.SaveChangesAsync(cancellationToken);

                var documentType = await db.DocumentTypes.AsNoTracking().FirstAsync(d => d.Id == request.DocumentTypeId, cancellationToken);

                return new GetPlayerDocuments.PlayerDocumentResponse(
                    doc.DocumentTypeId, documentType.Name, doc.TeamPlayerId, doc.Status.Name,
                    doc.FileName, doc.StorageUrl, doc.ContentType, doc.UploadedAt, doc.UploadedOnBehalf,
                    doc.ReviewedAt, doc.ReviewNote);
            }
        }
    }
}
```
**Check first**: do `RFFM.Api.Domain.NotFoundException`/`RFFM.Api.Domain.ConflictException`
actually exist with constructors taking `(string, string errorCode)`? They're referenced in
`ServiceCollectionExtensions.cs`'s exception-to-ProblemDetails mapping (`setup.Map<...NotFoundException>`,
`setup.Map<...ConflictException>`) — open `Domain/NotFoundException.cs`/`Domain/ConflictException.cs`
(or wherever they live) to confirm the exact constructor signature before writing this, and adjust
the `throw` calls above to match reality. If they don't carry an error-code parameter the way
`DomainException` does, find whatever mechanism the existing mapping uses to surface a `code`
extension for `NotFoundException`/`ConflictException` specifically (read the mapping lambdas at
`ServiceCollectionExtensions.cs` lines ~209-224 in full) and match that exactly — do not guess.

Run the tests from 7.1 — green.

## 8. FeaturePermission seeding

### 8.1 Red
Read `tests/RFFM.Api.Tests/UnitTests/FeaturePermissionsSeedParityTests.cs` in full first (it
already exists — do not break it). Add new test methods to that same file (or a new sibling file
`PlayerDocumentsFeaturePermissionSeedTests.cs` if you prefer a dedicated file — either is fine,
pick based on which reads more naturally once you've read the existing file):
1. `SeedPermissionsAsync` gives both `"Player"` and `"FamilyMember"` a row for
   `"/coach/my-documents"`.
2. `SeedPermissionsAsync` gives both `"Coach"` and `"ClubDirector"` a row for
   `"/coach/player-documents"`.
3. `SeedPermissionsAsync` does NOT give `"Player"` or `"FamilyMember"` a row for
   `"/coach/player-documents"`.

Run — fails (routes/entries don't exist yet).

### 8.2 Green
Edit `src/RFFM.Api/Domain/Entities/CoachFeatureRoutes.cs`, add under the "Allowed for Player"
section:
```csharp
public const string MyDocuments = "/coach/my-documents";
```
and under "Blocked for Player":
```csharp
public const string PlayerDocuments = "/coach/player-documents";
```

Edit `src/RFFM.Host/DependencyInjection/WebApplicationExtensions.cs`'s `entries` array inside
`SeedFeaturePermissionsAsync` (find the array literal, add these four lines near the other
role-specific blocks, grouped with a comment):
```csharp
// PlayerDocuments (openspec change player-document-authorizations): self-service "my own
// player" page for Player/FamilyMember; team-wide tracking page for Coach/ClubDirector. The
// two routes are intentionally NOT cross-seeded (MyDocuments is not for Coach/ClubDirector,
// PlayerDocuments is not for Player/FamilyMember).
("MyDocuments", CoachFeatureRoutes.MyDocuments, "Player", 3, false),
("MyDocuments", CoachFeatureRoutes.MyDocuments, "FamilyMember", 3, false),

("PlayerDocuments", CoachFeatureRoutes.PlayerDocuments, "Coach", 3, false),
("PlayerDocuments", CoachFeatureRoutes.PlayerDocuments, "ClubDirector", 3, false),
```
Run the tests from 8.1 — green.

### 8.3 Manual verification
Start the app (`dotnet run --project src/RFFM.Host`), authenticate as a `Player` and a `Coach`
(however you normally do this locally — check `README`/`AGENTS.md` for a documented way, or use an
existing test user), call `GET /api/permissions/me` for each, and confirm the new entries
appear/don't appear as expected. Note in your final report whether you did this live or only via
the automated test (a plain `dotnet ef database update` does NOT run this seeder — only app
startup does).

## 9. Expose `TeamPlayerId` on `MyProfile`

### 9.1 Red
Create/extend a test file for `GetMyProfile` (search `tests/` first for an existing
`GetMyProfileTests`/`GetMyProfileHandlerTests` — extend it if found, create
`tests/RFFM.Api.Tests/UnitTests/GetMyProfileHandlerTests.cs` if not), covering (Postgres fixture):
1. A `UserProfile` with `TeamId` set, and a matching `UserTeam` row with `LinkedTeamPlayerId` set
   → `MyProfileResponse.TeamPlayerId` equals that `LinkedTeamPlayerId`.
2. A `UserProfile` with `TeamId` set but NO matching `UserTeam` row → `TeamPlayerId` is `null`, no
   exception thrown.
3. A `UserProfile` with `TeamId == null` (e.g. Coach who hasn't selected a team, or any role
   without a team association) → `TeamPlayerId` is `null`, and the lookup is skipped (assert via a
   scenario where a `UserTeam` row happens to exist for the same user under some OTHER team, to
   prove it isn't accidentally matched — pick a fixture that makes this observable, or simplest:
   just don't create any `UserTeam` row at all for this case and confirm no exception/null result).

Run — fails (field doesn't exist).

### 9.2 Green
Edit `src/RFFM.Api/Features/Coaches/Users/Queries/GetMyProfile.cs`:
```csharp
public record MyProfileResponse(string RoleName, string? PlayerId, string? TeamId, string? TeamPlayerId);
```
and in `GetMyProfileHandler.Handle`, after resolving `profile`:
```csharp
string? teamPlayerId = null;
if (profile.TeamId is not null)
{
    var userTeam = await _db.Set<RFFM.Api.Domain.Aggregates.UserClubs.UserTeam>().AsNoTracking()
        .FirstOrDefaultAsync(ut => ut.ApplicationUserId == request.UserId && ut.TeamId == profile.TeamId, cancellationToken);
    teamPlayerId = userTeam?.LinkedTeamPlayerId;
}

return new MyProfileResponse(profile.RoleName, profile.PlayerId, profile.TeamId, teamPlayerId);
```
Run the tests from 9.1 — green.

### 9.3 Regression check
`dotnet build` — confirm no other file constructs `MyProfileResponse` positionally in a way that
now breaks (the added parameter is at the end, so existing 3-arg call sites will fail to compile —
search for `new MyProfileResponse(` across the codebase and update every call site, or convert the
constructor call in the handler to named-parameter style if that's cleaner; there should only be
one production call site, inside this same handler, which you already updated above — but check
for test fixtures/builders elsewhere that might also construct this record directly).

## 10. Full verification

1. `dotnet build` from `Back/ExtractionApi` — must be clean, zero warnings you introduced.
2. `dotnet test` — full suite, 100% pass, zero skipped. Specifically re-run
   `FeaturePermissionsSeedParityTests` in full (not just your new methods) to confirm you didn't
   break the FamilyMember/Player parity assertion it already makes.
3. Check coverage of your new code specifically meets the targets stated at the top of this file
   (≥85% domain, ≥80% handlers) — if this repo has a coverage-report command
   (`dotnet test --collect:"XPlat Code Coverage"` or similar, check for a `coverlet` package
   reference or CI script), run it and report the numbers for the new files; if no coverage
   tooling exists in this repo, state that explicitly in your report instead of fabricating a
   number.
4. Manually smoke-test via `dotnet run --project src/RFFM.Host` (or confirm via integration tests
   if you'd rather not run the app manually):
   - `GET /api/catalog/document-types` returns the seeded "Autorización para realizar físico fuera
     de las instalaciones" type.
   - One self-service upload (as `Player`/`FamilyMember`) → coach approve round trip.
   - One coach-on-behalf upload → reject (with note) → re-upload → approve round trip.
   - One `GET /api/catalog/team/{teamId}/documents` call and one PDF report download — confirm the
     PDF opens/has plausible content (or at minimum starts with `%PDF` magic bytes).
   - `GET /api/permissions/me` and `GET /api/users/me/profile` checks from sections 8.3/9.1.
5. Re-read `design.md`'s "API Contract" section (as corrected — no `seasonId` on the two
   team-scoped endpoints) against what you actually built; note any deviation in your report.
6. Open `openspec/changes/player-document-authorizations/tasks.md` and mark every checkbox `[x]`
   across all 10 sections as you complete the corresponding work (do this incrementally as you go,
   not all at the end).
7. From the repo root, run `openspec validate player-document-authorizations --strict` — must
   report no errors.

## Do not do

- Do not touch `Front/` or `Mobile/`.
- Do not add a `seasonId` parameter to `GET /api/catalog/team/{teamId}/documents` or its `/report`
  sibling — `teamId` already fixes the season (design.md Decision 7, corrected). If you find
  yourself wanting one, stop — you've likely misread the roster-resolution logic.
- Do not add `Rename`/`Activate`/`Deactivate` methods to `DocumentType` — no endpoint in this
  change calls them (YAGNI, Non-Goal #3).
- Do not add a `DocumentType` admin CRUD endpoint.
- Do not add a second seeded `DocumentType` row.
- Do not introduce `IRequireFeaturePermission` on any of the six new API endpoints — role gating
  here is plain `[Authorize(Roles = "...")]` plus the bespoke ownership check, matching
  `UpdateTeamPlayer.cs`/`SetTeamInjuryProtocol.cs`. `IRequireFeaturePermission`/`FeaturePermission`
  seeding (section 8) is a *separate* concern — it gates the *frontend pages*, not these APIs.
  Do not conflate the two.
- Do not use FluentAssertions in tests — plain xUnit `Assert`, matching this repo's actual
  convention (verified against `TeamInjuryProtocolAttachmentTests.cs`/`GetMyPermissionsHandlerTests.cs`).
- Do not mock `AppDbContext` — use the real `PostgresContainerFixture` for anything touching it.
- Do not use `Guid.NewGuid()` inside the EF migration's seed SQL — use the fixed literal GUID
  given in section 2.3.
- Do not leave any `[Fact(Skip = "...")]` in the final suite.

## Final report format

List: files created, files modified (one-line reason each), full `dotnet test` result summary
(pass count, 0 failed, 0 skipped), `dotnet build` result, coverage numbers if tooling exists,
`openspec validate` result, and every deviation/judgment call you made that wasn't explicitly
spelled out above (e.g. exact `NotFoundException`/`ConflictException` constructor shapes you found,
whether `Results.ValidationProblem` could carry a `code` extension or you had to use
`Results.Problem` instead, how you tested the inline ownership-branching delegates, whether you
reused `SeasonPrepExportPdf.cs`'s `ExportPdfResult` record or declared a local one).
