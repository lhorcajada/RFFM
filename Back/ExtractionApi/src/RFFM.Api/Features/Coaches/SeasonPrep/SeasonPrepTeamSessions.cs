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
    public class GetTeamSeasonPrepSession : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("api/season-prep/team/{teamId}/session",
                    async (string teamId, string? sportEventId, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(new GetTeamSeasonPrepQuery(teamId, sportEventId), cancellationToken);
                        return result is not null ? Results.Ok(result) : Results.NoContent();
                    })
                .WithName(nameof(GetTeamSeasonPrepSession))
                .WithTags("SeasonPrep")
                .Produces<SeasonPrepTeamSessionDto>(StatusCodes.Status200OK)
                .Produces(StatusCodes.Status204NoContent)
                .RequireAuthorization();
        }
    }

    public record SeasonPrepTeamSessionDto(string Data, DateTime UpdatedAt);

    public record GetTeamSeasonPrepQuery(string TeamId, string? SportEventId) : IRequest<SeasonPrepTeamSessionDto?>;

    public class GetTeamSeasonPrepHandler : IRequestHandler<GetTeamSeasonPrepQuery, SeasonPrepTeamSessionDto?>
    {
        private readonly AppDbContext _db;

        public GetTeamSeasonPrepHandler(AppDbContext db) => _db = db;

        public async ValueTask<SeasonPrepTeamSessionDto?> Handle(GetTeamSeasonPrepQuery request, CancellationToken cancellationToken)
        {
            var session = await _db.SeasonPrepTeamSessions
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.TeamId == request.TeamId && s.SportEventId == request.SportEventId, cancellationToken);

            if (session is null && request.SportEventId is not null)
            {
                session = await _db.SeasonPrepTeamSessions
                    .AsNoTracking()
                    .FirstOrDefaultAsync(s => s.TeamId == request.TeamId && s.SportEventId == null, cancellationToken);
            }

            return session is not null ? new SeasonPrepTeamSessionDto(session.Data, session.UpdatedAt) : null;
        }
    }

    public class UpsertTeamSeasonPrepSession : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut("api/season-prep/team/{teamId}/session",
                    async (string teamId, UpsertTeamSeasonPrepCommand command, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        await mediator.Send(command with { TeamId = teamId }, cancellationToken);
                        return Results.NoContent();
                    })
                .WithName(nameof(UpsertTeamSeasonPrepSession))
                .WithTags("SeasonPrep")
                .Produces(StatusCodes.Status204NoContent)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .RequireAuthorization();
        }
    }

    public record UpsertTeamSeasonPrepCommand(string Data, string? SportEventId, string TeamId = "") : IRequest;

    public class UpsertTeamSeasonPrepHandler : IRequestHandler<UpsertTeamSeasonPrepCommand>
    {
        private readonly AppDbContext _db;

        public UpsertTeamSeasonPrepHandler(AppDbContext db) => _db = db;

        public async ValueTask<Unit> Handle(UpsertTeamSeasonPrepCommand request, CancellationToken cancellationToken)
        {
            var session = await _db.SeasonPrepTeamSessions
                .FirstOrDefaultAsync(s => s.TeamId == request.TeamId && s.SportEventId == request.SportEventId, cancellationToken);

            if (session is null)
            {
                session = new SeasonPrepTeamSession
                {
                    TeamId = request.TeamId,
                    SportEventId = request.SportEventId,
                    Data = request.Data,
                    UpdatedAt = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Utc),
                };
                _db.SeasonPrepTeamSessions.Add(session);
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

    public class DeleteTeamSeasonPrepSession : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapDelete("api/season-prep/team/{teamId}/session",
                    async (string teamId, IMediator mediator, HttpContext httpContext, CancellationToken cancellationToken) =>
                    {
                        var sportEventId = httpContext.Request.Query["sportEventId"].ToString();
                        await mediator.Send(new DeleteTeamSeasonPrepCommand(teamId, string.IsNullOrWhiteSpace(sportEventId) ? null : sportEventId), cancellationToken);
                        return Results.NoContent();
                    })
                .WithName(nameof(DeleteTeamSeasonPrepSession))
                .WithTags("SeasonPrep")
                .Produces(StatusCodes.Status204NoContent)
                .RequireAuthorization();
        }
    }

    public record DeleteTeamSeasonPrepCommand(string TeamId, string? SportEventId) : IRequest;

    public class DeleteTeamSeasonPrepHandler : IRequestHandler<DeleteTeamSeasonPrepCommand>
    {
        private readonly AppDbContext _db;

        public DeleteTeamSeasonPrepHandler(AppDbContext db) => _db = db;

        public async ValueTask<Unit> Handle(DeleteTeamSeasonPrepCommand request, CancellationToken cancellationToken)
        {
            var session = await _db.SeasonPrepTeamSessions
                .FirstOrDefaultAsync(s => s.TeamId == request.TeamId && s.SportEventId == request.SportEventId, cancellationToken);

            if (session is null && request.SportEventId is not null)
            {
                session = await _db.SeasonPrepTeamSessions
                    .FirstOrDefaultAsync(s => s.TeamId == request.TeamId && s.SportEventId == null, cancellationToken);
            }

            if (session is not null)
            {
                _db.SeasonPrepTeamSessions.Remove(session);
                await _db.SaveChangesAsync(cancellationToken);
            }

            return Unit.Value;
        }
    }
}
