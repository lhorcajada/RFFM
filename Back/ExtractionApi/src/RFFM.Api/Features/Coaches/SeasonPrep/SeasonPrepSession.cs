using System.Security.Claims;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Entities.Coaches;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.SeasonPrep
{
    // ── GET /api/season-prep/session ─────────────────────────────────────────

    public class GetSeasonPrepSession : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("api/season-prep/session",
                    async (string? sportEventId, IMediator mediator, HttpContext httpContext, CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                                     ?? throw new UnauthorizedAccessException("Usuario no autenticado");
                        var result = await mediator.Send(new GetSeasonPrepSessionQuery(userId, sportEventId), cancellationToken);
                        return result is not null ? Results.Ok(result) : Results.NoContent();
                    })
                .WithName(nameof(GetSeasonPrepSession))
                .WithTags("SeasonPrep")
                .Produces<SeasonPrepSessionDto>(StatusCodes.Status200OK)
                .Produces(StatusCodes.Status204NoContent)
                .RequireAuthorization();
        }
    }

    public record SeasonPrepSessionDto(string Data, DateTime UpdatedAt);

    public record GetSeasonPrepSessionQuery(string UserId, string? SportEventId) : IRequest<SeasonPrepSessionDto?>;

    public class GetSeasonPrepSessionHandler : IRequestHandler<GetSeasonPrepSessionQuery, SeasonPrepSessionDto?>
    {
        private readonly AppDbContext _db;

        public GetSeasonPrepSessionHandler(AppDbContext db) => _db = db;

        public async ValueTask<SeasonPrepSessionDto?> Handle(GetSeasonPrepSessionQuery request, CancellationToken cancellationToken)
        {
            var session = await _db.SeasonPrepSessions
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.UserId == request.UserId && s.SportEventId == request.SportEventId, cancellationToken);

            if (session is null && request.SportEventId is not null)
            {
                session = await _db.SeasonPrepSessions
                    .AsNoTracking()
                    .FirstOrDefaultAsync(s => s.UserId == request.UserId && s.SportEventId == null, cancellationToken);
            }

            return session is not null
                ? new SeasonPrepSessionDto(session.Data, session.UpdatedAt)
                : null;
        }
    }

    // ── PUT /api/season-prep/session ─────────────────────────────────────────

    public class UpsertSeasonPrepSession : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut("api/season-prep/session",
                    async (UpsertSeasonPrepSessionCommand command, IMediator mediator, HttpContext httpContext, CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                                     ?? throw new UnauthorizedAccessException("Usuario no autenticado");
                        await mediator.Send(command with { UserId = userId }, cancellationToken);
                        return Results.NoContent();
                    })
                .WithName(nameof(UpsertSeasonPrepSession))
                .WithTags("SeasonPrep")
                .Produces(StatusCodes.Status204NoContent)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .RequireAuthorization();
        }
    }

    public record UpsertSeasonPrepSessionCommand(string Data, string? SportEventId, string UserId = "") : IRequest;

    public class UpsertSeasonPrepSessionHandler : IRequestHandler<UpsertSeasonPrepSessionCommand>
    {
        private readonly AppDbContext _db;

        public UpsertSeasonPrepSessionHandler(AppDbContext db) => _db = db;

        public async ValueTask<Unit> Handle(UpsertSeasonPrepSessionCommand request, CancellationToken cancellationToken)
        {
            var session = await _db.SeasonPrepSessions
                .FirstOrDefaultAsync(s => s.UserId == request.UserId && s.SportEventId == request.SportEventId, cancellationToken);

            if (session is null)
            {
                session = new SeasonPrepSession
                {
                    UserId = request.UserId,
                    SportEventId = request.SportEventId,
                    Data = request.Data,
                    UpdatedAt = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Utc),
                };
                _db.SeasonPrepSessions.Add(session);
            }
            else
            {
                session.Data = request.Data;
                session.UpdatedAt = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Utc);
            }

            await _db.SaveChangesAsync(cancellationToken);
            return Unit.Value;
        }
    }

    // ── DELETE /api/season-prep/session ──────────────────────────────────────

    public class DeleteSeasonPrepSession : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapDelete("api/season-prep/session",
                    async (IMediator mediator, HttpContext httpContext, CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                                     ?? throw new UnauthorizedAccessException("Usuario no autenticado");
                        var sportEventId = httpContext.Request.Query["sportEventId"].ToString();
                        await mediator.Send(new DeleteSeasonPrepSessionCommand(userId, string.IsNullOrWhiteSpace(sportEventId) ? null : sportEventId), cancellationToken);
                        return Results.NoContent();
                    })
                .WithName(nameof(DeleteSeasonPrepSession))
                .WithTags("SeasonPrep")
                .Produces(StatusCodes.Status204NoContent)
                .RequireAuthorization();
        }
    }

    public record DeleteSeasonPrepSessionCommand(string UserId, string? SportEventId) : IRequest;

    public class DeleteSeasonPrepSessionHandler : IRequestHandler<DeleteSeasonPrepSessionCommand>
    {
        private readonly AppDbContext _db;

        public DeleteSeasonPrepSessionHandler(AppDbContext db) => _db = db;

        public async ValueTask<Unit> Handle(DeleteSeasonPrepSessionCommand request, CancellationToken cancellationToken)
        {
            var session = await _db.SeasonPrepSessions
                .FirstOrDefaultAsync(s => s.UserId == request.UserId && s.SportEventId == request.SportEventId, cancellationToken);

            if (session is null && request.SportEventId is not null)
            {
                session = await _db.SeasonPrepSessions
                    .FirstOrDefaultAsync(s => s.UserId == request.UserId && s.SportEventId == null, cancellationToken);
            }

            if (session is not null)
            {
                _db.SeasonPrepSessions.Remove(session);
                await _db.SaveChangesAsync(cancellationToken);
            }

            return Unit.Value;
        }
    }
}
