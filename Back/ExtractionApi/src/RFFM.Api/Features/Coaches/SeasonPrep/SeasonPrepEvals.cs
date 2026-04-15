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
    // ── GET /api/season-prep/evaluations?fedSeason=X ─────────────────────────

    public class GetSeasonPrepEvaluations : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("api/season-prep/evaluations",
                    async (string fedSeason, IMediator mediator, HttpContext httpContext, CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                                     ?? throw new UnauthorizedAccessException("Usuario no autenticado");
                        var result = await mediator.Send(new GetSeasonPrepEvaluationsQuery(userId, fedSeason), cancellationToken);
                        return result is not null ? Results.Ok(result) : Results.NoContent();
                    })
                .WithName(nameof(GetSeasonPrepEvaluations))
                .WithTags("SeasonPrep")
                .Produces<SeasonPrepEvaluationsDto>(StatusCodes.Status200OK)
                .Produces(StatusCodes.Status204NoContent)
                .RequireAuthorization();
        }
    }

    public record SeasonPrepEvaluationsDto(string Data, DateTime UpdatedAt);

    public record GetSeasonPrepEvaluationsQuery(string UserId, string FedSeason) : IRequest<SeasonPrepEvaluationsDto?>;

    public class GetSeasonPrepEvaluationsHandler : IRequestHandler<GetSeasonPrepEvaluationsQuery, SeasonPrepEvaluationsDto?>
    {
        private readonly AppDbContext _db;

        public GetSeasonPrepEvaluationsHandler(AppDbContext db) => _db = db;

        public async ValueTask<SeasonPrepEvaluationsDto?> Handle(GetSeasonPrepEvaluationsQuery request, CancellationToken cancellationToken)
        {
            var record = await _db.SeasonPrepEvaluations
                .AsNoTracking()
                .FirstOrDefaultAsync(e => e.UserId == request.UserId && e.FedSeason == request.FedSeason, cancellationToken);

            return record is not null
                ? new SeasonPrepEvaluationsDto(record.Data, record.UpdatedAt)
                : null;
        }
    }

    // ── PUT /api/season-prep/evaluations ─────────────────────────────────────

    public class UpsertSeasonPrepEvaluations : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut("api/season-prep/evaluations",
                    async (UpsertSeasonPrepEvaluationsCommand command, IMediator mediator, HttpContext httpContext, CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                                     ?? throw new UnauthorizedAccessException("Usuario no autenticado");
                        await mediator.Send(command with { UserId = userId }, cancellationToken);
                        return Results.NoContent();
                    })
                .WithName(nameof(UpsertSeasonPrepEvaluations))
                .WithTags("SeasonPrep")
                .Produces(StatusCodes.Status204NoContent)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .RequireAuthorization();
        }
    }

    public record UpsertSeasonPrepEvaluationsCommand(string FedSeason, string Data, string UserId = "") : IRequest;

    public class UpsertSeasonPrepEvaluationsHandler : IRequestHandler<UpsertSeasonPrepEvaluationsCommand>
    {
        private readonly AppDbContext _db;

        public UpsertSeasonPrepEvaluationsHandler(AppDbContext db) => _db = db;

        public async ValueTask<Unit> Handle(UpsertSeasonPrepEvaluationsCommand request, CancellationToken cancellationToken)
        {
            var record = await _db.SeasonPrepEvaluations
                .FirstOrDefaultAsync(e => e.UserId == request.UserId && e.FedSeason == request.FedSeason, cancellationToken);

            if (record is null)
            {
                record = new SeasonPrepEvaluations
                {
                    UserId = request.UserId,
                    FedSeason = request.FedSeason,
                    Data = request.Data,
                    UpdatedAt = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Utc),
                };
                _db.SeasonPrepEvaluations.Add(record);
            }
            else
            {
                record.Data = request.Data;
                record.UpdatedAt = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Utc);
            }

            await _db.SaveChangesAsync(cancellationToken);
            return Unit.Value;
        }
    }
}
