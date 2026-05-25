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
    public class GetSeasonPrepAllTeams : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("api/season-prep/all-teams",
                    async (string? sportEventId, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(new GetSeasonPrepAllTeamsQuery(sportEventId), cancellationToken);
                        return result is not null ? Results.Ok(result) : Results.NoContent();
                    })
                .WithName(nameof(GetSeasonPrepAllTeams))
                .WithTags("SeasonPrep")
                .Produces<SeasonPrepAllTeamsDto>(StatusCodes.Status200OK)
                .Produces(StatusCodes.Status204NoContent)
                .RequireAuthorization();
        }
    }

    public record SeasonPrepAllTeamsDto(string Data, DateTime UpdatedAt);

    public record GetSeasonPrepAllTeamsQuery(string? SportEventId) : IRequest<SeasonPrepAllTeamsDto?>;

    public class GetSeasonPrepAllTeamsHandler : IRequestHandler<GetSeasonPrepAllTeamsQuery, SeasonPrepAllTeamsDto?>
    {
        private readonly AppDbContext _db;

        public GetSeasonPrepAllTeamsHandler(AppDbContext db) => _db = db;

        public async ValueTask<SeasonPrepAllTeamsDto?> Handle(GetSeasonPrepAllTeamsQuery request, CancellationToken cancellationToken)
        {
            var session = await _db.SeasonPrepAllTeamsSessions
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.SportEventId == request.SportEventId, cancellationToken);

            if (session is null && request.SportEventId is not null)
            {
                session = await _db.SeasonPrepAllTeamsSessions
                    .AsNoTracking()
                    .FirstOrDefaultAsync(s => s.SportEventId == null, cancellationToken);
            }

            return session is not null ? new SeasonPrepAllTeamsDto(session.Data, session.UpdatedAt) : null;
        }
    }

    public class UpsertSeasonPrepAllTeams : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut("api/season-prep/all-teams",
                    async (UpsertSeasonPrepAllTeamsCommand command, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        await mediator.Send(command, cancellationToken);
                        return Results.NoContent();
                    })
                .WithName(nameof(UpsertSeasonPrepAllTeams))
                .WithTags("SeasonPrep")
                .Produces(StatusCodes.Status204NoContent)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .RequireAuthorization();
        }
    }

    public record UpsertSeasonPrepAllTeamsCommand(string Data, string? SportEventId) : IRequest;

    public class UpsertSeasonPrepAllTeamsHandler : IRequestHandler<UpsertSeasonPrepAllTeamsCommand>
    {
        private readonly AppDbContext _db;

        public UpsertSeasonPrepAllTeamsHandler(AppDbContext db) => _db = db;

        public async ValueTask<Unit> Handle(UpsertSeasonPrepAllTeamsCommand request, CancellationToken cancellationToken)
        {
            var session = await _db.SeasonPrepAllTeamsSessions
                .FirstOrDefaultAsync(s => s.SportEventId == request.SportEventId, cancellationToken);

            if (session is null)
            {
                session = new SeasonPrepAllTeamsSession
                {
                    SportEventId = request.SportEventId,
                    Data = request.Data,
                    UpdatedAt = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Utc),
                };
                _db.SeasonPrepAllTeamsSessions.Add(session);
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

    public class DeleteSeasonPrepAllTeams : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapDelete("api/season-prep/all-teams",
                    async (IMediator mediator, HttpContext httpContext, CancellationToken cancellationToken) =>
                    {
                        var sportEventId = httpContext.Request.Query["sportEventId"].ToString();
                        await mediator.Send(new DeleteSeasonPrepAllTeamsCommand(string.IsNullOrWhiteSpace(sportEventId) ? null : sportEventId), cancellationToken);
                        return Results.NoContent();
                    })
                .WithName(nameof(DeleteSeasonPrepAllTeams))
                .WithTags("SeasonPrep")
                .Produces(StatusCodes.Status204NoContent)
                .RequireAuthorization();
        }
    }

    public record DeleteSeasonPrepAllTeamsCommand(string? SportEventId) : IRequest;

    public class DeleteSeasonPrepAllTeamsHandler : IRequestHandler<DeleteSeasonPrepAllTeamsCommand>
    {
        private readonly AppDbContext _db;

        public DeleteSeasonPrepAllTeamsHandler(AppDbContext db) => _db = db;

        public async ValueTask<Unit> Handle(DeleteSeasonPrepAllTeamsCommand request, CancellationToken cancellationToken)
        {
            var session = await _db.SeasonPrepAllTeamsSessions
                .FirstOrDefaultAsync(s => s.SportEventId == request.SportEventId, cancellationToken);

            if (session is null && request.SportEventId is not null)
            {
                session = await _db.SeasonPrepAllTeamsSessions
                    .FirstOrDefaultAsync(s => s.SportEventId == null, cancellationToken);
            }

            if (session is not null)
            {
                _db.SeasonPrepAllTeamsSessions.Remove(session);
                await _db.SaveChangesAsync(cancellationToken);
            }

            return Unit.Value;
        }
    }
}
