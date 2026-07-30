applied change: news-feature (BACKEND SCOPE ONLY)
```

# implement.md — news-feature (Backend)

Scope: `Back/ExtractionApi/` ONLY. Do not touch `Front/` or `Mobile/`. This script covers
tasks 1–11 of `openspec/changes/news-feature/tasks.md`. Mobile tasks (12–17) are a separate
follow-up owned by mobile-specialist and are NOT part of this run.

Authoritative contract: `openspec/changes/news-feature/design.md` § API Contract, and
`openspec/changes/news-feature/specs/news/spec.md` (ADDED Requirements — every scenario there
must be green via a test before this change is considered done).

## Deviation from design.md Decision 1 (read this first)

`design.md` Decision 1 says commands/queries implement `IRequireFeaturePermission` "following
`Features/Coaches/Trainings/Exercises/`". **Do NOT do this for News.** Investigation found:

- `IRequireFeaturePermission` (`RFFM.Api.Common.IRequireFeaturePermission`) is enforced by
  `FeaturePermissionBehavior`, which checks the `FeaturePermissions` DB table for a
  `(FeatureRoute, Role)` row with sufficient `PermissionType` (Read/Write/ReadWrite).
- The existing seed data in `WebApplicationExtensions.cs` already grants
  `CoachFeatureRoutes.News` ReadWrite (permission level 3) to **both** `Coach` **and**
  `ClubDirector`, plus Read (level 1) to `Player` and `FamilyMember`.
- `specs/news/spec.md`'s ADDED Requirements are explicit and testable: writes (create,
  update, publish, delete, image upload) are restricted to **Coach and Administrator only**
  — `ClubDirector` is never mentioned as allowed, and the scenarios assert `403 Forbidden`
  for FamilyMember/Player. Using `IRequireFeaturePermission` would incorrectly grant
  `ClubDirector` write access and contradicts the literal, testable spec.

**Use plain ASP.NET role authorization instead** — `[Authorize(Roles = "Coach,Administrator")]`
on the Minimal API route delegate, exactly mirroring
`Features/Coaches/Players/Commands/SetPlayerSanction.cs` and
`Features/Coaches/SeasonAccess/*.cs`. Read endpoints (published list, detail) stay open to any
authenticated role via `.RequireAuthorization()` with no `Roles` restriction. This is also
literally what design.md's own "API Contract" table says in its Auth column ("Any authenticated
role" / "Coach,Administrator") — the table is authoritative over Decision 1's prose.

Still use the **standard Mediator vertical slice** (`ICommand`/`IQueryApp`, FluentValidation
validator, handler) as Decision 1 correctly specifies — just not `IRequireFeaturePermission`.

## New infrastructure needed: 404 and 409 exception mappings

Checked `AddCustomProblemDetails()` in
`Back/ExtractionApi/src/RFFM.Api/DependencyInjection/ServiceCollectionExtensions.cs` (~line 159):
today it maps `DomainException`→400, `UnauthorizedAccessException`→401,
`ForbiddenAccessException`→403, several token exceptions→401, `InvalidOperationException`→500,
validation exceptions→400, and a catch-all `Exception`→500. **There is no exception type mapped
to 404 or 409 anywhere in the codebase.** Existing sibling features that claim to return 404
(e.g. `DeleteExercise`, `UpdateExercise`) actually throw `DomainException`, which resolves to
400, not 404 — this is a pre-existing inconsistency, not a pattern to copy. `spec.md`'s scenarios
require literal `404 Not Found` and `409 Conflict` status codes (asserted via
`HttpStatusCode.NotFound` / would need `409` for publish-already-published), so two small new
exception types + mappings are required. Add them:

**File: `Back/ExtractionApi/src/RFFM.Api/Domain/NotFoundException.cs`** (new)
```csharp
namespace RFFM.Api.Domain
{
    public class NotFoundException : Exception
    {
        public string Code { get; }

        public NotFoundException(string message, string code) : base(message)
        {
            Code = code;
        }
    }
}
```

**File: `Back/ExtractionApi/src/RFFM.Api/Domain/ConflictException.cs`** (new)
```csharp
namespace RFFM.Api.Domain
{
    public class ConflictException : Exception
    {
        public string Code { get; }

        public ConflictException(string message, string code) : base(message)
        {
            Code = code;
        }
    }
}
```

**Edit `ServiceCollectionExtensions.cs`**: inside `AddCustomProblemDetails()`, right after the
existing `setup.Map<RFFM.Api.Domain.ForbiddenAccessException>(...)` block, insert:
```csharp
                setup.Map<RFFM.Api.Domain.NotFoundException>(exception =>
                    new StatusCodeProblemDetails(StatusCodes.Status404NotFound)
                    {
                        Title = "No encontrado",
                        Detail = exception.Message,
                        Extensions = { ["code"] = exception.Code }
                    });

                setup.Map<RFFM.Api.Domain.ConflictException>(exception =>
                    new StatusCodeProblemDetails(StatusCodes.Status409Conflict)
                    {
                        Title = "Conflicto",
                        Detail = exception.Message,
                        Extensions = { ["code"] = exception.Code }
                    });
```

**Edit `Back/ExtractionApi/src/RFFM.Api/Domain/ErrorCodes.cs`**: add a new section at the end,
before the closing brace of the class:
```csharp
        // News (Features/Coaches/News)
        public const string NewsNotFound = "NewsNotFound";
        public const string NewsAlreadyPublished = "NewsAlreadyPublished";
```

## 1. Domain

**File: `Back/ExtractionApi/src/RFFM.Api/Domain/Entities/News/NewsStatus.cs`** (new directory + file)
Mirror `Domain/Entities/TeamPlayers/SanctionCategory.cs` exactly in shape:
```csharp
using Ardalis.SmartEnum;

namespace RFFM.Api.Domain.Entities.News
{
    public sealed class NewsStatus : SmartEnum<NewsStatus>
    {
        public static readonly NewsStatus Draft = new(nameof(Draft), 1);
        public static readonly NewsStatus Published = new(nameof(Published), 2);

        private NewsStatus(string name, int value) : base(name, value)
        {
        }

        public static bool TryParseName(string? name, out NewsStatus? status)
        {
            status = null;
            if (string.IsNullOrWhiteSpace(name))
                return false;

            foreach (var candidate in List)
            {
                if (string.Equals(candidate.Name, name, System.StringComparison.OrdinalIgnoreCase))
                {
                    status = candidate;
                    return true;
                }
            }

            return false;
        }
    }
}
```

**File: `Back/ExtractionApi/src/RFFM.Api/Domain/Entities/News/NewsItem.cs`** (new)
`BaseEntity` gives `Id`; add `Title`, `Subtitle`, `Body`, `CoverImageUrl`, `Status`,
`PublishedAt` (nullable), `CreatedAt`, `UpdatedAt`. Private setters, static `Create(...)`
factory, intention-revealing `UpdateContent(...)` and `Publish()` methods (no public setters —
mirrors `TeamPlayerSanction.cs`):
```csharp
namespace RFFM.Api.Domain.Entities.News
{
    public class NewsItem : BaseEntity
    {
        public string Title { get; private set; } = null!;
        public string Subtitle { get; private set; } = null!;
        public string Body { get; private set; } = null!;
        public string CoverImageUrl { get; private set; } = null!;
        public NewsStatus Status { get; private set; } = null!;
        public DateTime? PublishedAt { get; private set; }
        public DateTime CreatedAt { get; private set; }
        public DateTime UpdatedAt { get; private set; }

        private NewsItem() { }

        public static NewsItem Create(string title, string subtitle, string body, string coverImageUrl, NewsStatus status)
        {
            if (string.IsNullOrWhiteSpace(title))
                throw new ArgumentException("El título es obligatorio.");
            if (string.IsNullOrWhiteSpace(subtitle))
                throw new ArgumentException("La entradilla es obligatoria.");
            if (string.IsNullOrWhiteSpace(body))
                throw new ArgumentException("El cuerpo es obligatorio.");
            if (string.IsNullOrWhiteSpace(coverImageUrl))
                throw new ArgumentException("La foto de portada es obligatoria.");
            if (status is null)
                throw new ArgumentException("El estado es obligatorio.");

            var now = DateTime.UtcNow;
            return new NewsItem
            {
                Title = title.Trim(),
                Subtitle = subtitle.Trim(),
                Body = body,
                CoverImageUrl = coverImageUrl,
                Status = status,
                PublishedAt = status == NewsStatus.Published ? now : null,
                CreatedAt = now,
                UpdatedAt = now
            };
        }

        public void UpdateContent(string title, string subtitle, string body, string coverImageUrl)
        {
            if (string.IsNullOrWhiteSpace(title))
                throw new ArgumentException("El título es obligatorio.");
            if (string.IsNullOrWhiteSpace(subtitle))
                throw new ArgumentException("La entradilla es obligatoria.");
            if (string.IsNullOrWhiteSpace(body))
                throw new ArgumentException("El cuerpo es obligatorio.");
            if (string.IsNullOrWhiteSpace(coverImageUrl))
                throw new ArgumentException("La foto de portada es obligatoria.");

            Title = title.Trim();
            Subtitle = subtitle.Trim();
            Body = body;
            CoverImageUrl = coverImageUrl;
            UpdatedAt = DateTime.UtcNow;
        }

        public void Publish()
        {
            if (Status == NewsStatus.Published)
                throw new RFFM.Api.Domain.ConflictException("La noticia ya está publicada.", RFFM.Api.Domain.ErrorCodes.NewsAlreadyPublished);

            Status = NewsStatus.Published;
            PublishedAt = DateTime.UtcNow;
            UpdatedAt = DateTime.UtcNow;
        }
    }
}
```

Write domain unit-test-style coverage for `NewsItem`/`NewsStatus` as part of the handler test
files below (no separate pure-domain test project exists here — `RFFM.Api.Tests` covers both,
per the `CreateExerciseHandlerTests` precedent which exercises the entity through the handler).

## 2. Persistence

**File: `Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/Configuration/Entities/NewsItemEntityConfiguration.cs`** (new)
Mirror `TeamPlayerSanctionEntityConfiguration.cs`:
```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities.News;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Entities
{
    internal class NewsItemEntityConfiguration : IEntityTypeConfiguration<NewsItem>
    {
        public void Configure(EntityTypeBuilder<NewsItem> builder)
        {
            builder.ToTable("News");

            builder.HasKey(n => n.Id);

            builder.Property(n => n.Title).HasMaxLength(200).IsRequired();
            builder.Property(n => n.Subtitle).HasMaxLength(300).IsRequired();
            builder.Property(n => n.Body).IsRequired();
            builder.Property(n => n.CoverImageUrl).HasMaxLength(2000).IsRequired();
            builder.Property(n => n.Status).IsRequired();
            builder.Property(n => n.PublishedAt).IsRequired(false);
            builder.Property(n => n.CreatedAt).IsRequired();
            builder.Property(n => n.UpdatedAt).IsRequired();

            builder.HasIndex(n => new { n.Status, n.PublishedAt });
        }
    }
}
```
This class is discovered automatically via reflection (`ApplyConfigurationsFromAssembly` /
equivalent already wired in `AppDbContext`) — do not register it manually anywhere.

**Edit `Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/AppDbContext.cs`**:
- Add `using RFFM.Api.Domain.Entities.News;` near the other `using RFFM.Api.Domain.Entities.*;` lines.
- Add `public DbSet<NewsItem> News { get; set; }` grouped near the other feature-area `DbSet`s
  (e.g. right after `EssentialSkills`).

**Migration**: from `Back/ExtractionApi/`, run:
```
.\manage-migrations.ps1 -Action create -MigrationName AddNews -Context AppDbContext
```
Verify the generated migration creates table `News` in schema `app` with the columns/index
above, and that `dotnet build` succeeds afterward. This is an additive-only migration.

## 3. Feature files — `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/News/`

Create the directory. All files share namespace `RFFM.Api.Features.Coaches.News`.

**File: `NewsConstants.cs`** (new — mirrors `PlayerConstants.cs` / `TrainingConstants.cs`)
```csharp
namespace RFFM.Api.Features.Coaches.News
{
    public static class NewsConstants
    {
        public const string NewsFeature = "News";
        public const string ImagesContainerName = "newsimages";
        public const string PublishedListCachePrefix = "news:published:";
    }
}
```

**File: `GetNews.cs`** — `GET /api/coach/news?pageNumber=&pageSize=`. Published-only, open to
any authenticated role, cached. This file ALSO defines `NewsSummaryResponse` and
`NewsDetailResponse` (shared DTOs reused by `GetNewsDrafts.cs`, `GetNewsById.cs`,
`PublishNews.cs` — same pattern as `GetExercises.cs` defining `ExerciseListItem`, reused by
`GetExerciseById.cs`).
```csharp
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.Domain.Entities.News;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.News
{
    /// <summary>
    /// GET /api/coach/news?pageNumber=&amp;pageSize= — published-only, sorted PublishedAt DESC,
    /// open to any authenticated role. Cached (never contains drafts, so caching is safe across
    /// all roles).
    /// </summary>
    public class GetNews : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/coach/news",
                    async (int pageNumber, int pageSize, IMediator mediator, CancellationToken ct) =>
                    {
                        var result = await mediator.Send(new GetNewsQuery(pageNumber, pageSize), ct);
                        return Results.Ok(result);
                    })
                .WithName(nameof(GetNews))
                .WithTags(NewsConstants.NewsFeature)
                .RequireAuthorization()
                .Produces<NewsSummaryResponse[]>();
        }
    }

    public record GetNewsQuery(int PageNumber, int PageSize) : IQueryApp<NewsSummaryResponse[]>, ICacheRequest
    {
        public string CacheKey => $"{NewsConstants.PublishedListCachePrefix}{PageNumber}:{PageSize}";
        public DateTime? AbsoluteExpirationRelativeToNow => null;
    }

    public class GetNewsHandler : IRequestHandler<GetNewsQuery, NewsSummaryResponse[]>
    {
        private readonly AppDbContext _db;
        private readonly IHttpContextAccessor _httpContextAccessor;

        public GetNewsHandler(AppDbContext db, IHttpContextAccessor httpContextAccessor)
        {
            _db = db;
            _httpContextAccessor = httpContextAccessor;
        }

        public async ValueTask<NewsSummaryResponse[]> Handle(GetNewsQuery request, CancellationToken ct = default)
        {
            var query = _db.News.AsNoTracking().Where(n => n.Status == NewsStatus.Published);

            var total = await query.CountAsync(ct);
            try
            {
                _httpContextAccessor.HttpContext!.Response.Headers["X-Total-Count"] = total.ToString();
            }
            catch
            {
                // ignore if no http context available (e.g. unit tests calling the handler directly)
            }

            var items = await query
                .OrderByDescending(n => n.PublishedAt)
                .Skip((request.PageNumber - 1) * request.PageSize)
                .Take(request.PageSize)
                .Select(n => new NewsSummaryResponse(n.Id, n.Title, n.Subtitle, n.CoverImageUrl, n.Status.Name, n.PublishedAt))
                .ToArrayAsync(ct);

            return items;
        }
    }

    public record NewsSummaryResponse(string Id, string Title, string Subtitle, string CoverImageUrl, string Status, DateTime? PublishedAt);

    public record NewsDetailResponse(
        string Id, string Title, string Subtitle, string Body, string CoverImageUrl,
        string Status, DateTime? PublishedAt, DateTime CreatedAt, DateTime UpdatedAt);
}
```

**File: `GetNewsDrafts.cs`** — `GET /api/coach/news/drafts?pageNumber=&pageSize=`. Draft-only,
`Coach,Administrator` only, NOT cached (design.md Decision 4).
```csharp
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain.Entities.News;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.News
{
    public class GetNewsDrafts : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/coach/news/drafts",
                    [Authorize(Roles = "Coach,Administrator")]
                    async (int pageNumber, int pageSize, IMediator mediator, CancellationToken ct) =>
                    {
                        var result = await mediator.Send(new GetNewsDraftsQuery(pageNumber, pageSize), ct);
                        return Results.Ok(result);
                    })
                .WithName(nameof(GetNewsDrafts))
                .WithTags(NewsConstants.NewsFeature)
                .RequireAuthorization()
                .Produces<NewsSummaryResponse[]>();
        }
    }

    public record GetNewsDraftsQuery(int PageNumber, int PageSize) : IQueryApp<NewsSummaryResponse[]>;

    public class GetNewsDraftsHandler : IRequestHandler<GetNewsDraftsQuery, NewsSummaryResponse[]>
    {
        private readonly AppDbContext _db;
        private readonly IHttpContextAccessor _httpContextAccessor;

        public GetNewsDraftsHandler(AppDbContext db, IHttpContextAccessor httpContextAccessor)
        {
            _db = db;
            _httpContextAccessor = httpContextAccessor;
        }

        public async ValueTask<NewsSummaryResponse[]> Handle(GetNewsDraftsQuery request, CancellationToken ct = default)
        {
            var query = _db.News.AsNoTracking().Where(n => n.Status == NewsStatus.Draft);

            var total = await query.CountAsync(ct);
            try
            {
                _httpContextAccessor.HttpContext!.Response.Headers["X-Total-Count"] = total.ToString();
            }
            catch
            {
                // ignore if no http context available
            }

            var items = await query
                .OrderByDescending(n => n.CreatedAt)
                .Skip((request.PageNumber - 1) * request.PageSize)
                .Take(request.PageSize)
                .Select(n => new NewsSummaryResponse(n.Id, n.Title, n.Subtitle, n.CoverImageUrl, n.Status.Name, n.PublishedAt))
                .ToArrayAsync(ct);

            return items;
        }
    }
}
```

**File: `GetNewsById.cs`** — `GET /api/coach/news/{id}`. Single detail endpoint used for both
statuses (design.md Decision 3). Route stays open (`.RequireAuthorization()`, no `Roles`); the
HANDLER enforces visibility using `ICurrentUserService.Roles`, returning `null` for
"draft + caller lacks Coach/Administrator" so the endpoint 404s without revealing existence.
```csharp
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain.Entities.News;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.News
{
    public class GetNewsById : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/coach/news/{id}",
                    async (string id, IMediator mediator, CancellationToken ct) =>
                    {
                        var result = await mediator.Send(new GetNewsByIdQuery(id), ct);
                        return result is null ? Results.NotFound() : Results.Ok(result);
                    })
                .WithName(nameof(GetNewsById))
                .WithTags(NewsConstants.NewsFeature)
                .RequireAuthorization()
                .Produces<NewsDetailResponse>()
                .Produces(StatusCodes.Status404NotFound);
        }
    }

    public record GetNewsByIdQuery(string Id) : IQueryApp<NewsDetailResponse?>;

    public class GetNewsByIdHandler : IRequestHandler<GetNewsByIdQuery, NewsDetailResponse?>
    {
        private readonly AppDbContext _db;
        private readonly ICurrentUserService _currentUser;

        public GetNewsByIdHandler(AppDbContext db, ICurrentUserService currentUser)
        {
            _db = db;
            _currentUser = currentUser;
        }

        public async ValueTask<NewsDetailResponse?> Handle(GetNewsByIdQuery request, CancellationToken ct = default)
        {
            var news = await _db.News.AsNoTracking().FirstOrDefaultAsync(n => n.Id == request.Id, ct);
            if (news is null)
                return null;

            if (news.Status == NewsStatus.Draft)
            {
                var roles = _currentUser.Roles ?? Array.Empty<string>();
                var canSeeDraft = roles.Any(r =>
                    string.Equals(r, "Coach", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(r, "Administrator", StringComparison.OrdinalIgnoreCase));
                if (!canSeeDraft)
                    return null;
            }

            return new NewsDetailResponse(
                news.Id, news.Title, news.Subtitle, news.Body, news.CoverImageUrl,
                news.Status.Name, news.PublishedAt, news.CreatedAt, news.UpdatedAt);
        }
    }
}
```

**File: `UploadNewsImage.cs`** — `POST /api/coach/news/image`, `Coach,Administrator` only.
Mirrors `UploadPlayerPhoto.cs` exactly, plus the role restriction UploadPlayerPhoto is missing.
```csharp
using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Storage;

namespace RFFM.Api.Features.Coaches.News
{
    public class UploadNewsImage : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/coach/news/image",
                    [Authorize(Roles = "Coach,Administrator")]
                    async (IFormFile file, IMediator mediator, CancellationToken ct) =>
                    {
                        var result = await mediator.Send(new UploadNewsImageCommand { File = file }, ct);
                        return Results.Ok(result);
                    })
                .WithName(nameof(UploadNewsImage))
                .WithTags(NewsConstants.NewsFeature)
                .RequireAuthorization()
                .Produces(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .DisableAntiforgery();
        }
    }

    public class UploadNewsImageCommand : IRequest<UploadNewsImageResult>
    {
        public IFormFile File { get; set; } = null!;
    }

    public class UploadNewsImageResult
    {
        public string Url { get; set; } = null!;
    }

    public class UploadNewsImageHandler : IRequestHandler<UploadNewsImageCommand, UploadNewsImageResult>
    {
        private readonly IStorageService _storageService;

        public UploadNewsImageHandler(IStorageService storageService)
        {
            _storageService = storageService;
        }

        public async ValueTask<UploadNewsImageResult> Handle(UploadNewsImageCommand request, CancellationToken ct)
        {
            if (request.File == null || request.File.Length == 0)
                throw new ArgumentException("El archivo no es válido.");

            var fileName = Guid.NewGuid() + Path.GetExtension(request.File.FileName);
            var url = await _storageService.UploadAsync(NewsConstants.ImagesContainerName, fileName, request.File, ct);

            return new UploadNewsImageResult { Url = url };
        }
    }

    public class UploadNewsImageValidator : AbstractValidator<UploadNewsImageCommand>
    {
        public UploadNewsImageValidator()
        {
            RuleFor(r => r.File)
                .NotNull()
                .Must(file => file.Length > 0)
                .WithMessage("El archivo no puede estar vacío.");

            RuleFor(r => r.File.ContentType)
                .Must(contentType => contentType == "image/jpeg" || contentType == "image/png")
                .WithMessage("Solo se permiten archivos JPEG y PNG.");
        }
    }
}
```

**File: `CreateNews.cs`** — `POST /api/coach/news`, `Coach,Administrator` only. `201 Created`
with `{ id }`. Invalidates the published-list cache (in case the item is created directly as
Published).
```csharp
using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.Common;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.Domain.Entities.News;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.News
{
    public class CreateNews : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/coach/news",
                    [Authorize(Roles = "Coach,Administrator")]
                    async (CreateNewsCommand command, IMediator mediator, CancellationToken ct) =>
                    {
                        var id = await mediator.Send(command, ct);
                        return Results.Created($"/api/coach/news/{id}", new { id });
                    })
                .WithName(nameof(CreateNews))
                .WithTags(NewsConstants.NewsFeature)
                .RequireAuthorization()
                .Produces(StatusCodes.Status201Created)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest);
        }
    }

    public record CreateNewsCommand(string Title, string Subtitle, string Body, string CoverImageUrl, string Status)
        : ICommand<string>, IInvalidateCacheRequest
    {
        public string PrefixCacheKey => NewsConstants.PublishedListCachePrefix;
    }

    public class CreateNewsHandler : IRequestHandler<CreateNewsCommand, string>
    {
        private readonly AppDbContext _db;
        public CreateNewsHandler(AppDbContext db) => _db = db;

        public async ValueTask<string> Handle(CreateNewsCommand request, CancellationToken ct = default)
        {
            NewsStatus.TryParseName(request.Status, out var status);
            var news = NewsItem.Create(request.Title, request.Subtitle, request.Body, request.CoverImageUrl, status!);

            await _db.News.AddAsync(news, ct);
            await _db.SaveChangesAsync(ct);
            return news.Id;
        }
    }

    public class CreateNewsValidator : AbstractValidator<CreateNewsCommand>
    {
        public CreateNewsValidator()
        {
            RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
            RuleFor(x => x.Subtitle).NotEmpty().MaximumLength(300);
            RuleFor(x => x.Body).NotEmpty();
            RuleFor(x => x.CoverImageUrl).NotEmpty();
            RuleFor(x => x.Status)
                .Must(s => s is "Draft" or "Published")
                .WithMessage("Status must be Draft or Published.");
        }
    }
}
```
NOTE: `ICommand<T>` requires `T : class` — `string` satisfies this.

**File: `UpdateNews.cs`** — `PUT /api/coach/news/{id}`, `Coach,Administrator` only. `204 NoContent`,
`404 NotFound` (via the new `NotFoundException`) if missing. Never touches `Status`/`PublishedAt`.
```csharp
using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.Domain;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.News
{
    public class UpdateNews : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut("/api/coach/news/{id}",
                    [Authorize(Roles = "Coach,Administrator")]
                    async (string id, UpdateNewsCommand command, IMediator mediator, CancellationToken ct) =>
                    {
                        await mediator.Send(command with { Id = id }, ct);
                        return Results.NoContent();
                    })
                .WithName(nameof(UpdateNews))
                .WithTags(NewsConstants.NewsFeature)
                .RequireAuthorization()
                .Produces(StatusCodes.Status204NoContent)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest);
        }
    }

    public record UpdateNewsCommand(string Title, string Subtitle, string Body, string CoverImageUrl)
        : ICommand, IInvalidateCacheRequest
    {
        public string Id { get; init; } = string.Empty;
        public string PrefixCacheKey => NewsConstants.PublishedListCachePrefix;
    }

    public class UpdateNewsHandler : IRequestHandler<UpdateNewsCommand, Unit>
    {
        private readonly AppDbContext _db;
        public UpdateNewsHandler(AppDbContext db) => _db = db;

        public async ValueTask<Unit> Handle(UpdateNewsCommand request, CancellationToken ct = default)
        {
            var news = await _db.News.FirstOrDefaultAsync(n => n.Id == request.Id, ct);
            if (news is null)
                throw new NotFoundException("Noticia no encontrada.", ErrorCodes.NewsNotFound);

            news.UpdateContent(request.Title, request.Subtitle, request.Body, request.CoverImageUrl);
            await _db.SaveChangesAsync(ct);
            return Unit.Value;
        }
    }

    public class UpdateNewsValidator : AbstractValidator<UpdateNewsCommand>
    {
        public UpdateNewsValidator()
        {
            RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
            RuleFor(x => x.Subtitle).NotEmpty().MaximumLength(300);
            RuleFor(x => x.Body).NotEmpty();
            RuleFor(x => x.CoverImageUrl).NotEmpty();
        }
    }
}
```

**File: `PublishNews.cs`** — `POST /api/coach/news/{id}/publish`, `Coach,Administrator` only.
`200 OK` with `NewsDetailResponse`, `404` if missing, `409` if already Published (via
`NewsItem.Publish()`'s `ConflictException`).
```csharp
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.Domain;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.News
{
    public class PublishNews : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/coach/news/{id}/publish",
                    [Authorize(Roles = "Coach,Administrator")]
                    async (string id, IMediator mediator, CancellationToken ct) =>
                    {
                        var result = await mediator.Send(new PublishNewsCommand(id), ct);
                        return Results.Ok(result);
                    })
                .WithName(nameof(PublishNews))
                .WithTags(NewsConstants.NewsFeature)
                .RequireAuthorization()
                .Produces<NewsDetailResponse>()
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound)
                .Produces<ProblemDetails>(StatusCodes.Status409Conflict);
        }
    }

    public record PublishNewsCommand(string Id) : ICommand<NewsDetailResponse>, IInvalidateCacheRequest
    {
        public string PrefixCacheKey => NewsConstants.PublishedListCachePrefix;
    }

    public class PublishNewsHandler : IRequestHandler<PublishNewsCommand, NewsDetailResponse>
    {
        private readonly AppDbContext _db;
        public PublishNewsHandler(AppDbContext db) => _db = db;

        public async ValueTask<NewsDetailResponse> Handle(PublishNewsCommand request, CancellationToken ct = default)
        {
            var news = await _db.News.FirstOrDefaultAsync(n => n.Id == request.Id, ct);
            if (news is null)
                throw new NotFoundException("Noticia no encontrada.", ErrorCodes.NewsNotFound);

            news.Publish();
            await _db.SaveChangesAsync(ct);

            return new NewsDetailResponse(
                news.Id, news.Title, news.Subtitle, news.Body, news.CoverImageUrl,
                news.Status.Name, news.PublishedAt, news.CreatedAt, news.UpdatedAt);
        }
    }
}
```
No validator needed (no request body — `Id` comes from the route).

**File: `DeleteNews.cs`** — `DELETE /api/coach/news/{id}`, `Coach,Administrator` only. `204 NoContent`,
`404` if missing. Allowed on Draft and Published.
```csharp
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.Domain;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.News
{
    public class DeleteNews : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapDelete("/api/coach/news/{id}",
                    [Authorize(Roles = "Coach,Administrator")]
                    async (string id, IMediator mediator, CancellationToken ct) =>
                    {
                        await mediator.Send(new DeleteNewsCommand(id), ct);
                        return Results.NoContent();
                    })
                .WithName(nameof(DeleteNews))
                .WithTags(NewsConstants.NewsFeature)
                .RequireAuthorization()
                .Produces(StatusCodes.Status204NoContent)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound);
        }
    }

    public record DeleteNewsCommand(string Id) : ICommand, IInvalidateCacheRequest
    {
        public string PrefixCacheKey => NewsConstants.PublishedListCachePrefix;
    }

    public class DeleteNewsHandler : IRequestHandler<DeleteNewsCommand, Unit>
    {
        private readonly AppDbContext _db;
        public DeleteNewsHandler(AppDbContext db) => _db = db;

        public async ValueTask<Unit> Handle(DeleteNewsCommand request, CancellationToken ct = default)
        {
            var news = await _db.News.FirstOrDefaultAsync(n => n.Id == request.Id, ct);
            if (news is null)
                throw new NotFoundException("Noticia no encontrada.", ErrorCodes.NewsNotFound);

            _db.News.Remove(news);
            await _db.SaveChangesAsync(ct);
            return Unit.Value;
        }
    }
}
```

## 4. TDD — tests FIRST, then the implementation above

Write tests before (or interleaved with, committing to Red before Green for each) the feature
files. Follow `Back/ExtractionApi/tests/RFFM.Api.Tests/` conventions exactly:

- **Unit-style handler tests** (`tests/RFFM.Api.Tests/UnitTests/`), one file per handler,
  `[Collection(PostgresCollection.Name)]`, constructor takes `PostgresContainerFixture fixture`,
  use `_fixture.CreateDbContext()` for setup/handler/verify contexts (see
  `CreateExerciseHandlerTests.cs`). Cover:
  - `CreateNewsHandlerTests.cs`: Draft sets `PublishedAt = null`; Published sets `PublishedAt`
    to (approximately) now; persists all fields.
  - `UpdateNewsHandlerTests.cs`: updates fields on a Draft item and on a Published item without
    touching `Status`/`PublishedAt`; missing id throws `NotFoundException`.
  - `PublishNewsHandlerTests.cs`: Draft → Published sets `PublishedAt`; already-Published throws
    `ConflictException`; missing id throws `NotFoundException`.
  - `DeleteNewsHandlerTests.cs`: deletes a Draft; deletes a Published item; missing id throws
    `NotFoundException`.
  - `GetNewsHandlerTests.cs`: only Published items returned, ordered `PublishedAt DESC`, drafts
    never appear even when present in the DB; pagination (`Skip`/`Take`) works.
  - `GetNewsDraftsHandlerTests.cs`: only Draft items returned, ordered `CreatedAt DESC`.
  - `GetNewsByIdHandlerTests.cs`: Published item visible regardless of `ICurrentUserService`
    mock roles; Draft item returns non-null when mocked roles include `Coach` or
    `Administrator`; Draft item returns `null` when mocked roles are `FamilyMember`/`Player`/
    empty; unknown id returns `null`. Mock `ICurrentUserService` with Moq (`Mock<ICurrentUserService>`,
    `.Setup(x => x.Roles).Returns(new[] { "Coach" })`).
  - Validator tests (direct `new XValidator().ValidateAsync(command)` calls, no DB) for
    `CreateNewsValidator`/`UpdateNewsValidator`/`UploadNewsImageValidator`: required-field
    rejections, max-length rejections, invalid `Status` string rejection.

- **Integration/authorization tests** (`tests/RFFM.Api.Tests/IntegrationTests/`), new file
  `NewsEndpointAuthorizationTests.cs`, mirroring `SanctionEndpointAuthorizationTests.cs`'s
  `TestAuthHandler` (`X-Test-Role` header) + `StartHostAsync(IFeatureModule module)` host
  bootstrap pattern exactly (real Postgres TestServer, `[Collection(PostgresCollection.Name)]`).
  One `StartHostAsync` call per module under test (e.g. `new CreateNews()`, `new GetNews()`,
  etc.) since each module only registers its own route. Cover every scenario in
  `specs/news/spec.md`:
  - `POST /api/coach/news` with role `Player`/`FamilyMember` → 403; with `Coach` → 201; missing
    `coverImageUrl` → 400.
  - `PUT /api/coach/news/{id}` with disallowed role → 403; unknown id → 404 (via
    `NewsEndpointAuthorizationTests`, seed a news row directly via `db.News.Add(...)` + a
    `_fixture.CreateDbContext()` in a setup helper, similar to `CreateTeamPlayerAsync()` in the
    sanctions test).
  - `POST /api/coach/news/{id}/publish`: Draft → Published returns 200 with `PublishedAt` set;
    already-Published → 409.
  - `DELETE /api/coach/news/{id}` disallowed role → 403; Coach → 204.
  - `POST /api/coach/news/image` disallowed role → 403; missing file → 400 (send an empty
    multipart form).
  - `GET /api/coach/news` with role `FamilyMember` → 200, body contains only Published items
    (seed one Draft + one Published row first, assert the Draft's id is absent).
  - `GET /api/coach/news/drafts` with `FamilyMember`/`Player` → 403; with `Coach` → 200, only
    Draft items.
  - `GET /api/coach/news/{id}`: Published item + any role → 200; Draft item + `Coach` → 200;
    Draft item + `FamilyMember` → 404 (not 403 — assert this precisely, it is the core
    visibility contract); unknown id → 404.

Run `dotnet test` after each Red/Green cycle for the file you're working on; run the full
`dotnet test` suite once all News tests are in place.

## 5. Verification (must all be true before reporting done)

1. `dotnet build` from `Back/ExtractionApi/` — 0 errors, no new warnings.
2. `dotnet test` from `Back/ExtractionApi/` — full suite green, including every new News test,
   zero skipped tests.
3. Every scenario in `openspec/changes/news-feature/specs/news/spec.md` has a corresponding
   test that passes.
4. Confirm the actual shipped routes/DTOs match the design.md § API Contract table exactly:
   `GET /api/coach/news`, `GET /api/coach/news/drafts`, `GET /api/coach/news/{id}`,
   `POST /api/coach/news/image`, `POST /api/coach/news`, `PUT /api/coach/news/{id}`,
   `POST /api/coach/news/{id}/publish`, `DELETE /api/coach/news/{id}` — field names and casing
   (`"Draft"`/`"Published"`) exactly as documented.
5. Do not touch anything under `Front/` or `Mobile/`.
6. Do not create or update any git commit — leave the working tree as-is for the orchestrator
   to review and commit after explicit user confirmation (per `.claude/rules/git.md` §6.3).

Report back: every file created/modified (absolute paths), whether the `AddNews` migration was
generated and its exact filename/timestamp, and the full `dotnet build` / `dotnet test` output
summary (pass/fail counts).

---

# implement.md — news-feature (Mobile)

Scope: `Mobile/` ONLY. Do not touch `Front/` or `Back/`. Covers tasks 12–17 of
`openspec/changes/news-feature/tasks.md`. The backend section above is already implemented and
merged (working tree, not committed) — the real, live API contract is summarized below. Do not
re-derive it from `design.md`'s "API Contract" table without cross-checking against this section,
since `design.md` predates final shipped shape in a couple of minor ways (all reconciled here).

**Live API contract (confirmed against the shipped backend):**

- `GET /api/coach/news?pageNumber=&pageSize=` — any authenticated role → `200` `NewsSummaryResponse[]` + header `X-Total-Count`. Published-only, `PublishedAt DESC`.
- `GET /api/coach/news/drafts?pageNumber=&pageSize=` — `Coach,Administrator` only → `200` `NewsSummaryResponse[]` + `X-Total-Count`. Draft-only, `CreatedAt DESC`. `403` for other roles.
- `GET /api/coach/news/{id}` — any authenticated role → `200` `NewsDetailResponse`; `404` if missing OR draft and caller is not Coach/Administrator.
- `POST /api/coach/news/image` — `Coach,Administrator` only, `multipart/form-data` field `file` → `200` `{ "url": "string" }`.
- `POST /api/coach/news` — `Coach,Administrator` only, body `CreateNewsCommand` → `201` `{ "id": "string" }`.
- `PUT /api/coach/news/{id}` — `Coach,Administrator` only, body `UpdateNewsCommand` → `204`.
- `POST /api/coach/news/{id}/publish` — `Coach,Administrator` only → `200` `NewsDetailResponse`; `409` if already Published.
- `DELETE /api/coach/news/{id}` — `Coach,Administrator` only → `204`.

`NewsSummaryResponse`: `{ id, title, subtitle, coverImageUrl, status: "Draft"|"Published", publishedAt: string|null }`.
`NewsDetailResponse`: summary fields + `{ body, createdAt, updatedAt }`.
`CreateNewsCommand`: `{ title, subtitle, body, coverImageUrl, status: "Draft"|"Published" }`.
`UpdateNewsCommand`: `{ title, subtitle, body, coverImageUrl }` (never touches status).

Role gating: `[Authorize(Roles = "Coach,Administrator")]` on the backend — a **plain role check**,
not `IRequireFeaturePermission`. Mobile mirrors this with a simple `useAuth().roles` check, same
pattern as `PlayerSeasonCardsScreen.tsx`'s `PRIVILEGED_ROLES` / `EventDetailScreen.tsx`'s
`isPrivileged`. Do not build any feature-permission machinery for this.

## Expo version — READ THIS FIRST

`Mobile/AGENTS.md` says to check `https://docs.expo.dev/versions/v57.0.0/`, but that is stale.
**The actual installed version is Expo `54.0.36`** (`Mobile/package.json` → `"expo": "^54.0.0"`,
confirmed via `Mobile/node_modules/expo/package.json`). Use
`https://docs.expo.dev/versions/v54.0.0/sdk/imagepicker/` as the authoritative API reference, not
v57. Confirmed API shape for v54 (already verified — do not re-verify, just use this):

```ts
import * as ImagePicker from 'expo-image-picker';

const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
// permission.granted: boolean

const result = await ImagePicker.launchImageLibraryAsync({
  mediaTypes: ['images'], // array-of-strings form, NOT the deprecated MediaTypeOptions enum
  allowsMultipleSelection: false,
  quality: 0.8,
});
// result.canceled: boolean
// result.assets: [{ uri, width, height, fileName?, fileSize?, type? }] | null
```

`expo-image-picker` is **not currently a dependency** — install it with
`npx expo install expo-image-picker` (from `Mobile/`) so the version is auto-matched to Expo 54,
rather than hand-picking a version number.

## 0. New dependency + config wiring

1. From `Mobile/`, run: `npx expo install expo-image-picker`. Verify it lands in
   `Mobile/package.json` dependencies.
2. Edit `Mobile/jest.config.js`: add `expo-image-picker` to the `transformIgnorePatterns` allow-list
   array (it currently reads
   `'node_modules/(?!(expo|expo-secure-store|expo-constants|expo-localization|expo-modules-core|@react-native|react-native|@react-navigation)/)'`
   — insert `expo-image-picker` alongside the other `expo-*` entries), otherwise Jest will fail to
   parse its ESM build.
3. Edit `Mobile/app.json`: add a `plugins` array (there is none today) with the image-picker
   permission string:
   ```json
   "plugins": [
     [
       "expo-image-picker",
       {
         "photosPermission": "RFFM Coach necesita acceso a tus fotos para elegir la portada de una noticia."
       }
     ]
   ]
   ```

## 1. Mobile: API client — `Mobile/src/api/news.ts` (task 12)

**Red first**: write `Mobile/src/api/__tests__/news.test.ts` mirroring
`Mobile/src/api/__tests__/clubEmblem.test.ts`'s structure (`jest.mock('../client', () => ({ api: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() } }))`,
`beforeEach(() => jest.clearAllMocks())`). Cover, one `describe` per exported function:

- `getNews(pageNumber, pageSize)`: calls `api.get('/api/coach/news', { params: { pageNumber, pageSize } })`; returns `{ items, totalCount }` where `totalCount` is parsed from the mocked response's `headers['x-total-count']` (mock a response like `{ data: [...], headers: { 'x-total-count': '42' } }`); missing/absent header → `totalCount: 0`; a rejected promise propagates (does NOT get swallowed to `null`/`[]` — unlike `clubEmblem.ts`, this file lets the screen's `catch` handle errors).
- `getNewsDrafts(pageNumber, pageSize)`: same shape, hits `/api/coach/news/drafts`.
- `getNewsById(id)`: calls `api.get('/api/coach/news/{id}')`, returns `response.data` as `NewsDetail`; error propagates.
- `uploadNewsImage(fileUri)`: calls `api.post('/api/coach/news/image', expect.any(FormData), { headers: { 'Content-Type': 'multipart/form-data' } })`; returns `{ url: response.data.url }`. (Do not attempt to inspect `FormData` internals in the test — RN's `FormData` polyfill under jest-expo doesn't expose readable entries reliably; asserting the second arg is `instanceof FormData` and the headers/third-arg shape is sufficient.)
- `createNews(payload)`: `api.post('/api/coach/news', payload)` → returns `{ id: response.data.id }`.
- `updateNews(id, payload)`: `api.put('/api/coach/news/{id}', payload)` → resolves to `undefined`, no return value asserted beyond "does not throw".
- `publishNews(id)`: `api.post('/api/coach/news/{id}/publish')` → returns `response.data` as `NewsDetail`.
- `deleteNews(id)`: `api.delete('/api/coach/news/{id}')` → resolves.

Watch it fail (module doesn't exist yet), then implement:

```ts
import { api } from './client';

export interface NewsSummary {
  id: string;
  title: string;
  subtitle: string;
  coverImageUrl: string;
  status: 'Draft' | 'Published';
  publishedAt: string | null;
}

export interface NewsDetail extends NewsSummary {
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface NewsListResult {
  items: NewsSummary[];
  totalCount: number;
}

export interface CreateNewsPayload {
  title: string;
  subtitle: string;
  body: string;
  coverImageUrl: string;
  status: 'Draft' | 'Published';
}

export interface UpdateNewsPayload {
  title: string;
  subtitle: string;
  body: string;
  coverImageUrl: string;
}

function parseTotalCount(headers: Record<string, any> | undefined): number {
  const raw = headers?.['x-total-count'];
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
}

export const getNews = async (pageNumber: number, pageSize: number): Promise<NewsListResult> => {
  const response = await api.get('/api/coach/news', { params: { pageNumber, pageSize } });
  return { items: response.data as NewsSummary[], totalCount: parseTotalCount(response.headers) };
};

export const getNewsDrafts = async (pageNumber: number, pageSize: number): Promise<NewsListResult> => {
  const response = await api.get('/api/coach/news/drafts', { params: { pageNumber, pageSize } });
  return { items: response.data as NewsSummary[], totalCount: parseTotalCount(response.headers) };
};

export const getNewsById = async (id: string): Promise<NewsDetail> => {
  const response = await api.get(`/api/coach/news/${id}`);
  return response.data as NewsDetail;
};

export const uploadNewsImage = async (fileUri: string): Promise<{ url: string }> => {
  const fileName = fileUri.split('/').pop() || `cover-${Date.now()}.jpg`;
  const extensionMatch = /\.(\w+)$/.exec(fileName);
  const extension = extensionMatch ? extensionMatch[1].toLowerCase() : 'jpg';
  const mimeType = extension === 'png' ? 'image/png' : 'image/jpeg';

  const formData = new FormData();
  formData.append('file', {
    uri: fileUri,
    name: fileName,
    type: mimeType,
  } as any);

  const response = await api.post('/api/coach/news/image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return { url: response.data.url };
};

export const createNews = async (payload: CreateNewsPayload): Promise<{ id: string }> => {
  const response = await api.post('/api/coach/news', payload);
  return { id: response.data.id };
};

export const updateNews = async (id: string, payload: UpdateNewsPayload): Promise<void> => {
  await api.put(`/api/coach/news/${id}`, payload);
};

export const publishNews = async (id: string): Promise<NewsDetail> => {
  const response = await api.post(`/api/coach/news/${id}/publish`);
  return response.data as NewsDetail;
};

export const deleteNews = async (id: string): Promise<void> => {
  await api.delete(`/api/coach/news/${id}`);
};
```

Run `npm test -- src/api/__tests__/news.test.ts` — green before moving on.

## 2. Mobile: `NewsScreen.tsx` feed (task 13)

**Red first**: write `Mobile/src/screens/__tests__/NewsScreen.test.tsx`. Mock `../../api/news`
(`jest.mock('../../api/news', () => ({ getNews: jest.fn(), getNewsDrafts: jest.fn() }))`) and
`../../auth/AuthContext` (`jest.mock('../../auth/AuthContext', () => ({ useAuth: jest.fn() }))`),
same pattern as other screen tests that need roles — check
`Mobile/src/screens/__tests__/PlayerSeasonCardsScreen.test.tsx` or
`Mobile/src/screens/__tests__/EventDetailScreen.test.tsx` if they mock `useAuth` for the exact
mock shape; otherwise mock `useAuth` to return `{ roles: [...] }`. Mock
`@react-navigation/native`'s `useNavigation` to capture `navigate` calls (`jest.fn()`). Cover
every scenario in `openspec/changes/news-feature/specs/mobile-news/spec.md`:

- Loading state shows `loading-indicator` before data resolves.
- `useAuth` returns `roles: ['FamilyMember']` → only `getNews` is called, `getNewsDrafts` is
  NEVER called (assert `getNewsDrafts` not called) — feed renders only published items, no
  "Borrador" badge anywhere.
- `useAuth` returns `roles: ['Coach']` with one draft (from `getNewsDrafts`) and two published
  (from `getNews`) → all three cards render, the draft's card carries a `news-draft-badge-<id>`
  testID, and the draft item appears BEFORE the published ones in render order (assert via
  `getAllByTestId(/^news-card-/)` order).
- Empty state: both calls resolve to `{ items: [], totalCount: 0 }` → renders `empty-message`,
  not an empty `FlatList`.
- Error state: `getNews` rejects with `{ response: { data: { detail: 'X' } } }` → shows `X` in
  `error-message`; rejects with no `response.data.detail` → shows a Spanish fallback (e.g. `'No
  se pudieron cargar las noticias'`); `retry-button` re-triggers the fetch.
- `getNewsDrafts` rejects (Coach role) while `getNews` resolves → published items still render,
  no `error-message` shown, no drafts shown (soft-fail, per design.md Mobile Risk 1).
- FAB (`news-fab`) is rendered only when role is Coach/Administrator; absent for
  FamilyMember/Player.
- Tapping a card (`fireEvent.press(getByTestId('news-card-<id>'))`) calls
  `navigation.navigate('NewsDetail', { newsId: '<id>' })`.
- Tapping the FAB calls `navigation.navigate('NewsForm', { mode: 'create' })`.

Watch it fail, then implement `Mobile/src/screens/NewsScreen.tsx` (replaces the current
placeholder entirely):

```tsx
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, Pressable, ActivityIndicator, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { coachColors } from '../theme/colors';
import { useAuth } from '../auth/AuthContext';
import { getNews, getNewsDrafts, NewsSummary } from '../api/news';
import { API_BASE_URL } from '../api/client';
import { resolvePhotoUrl } from '../utils/resolvePhotoUrl';
import ScreenHeader from '../shared/components/ScreenHeader';

const PAGE_SIZE = 20;
const COACH_ADMIN_ROLES = ['coach', 'administrator'];

interface FeedItem extends NewsSummary {
  isDraft: boolean;
}

const NewsScreen = () => {
  const navigation = useNavigation<any>();
  const { roles } = useAuth();
  const isCoachOrAdmin = (roles ?? []).some((r) => COACH_ADMIN_ROLES.includes(r.toLowerCase()));

  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFeed = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const publishedResultPromise = getNews(1, PAGE_SIZE);
      const draftsResultPromise = isCoachOrAdmin
        ? getNewsDrafts(1, PAGE_SIZE).catch(() => null)
        : Promise.resolve(null);

      const [publishedResult, draftsResult] = await Promise.all([
        publishedResultPromise,
        draftsResultPromise,
      ]);

      const drafts: FeedItem[] = draftsResult
        ? draftsResult.items.map((item) => ({ ...item, isDraft: true }))
        : [];
      const published: FeedItem[] = publishedResult.items.map((item) => ({ ...item, isDraft: false }));

      setItems([...drafts, ...published]);
    } catch (e: any) {
      setError(e.response?.data?.detail || 'No se pudieron cargar las noticias');
    } finally {
      setLoading(false);
    }
  }, [isCoachOrAdmin]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  const renderHeader = () => <ScreenHeader title="Noticias" showBack={false} />;

  if (loading) {
    return (
      <View testID="news-screen-container" style={styles.container}>
        {renderHeader()}
        <View style={styles.centeredContent}>
          <ActivityIndicator testID="loading-indicator" size="large" color={coachColors.primary} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View testID="news-screen-container" style={styles.container}>
        {renderHeader()}
        <View style={styles.centeredContent}>
          <Text testID="error-message" style={styles.errorText}>{error}</Text>
          <Pressable testID="retry-button" style={styles.retryButton} onPress={fetchFeed}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View testID="news-screen-container" style={styles.container}>
      {renderHeader()}
      {items.length === 0 ? (
        <View style={styles.centeredContent}>
          <Text testID="empty-message" style={styles.emptyText}>No hay noticias todavía</Text>
        </View>
      ) : (
        <FlatList
          testID="news-feed-list"
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const coverUri = resolvePhotoUrl(item.coverImageUrl, API_BASE_URL);
            return (
              <Pressable
                testID={`news-card-${item.id}`}
                style={styles.card}
                onPress={() => navigation.navigate('NewsDetail', { newsId: item.id })}
              >
                {coverUri ? (
                  <Image testID={`news-cover-${item.id}`} source={{ uri: coverUri }} style={styles.cover} />
                ) : (
                  <View testID={`news-cover-placeholder-${item.id}`} style={styles.coverPlaceholder} />
                )}
                {item.isDraft && (
                  <View testID={`news-draft-badge-${item.id}`} style={styles.draftBadge}>
                    <Text style={styles.draftBadgeText}>Borrador</Text>
                  </View>
                )}
                <View style={styles.cardBody}>
                  <Text testID={`news-title-${item.id}`} style={styles.headline} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.subtitleText} numberOfLines={2}>{item.subtitle}</Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}

      {isCoachOrAdmin && (
        <Pressable
          testID="news-fab"
          style={styles.fab}
          onPress={() => navigation.navigate('NewsForm', { mode: 'create' })}
        >
          <Ionicons name="add-outline" size={28} color={coachColors.contrastText} />
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 16, backgroundColor: coachColors.background },
  centeredContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingBottom: 88 },
  card: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: coachColors.surface,
    borderWidth: 1,
    borderColor: coachColors.border,
    marginBottom: 16,
  },
  cover: { width: '100%', aspectRatio: 16 / 9 },
  coverPlaceholder: { width: '100%', aspectRatio: 16 / 9, backgroundColor: coachColors.surfaceAlt },
  draftBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: coachColors.accentOrange,
  },
  draftBadgeText: { color: coachColors.contrastText, fontWeight: '800', fontSize: 11, textTransform: 'uppercase' },
  cardBody: { padding: 12, gap: 4 },
  headline: { fontSize: 18, fontWeight: '800', color: coachColors.textPrimary },
  subtitleText: { fontSize: 13, color: coachColors.textSecondary },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: coachColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  errorText: { color: coachColors.error, fontSize: 16, marginBottom: 20, textAlign: 'center' },
  retryButton: { backgroundColor: coachColors.primary, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, alignItems: 'center' },
  retryButtonText: { color: coachColors.contrastText, fontWeight: '600' },
  emptyText: { fontSize: 16, color: coachColors.textSecondary, textAlign: 'center' },
});

export default NewsScreen;
```

Run `npm test -- src/screens/__tests__/NewsScreen.test.tsx` — green before moving on.

## 3. Mobile: `NewsDetailScreen.tsx` (task 14)

**Red first**: write `Mobile/src/screens/__tests__/NewsDetailScreen.test.tsx`, mocking
`../../api/news` (`getNewsById`, `deleteNews`), `../../auth/AuthContext` (`useAuth`), and
`@react-navigation/native` (`useNavigation` → `{ navigate: jest.fn(), goBack: jest.fn() }`,
`useRoute` → `{ params: { newsId: 'news1' } }`). Also mock the RN `Alert` module
(`jest.spyOn(Alert, 'alert')` or `jest.mock('react-native/Libraries/Alert/Alert', ...)` — check
how, if at all, an existing test in this repo mocks `Alert`; if none does, use
`jest.spyOn(require('react-native').Alert, 'alert').mockImplementation((title, msg, buttons) => buttons?.[1]?.onPress?.())`
to auto-confirm the destructive action in the "Coach deletes" test). Cover:

- Loading state (`loading-indicator`) before `getNewsById` resolves.
- Full detail render: title, subtitle, cover image, body, and a formatted publish date all
  present with distinct testIDs (`news-detail-title`, `news-detail-subtitle`,
  `news-detail-cover`, `news-detail-body`, `news-detail-date`).
- Error state: `getNewsById` rejects with `response.data.detail` → shown; rejects without it →
  Spanish fallback (e.g. `'No se pudo cargar la noticia'`); this also covers the "404 as not
  found" case (a 404 axios error still has `e.response?.data?.detail` or falls back the same
  way — no special-casing needed).
- `edit-button`/`delete-button` (screen-header actions) are rendered only when `useAuth` returns
  a Coach/Administrator role; absent for FamilyMember/Player.
- Tapping `edit-button` calls `navigation.navigate('NewsForm', { mode: 'edit', newsId: 'news1' })`.
- Tapping `delete-button` triggers the confirm `Alert`; confirming calls
  `deleteNews('news1')` then `navigation.goBack()`.

Watch it fail, then implement `Mobile/src/screens/NewsDetailScreen.tsx`:

```tsx
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, ActivityIndicator, ScrollView, Alert, Pressable } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { coachColors } from '../theme/colors';
import { useAuth } from '../auth/AuthContext';
import { getNewsById, deleteNews, NewsDetail } from '../api/news';
import { API_BASE_URL } from '../api/client';
import { resolvePhotoUrl } from '../utils/resolvePhotoUrl';
import ScreenHeader, { ScreenHeaderAction } from '../shared/components/ScreenHeader';

const COACH_ADMIN_ROLES = ['coach', 'administrator'];

function formatPublishDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
}

const NewsDetailScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const params = route.params as { newsId?: string } | undefined;
  const newsId = params?.newsId || '';
  const { roles } = useAuth();
  const isCoachOrAdmin = (roles ?? []).some((r) => COACH_ADMIN_ROLES.includes(r.toLowerCase()));

  const [news, setNews] = useState<NewsDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getNewsById(newsId);
      setNews(data);
    } catch (e: any) {
      setError(e.response?.data?.detail || 'No se pudo cargar la noticia');
    } finally {
      setLoading(false);
    }
  }, [newsId]);

  useEffect(() => {
    if (newsId) fetchDetail();
  }, [newsId, fetchDetail]);

  const handleDelete = () => {
    Alert.alert('Eliminar noticia', '¿Seguro que quieres eliminar esta noticia?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteNews(newsId);
            navigation.goBack();
          } catch (e: any) {
            setError(e.response?.data?.detail || 'No se pudo eliminar la noticia');
          }
        },
      },
    ]);
  };

  const actions: ScreenHeaderAction[] | undefined = isCoachOrAdmin
    ? [
        {
          key: 'edit',
          icon: 'create-outline',
          label: 'Editar',
          testID: 'edit-button',
          onPress: () => navigation.navigate('NewsForm', { mode: 'edit', newsId }),
        },
        {
          key: 'delete',
          icon: 'trash-outline',
          label: 'Eliminar',
          testID: 'delete-button',
          onPress: handleDelete,
        },
      ]
    : undefined;

  const renderHeader = () => <ScreenHeader title="Noticia" actions={actions} />;

  if (loading) {
    return (
      <View testID="news-detail-container" style={styles.container}>
        {renderHeader()}
        <View style={styles.centeredContent}>
          <ActivityIndicator testID="loading-indicator" size="large" color={coachColors.primary} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View testID="news-detail-container" style={styles.container}>
        {renderHeader()}
        <View style={styles.centeredContent}>
          <Text testID="error-message" style={styles.errorText}>{error}</Text>
          <Pressable testID="retry-button" style={styles.retryButton} onPress={fetchDetail}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!news) {
    return (
      <View testID="news-detail-container" style={styles.container}>
        {renderHeader()}
        <View style={styles.centeredContent}>
          <Text testID="empty-message" style={styles.emptyText}>No hay información disponible</Text>
        </View>
      </View>
    );
  }

  const coverUri = resolvePhotoUrl(news.coverImageUrl, API_BASE_URL);

  return (
    <View testID="news-detail-container" style={styles.container}>
      {renderHeader()}
      <ScrollView contentContainerStyle={styles.contentContainer}>
        {coverUri && <Image testID="news-detail-cover" source={{ uri: coverUri }} style={styles.cover} />}
        <Text testID="news-detail-title" style={styles.title}>{news.title}</Text>
        <Text testID="news-detail-subtitle" style={styles.subtitle}>{news.subtitle}</Text>
        <Text testID="news-detail-date" style={styles.date}>{formatPublishDate(news.publishedAt)}</Text>
        <Text testID="news-detail-body" style={styles.body}>{news.body}</Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 16, backgroundColor: coachColors.background },
  centeredContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  contentContainer: { paddingBottom: 32 },
  cover: { width: '100%', aspectRatio: 16 / 9, borderRadius: 14, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '800', color: coachColors.textPrimary, marginBottom: 6 },
  subtitle: { fontSize: 15, color: coachColors.textSecondary, marginBottom: 6 },
  date: { fontSize: 12, color: coachColors.textSecondary, marginBottom: 16, textTransform: 'capitalize' },
  body: { fontSize: 15, color: coachColors.textPrimary, lineHeight: 22 },
  errorText: { color: coachColors.error, fontSize: 16, marginBottom: 20, textAlign: 'center' },
  retryButton: { backgroundColor: coachColors.primary, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, alignItems: 'center' },
  retryButtonText: { color: coachColors.contrastText, fontWeight: '600' },
  emptyText: { fontSize: 16, color: coachColors.textSecondary, textAlign: 'center' },
});

export default NewsDetailScreen;
```

Run `npm test -- src/screens/__tests__/NewsDetailScreen.test.tsx` — green before moving on.

## 4. Mobile: `NewsFormScreen.tsx` create/edit (task 15)

**Red first**: write `Mobile/src/screens/__tests__/NewsFormScreen.test.tsx`. Mock `../../api/news`
(`getNewsById`, `uploadNewsImage`, `createNews`, `updateNews`), `expo-image-picker`
(`requestMediaLibraryPermissionsAsync`, `launchImageLibraryAsync`), and
`@react-navigation/native` (`useNavigation`, `useRoute`). Cover:

- Create mode (`route.params = { mode: 'create' }`): renders a Draft/Publish choice (e.g.
  `save-draft-button` + `publish-button`, both visible); does NOT preload via `getNewsById`
  (assert it's never called in create mode).
- Edit mode (`route.params = { mode: 'edit', newsId: 'news1' }`): on mount, calls
  `getNewsById('news1')` and preloads `title`/`subtitle`/`body` text inputs with the returned
  values; renders no Draft/Publish choice, only a single `save-button`.
- Image pick + upload two-step flow: pressing `pick-image-button` calls
  `ImagePicker.requestMediaLibraryPermissionsAsync()` then, once granted,
  `ImagePicker.launchImageLibraryAsync(...)`; once an asset is returned (mock `{ canceled: false,
  assets: [{ uri: 'file://local.jpg' }] }`), the screen calls `uploadNewsImage('file://local.jpg')`
  and — critically — when the form is submitted, `createNews`/`updateNews` receives the **uploaded
  `url` from `uploadNewsImage`'s result**, never the local `file://` URI, as `coverImageUrl`.
- Validation: submitting with an empty title/subtitle/body, or with no cover photo
  uploaded yet, blocks the `createNews`/`updateNews` call and shows a Spanish validation message
  (`error-message`) instead.
- Create + "Guardar borrador": fills all fields, uploads a photo, presses `save-draft-button` →
  `createNews` called with `status: 'Draft'`.
- Create + "Publicar": same but presses `publish-button` → `createNews` called with
  `status: 'Published'`.
- Edit + save: fills fields (photo already preloaded from `getNewsById`, no new pick required),
  presses `save-button` → `updateNews('news1', { title, subtitle, body, coverImageUrl })` called,
  and the payload has no `status` key at all.
- Save error: `createNews`/`updateNews` rejects → Spanish fallback error shown (e.g. `'No se pudo
  guardar la noticia'`), using `e.response?.data?.detail` when present.

Watch it fail, then implement `Mobile/src/screens/NewsFormScreen.tsx`:

```tsx
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Image, ActivityIndicator, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useRoute } from '@react-navigation/native';
import { coachColors } from '../theme/colors';
import { getNewsById, uploadNewsImage, createNews, updateNews } from '../api/news';
import { API_BASE_URL } from '../api/client';
import { resolvePhotoUrl } from '../utils/resolvePhotoUrl';
import ScreenHeader from '../shared/components/ScreenHeader';

type FormMode = 'create' | 'edit';

const NewsFormScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const params = route.params as { mode: FormMode; newsId?: string };
  const mode = params.mode;
  const newsId = params.newsId;

  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [body, setBody] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(mode === 'edit');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === 'edit' && newsId) {
      (async () => {
        try {
          setLoading(true);
          const data = await getNewsById(newsId);
          setTitle(data.title);
          setSubtitle(data.subtitle);
          setBody(data.body);
          setCoverImageUrl(data.coverImageUrl);
        } catch (e: any) {
          setError(e.response?.data?.detail || 'No se pudo cargar la noticia');
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [mode, newsId]);

  const handlePickImage = useCallback(async () => {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Se necesita acceso a la galería para elegir una foto');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.length) return;

    try {
      setUploadingImage(true);
      const { url } = await uploadNewsImage(result.assets[0].uri);
      setCoverImageUrl(url);
    } catch (e: any) {
      setError(e.response?.data?.detail || 'No se pudo subir la foto');
    } finally {
      setUploadingImage(false);
    }
  }, []);

  const handleSubmit = useCallback(
    async (status?: 'Draft' | 'Published') => {
      if (!title.trim() || !subtitle.trim() || !body.trim() || !coverImageUrl) {
        setError('Completa el título, la entradilla, el cuerpo y elige una foto de portada');
        return;
      }

      try {
        setSaving(true);
        setError(null);
        if (mode === 'create') {
          const { id } = await createNews({
            title: title.trim(),
            subtitle: subtitle.trim(),
            body,
            coverImageUrl,
            status: status ?? 'Draft',
          });
          navigation.replace('NewsDetail', { newsId: id });
        } else if (newsId) {
          await updateNews(newsId, {
            title: title.trim(),
            subtitle: subtitle.trim(),
            body,
            coverImageUrl,
          });
          navigation.replace('NewsDetail', { newsId });
        }
      } catch (e: any) {
        setError(e.response?.data?.detail || 'No se pudo guardar la noticia');
      } finally {
        setSaving(false);
      }
    },
    [title, subtitle, body, coverImageUrl, mode, newsId, navigation],
  );

  const renderHeader = () => (
    <ScreenHeader title={mode === 'create' ? 'Nueva noticia' : 'Editar noticia'} />
  );

  if (loading) {
    return (
      <View testID="news-form-container" style={styles.container}>
        {renderHeader()}
        <View style={styles.centeredContent}>
          <ActivityIndicator testID="loading-indicator" size="large" color={coachColors.primary} />
        </View>
      </View>
    );
  }

  const coverUri = coverImageUrl ? resolvePhotoUrl(coverImageUrl, API_BASE_URL) : null;

  return (
    <View testID="news-form-container" style={styles.container}>
      {renderHeader()}
      <ScrollView contentContainerStyle={styles.contentContainer}>
        <Pressable testID="pick-image-button" style={styles.imagePicker} onPress={handlePickImage}>
          {coverUri ? (
            <Image testID="news-form-cover-preview" source={{ uri: coverUri }} style={styles.coverPreview} />
          ) : (
            <Text style={styles.imagePickerText}>
              {uploadingImage ? 'Subiendo foto...' : 'Elegir foto de portada'}
            </Text>
          )}
        </Pressable>

        <TextInput
          testID="title-input"
          style={styles.input}
          placeholder="Título"
          placeholderTextColor={coachColors.textSecondary}
          value={title}
          onChangeText={setTitle}
        />
        <TextInput
          testID="subtitle-input"
          style={styles.input}
          placeholder="Entradilla"
          placeholderTextColor={coachColors.textSecondary}
          value={subtitle}
          onChangeText={setSubtitle}
        />
        <TextInput
          testID="body-input"
          style={[styles.input, styles.bodyInput]}
          placeholder="Cuerpo de la noticia"
          placeholderTextColor={coachColors.textSecondary}
          value={body}
          onChangeText={setBody}
          multiline
        />

        {error && <Text testID="error-message" style={styles.errorText}>{error}</Text>}

        {mode === 'create' ? (
          <View style={styles.buttonRow}>
            <Pressable
              testID="save-draft-button"
              style={[styles.button, styles.buttonSecondary]}
              onPress={() => handleSubmit('Draft')}
              disabled={saving}
            >
              <Text style={styles.buttonTextSecondary}>Guardar borrador</Text>
            </Pressable>
            <Pressable
              testID="publish-button"
              style={[styles.button, styles.buttonPrimary]}
              onPress={() => handleSubmit('Published')}
              disabled={saving}
            >
              <Text style={styles.buttonTextPrimary}>Publicar</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            testID="save-button"
            style={[styles.button, styles.buttonPrimary]}
            onPress={() => handleSubmit()}
            disabled={saving}
          >
            <Text style={styles.buttonTextPrimary}>Guardar cambios</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 16, backgroundColor: coachColors.background },
  centeredContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  contentContainer: { paddingBottom: 32, gap: 12 },
  imagePicker: {
    height: 160,
    borderRadius: 14,
    backgroundColor: coachColors.surface,
    borderWidth: 1,
    borderColor: coachColors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  coverPreview: { width: '100%', height: '100%' },
  imagePickerText: { color: coachColors.textSecondary },
  input: {
    borderWidth: 1,
    borderColor: coachColors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: coachColors.textPrimary,
    backgroundColor: coachColors.surface,
  },
  bodyInput: { minHeight: 120, textAlignVertical: 'top' },
  errorText: { color: coachColors.error, fontSize: 14, textAlign: 'center' },
  buttonRow: { flexDirection: 'row', gap: 12 },
  button: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  buttonPrimary: { backgroundColor: coachColors.primary },
  buttonSecondary: { backgroundColor: coachColors.surfaceAlt, borderWidth: 1, borderColor: coachColors.border },
  buttonTextPrimary: { color: coachColors.contrastText, fontWeight: '700' },
  buttonTextSecondary: { color: coachColors.textPrimary, fontWeight: '700' },
});

export default NewsFormScreen;
```

Run `npm test -- src/screens/__tests__/NewsFormScreen.test.tsx` — green before moving on.

## 5. Mobile: navigation wiring (task 16)

**Red first**: update `Mobile/src/navigation/__tests__/CalendarTabStack.test.tsx`-style coverage
— either extend `Mobile/src/navigation/__tests__/CalendarTabs.test.tsx` or add a new
`Mobile/src/navigation/__tests__/NewsTabStack.test.tsx` mirroring `CalendarTabStack.test.tsx`
exactly (same `jest.mock('@react-navigation/native-stack', ...)` shape). Assert:

- `NewsTabStack` registers routes in order: `NewsList`, `NewsDetail`, `NewsForm`.
- `CalendarTabs`'s `NewsTab` still has `tabBarLabel` "Noticias" and icon `newspaper-outline`, same
  position (first tab) — this must still pass unmodified from the existing
  `CalendarTabs.test.tsx` assertions once `NewsTab`'s `component` changes to `NewsTabStack`
  (update the `jest.mock('../../screens/NewsScreen', ...)` line if needed since `NewsScreen` is
  now rendered inside `NewsTabStack`, not directly by the tab — mock `NewsTabStack` itself, or
  mock `NewsScreen`/`NewsDetailScreen`/`NewsFormScreen` individually and let the real
  `NewsTabStack` render, matching how `CalendarTabs.test.tsx` already mocks
  `TeamTabStack`/`CompetitionTabStack`'s child screens individually rather than the stacks
  themselves).

Watch it fail, then edit `Mobile/src/navigation/RootNavigator.tsx`:

1. Add imports: `import NewsDetailScreen from '../screens/NewsDetailScreen';` and
   `import NewsFormScreen from '../screens/NewsFormScreen';` (keep the existing
   `import NewsScreen from '../screens/NewsScreen';`).
2. Add `const NewsStack = createNativeStackNavigator();` alongside the other `*Stack` consts.
3. Add a new exported `NewsTabStack` component, positioned near `TeamTabStack`:
   ```tsx
   export const NewsTabStack = () => (
     <NewsStack.Navigator screenOptions={{ headerShown: false }}>
       <NewsStack.Screen name="NewsList" component={NewsScreen} />
       <NewsStack.Screen name="NewsDetail" component={NewsDetailScreen} options={eventDetailScreenOptions} />
       <NewsStack.Screen name="NewsForm" component={NewsFormScreen} options={eventDetailScreenOptions} />
     </NewsStack.Navigator>
   );
   ```
   Reuse the existing `eventDetailScreenOptions` as-is (do not duplicate it) — it currently reads
   `route.params?.teamId` which `NewsDetail`/`NewsForm` won't pass, so `AppHeaderTitle` will just
   render its "no team" fallback; that's acceptable and consistent, do not modify
   `eventDetailScreenOptions`'s signature for this.
4. In `CalendarTabs`, change the `NewsTab`'s `component` from `NewsScreen` to `NewsTabStack` —
   **do not change** `name="NewsTab"`, `tabBarLabel: 'Noticias'`, or the `tabBarIcon` — only the
   `component` prop:
   ```tsx
   <Tab.Screen
     name="NewsTab"
     component={NewsTabStack}
     options={{
       tabBarLabel: 'Noticias',
       tabBarIcon: ({ color, size }) => <Ionicons name="newspaper-outline" size={size} color={color} />,
     }}
   />
   ```

Run `npm test -- src/navigation` — green before moving on.

## 6. Verification (must all be true before reporting done)

1. `cd Mobile && npm test` — full suite green, zero skipped tests. Report the exact pass/fail/total
   counts from Jest's own summary line — do not paraphrase or round.
2. Confirm `expo-image-picker` was installed via `npx expo install expo-image-picker` (check
   `Mobile/package.json`) and that `Mobile/jest.config.js`'s `transformIgnorePatterns` includes it.
3. Confirm `Mobile/app.json` has the `expo-image-picker` plugin entry with the Spanish
   `photosPermission` string.
4. Every scenario in `openspec/changes/news-feature/specs/mobile-news/spec.md` has a corresponding
   passing test.
5. Do not touch anything under `Front/` or `Back/`.
6. Do not create or update any git commit — leave the working tree as-is for the orchestrator to
   review and commit after explicit user confirmation (per `.claude/rules/git.md` §6.3).
7. Do NOT run `openspec archive` — the change stays active until the orchestrator confirms both
   backend and mobile scopes are done and the user explicitly approves archiving.

Report back: every file created/modified (absolute paths), the exact `npm test` summary line
(e.g. "Tests: 3 skipped, 214 passed, 217 total"), and confirmation of steps 2–3 above. If any test
you wrote does not match what's described here because the real component ended up shaped
differently once you were implementing it, note the deviation explicitly — do not silently claim
a test passes if you had to change its expectations without telling me why.
