using System.Security.Claims;
using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using RFFM.Api.Common;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Entities.Federation.LeagueSquadStats;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Federation.LeagueSquadStats.Services;
using RFFM.Api.Features.Federation.Seasons.Services;
using RFFM.Api.Infrastructure.Options;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.RivalStats
{
    public record RivalStatsStatusResponse(string Status, int TotalPlayers, int ProcessedPlayers, int FailedPlayers,
        DateTime? CompletedAt, DateTime? NextRefreshAllowedAt, string? ErrorMessage)
    {
        public static RivalStatsStatusResponse From(LeagueSquadStatsReport report, TimeSpan minRefreshInterval) => new(
            report.Status.Name, report.TotalPlayers, report.ProcessedPlayers, report.FailedPlayers,
            report.CompletedAt, report.NextRefreshAllowedAt(minRefreshInterval), report.ErrorMessage);
    }

    /// <summary>
    /// POST /api/teams/{teamId}/rival-stats/requests — pide generar (o actualizar) las estadísticas de las
    /// plantillas de la liga del equipo. 202 si queda en curso; 200 si ya están listas y no se actualizan.
    /// </summary>
    public class RequestRivalStats : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/teams/{teamId}/rival-stats/requests",
                    async (string teamId, RequestRivalStatsBody body, IMediator mediator, HttpContext httpContext,
                        CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                                     ?? throw new UnauthorizedAccessException("Usuario no autenticado");

                        var result = await mediator.Send(new RequestRivalStatsCommand(teamId, body.Refresh, userId), cancellationToken);

                        var isInProgress = result.Status == LeagueSquadStatsStatus.Pending.Name ||
                                           result.Status == LeagueSquadStatsStatus.Running.Name;
                        return isInProgress ? Results.Accepted(value: result) : Results.Ok(result);
                    })
                .WithName(nameof(RequestRivalStats))
                .WithTags(RivalStatsConstants.Feature)
                .Produces<RivalStatsStatusResponse>(StatusCodes.Status200OK)
                .Produces<RivalStatsStatusResponse>(StatusCodes.Status202Accepted)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound)
                .Produces<ProblemDetails>(StatusCodes.Status409Conflict)
                .RequireAuthorization();
        }

        public record RequestRivalStatsBody(bool Refresh);

        public record RequestRivalStatsCommand(string TeamId, bool Refresh, string UserId)
            : Common.ICommand<RivalStatsStatusResponse>, IRequireFeaturePermission, IRequireTeamMembership
        {
            public string FeatureRoute => CoachFeatureRoutes.Convocations;
            public string RequiredPermission => "Read";
        }

        public class Validator : AbstractValidator<RequestRivalStatsCommand>
        {
            public Validator()
            {
                RuleFor(x => x.TeamId).NotEmpty();
                RuleFor(x => x.UserId).NotEmpty();
            }
        }

        public class Handler(
            AppDbContext appDb,
            FederationDbContext db,
            ILeagueSquadStatsQueue queue,
            IOptions<RffmOptions> rffmOptions,
            TimeProvider timeProvider) : IRequestHandler<RequestRivalStatsCommand, RivalStatsStatusResponse>
        {
            private TimeSpan MinRefreshInterval => TimeSpan.FromMinutes(rffmOptions.Value.LeagueSquadStats.MinRefreshMinutes);

            public async ValueTask<RivalStatsStatusResponse> Handle(RequestRivalStatsCommand request, CancellationToken cancellationToken)
            {
                var league = await RivalStatsLeague.ResolveAsync(appDb, request.TeamId, rffmOptions.Value, cancellationToken);
                var now = timeProvider.GetUtcNow().UtcDateTime;

                var existing = await FindAsync(league, cancellationToken);
                if (existing != null)
                    return await HandleExistingAsync(existing, request, now, cancellationToken);

                var created = LeagueSquadStatsReport.Create(league.SeasonId,
                    RffmSeasons.Previous(rffmOptions.Value, league.SeasonId), league.CompetitionCode, league.GroupCode, now);
                created.Subscribe(request.UserId, request.TeamId);
                db.LeagueSquadStatsReports.Add(created);
                try
                {
                    await db.SaveChangesAsync(cancellationToken);
                }
                catch (DbUpdateException)
                {
                    // Otra petición concurrente creó el informe (índice único temporada+competición+grupo).
                    db.Entry(created).State = EntityState.Detached;
                    existing = await FindAsync(league, cancellationToken)
                               ?? throw new InvalidOperationException("No se pudo crear el informe de estadísticas de la liga.");
                    return await HandleExistingAsync(existing, request, now, cancellationToken);
                }

                await queue.EnqueueAsync(created.Id, cancellationToken);
                return RivalStatsStatusResponse.From(created, MinRefreshInterval);
            }

            private async Task<RivalStatsStatusResponse> HandleExistingAsync(LeagueSquadStatsReport report,
                RequestRivalStatsCommand request, DateTime now, CancellationToken cancellationToken)
            {
                if (report.IsInProgress)
                {
                    report.Subscribe(request.UserId, request.TeamId);
                    await db.SaveChangesAsync(cancellationToken);
                    return RivalStatsStatusResponse.From(report, MinRefreshInterval);
                }

                var isReadyToView = report.Status == LeagueSquadStatsStatus.Completed && !request.Refresh;
                if (isReadyToView || !report.CanRefresh(now, MinRefreshInterval))
                    return RivalStatsStatusResponse.From(report, MinRefreshInterval);

                report.RequestRefresh(now);
                report.Subscribe(request.UserId, request.TeamId);
                await db.SaveChangesAsync(cancellationToken);
                await queue.EnqueueAsync(report.Id, cancellationToken);
                return RivalStatsStatusResponse.From(report, MinRefreshInterval);
            }

            private Task<LeagueSquadStatsReport?> FindAsync(RivalStatsLeague league, CancellationToken cancellationToken) =>
                db.LeagueSquadStatsReports
                    .Include(r => r.Subscribers)
                    .SingleOrDefaultAsync(r => r.SeasonId == league.SeasonId && r.CompetitionCode == league.CompetitionCode &&
                                               r.GroupCode == league.GroupCode, cancellationToken);
        }
    }
}
