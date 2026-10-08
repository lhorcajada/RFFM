using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using RFFM.Api.Common;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Federation.Teams.Models;
using RFFM.Api.Features.Federation.Teams.Services;
using RFFM.Api.Infrastructure.Options;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.MatchReports
{
    public class GetEventFederationActa : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet(
                    "/api/events/{eventId}/federation-acta",
                    async (string eventId, AppDbContext db, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var teamId = await db.SportEvents.AsNoTracking()
                            .Where(se => se.Id == eventId)
                            .Select(se => se.TeamId)
                            .FirstOrDefaultAsync(cancellationToken);
                        if (teamId is null)
                            throw new NotFoundException("Evento no encontrado", ErrorCodes.EventNotFound);

                        return Results.Ok(await mediator.Send(new EventFederationActaQuery { EventId = eventId, TeamId = teamId }, cancellationToken));
                    })
                .WithName(nameof(GetEventFederationActa))
                .WithTags("MatchReports")
                .Produces<MatchRffm>()
                .Produces(StatusCodes.Status403Forbidden)
                .Produces(StatusCodes.Status404NotFound);
        }

        public record EventFederationActaQuery : IQueryApp<MatchRffm>, IRequireFeaturePermission, IRequireTeamMembership
        {
            public string EventId { get; init; } = null!;
            public string TeamId { get; set; } = null!;

            public string FeatureRoute => CoachFeatureRoutes.Convocations;
            public string RequiredPermission => "Read";
        }

        public class Handler(AppDbContext db, IActaService actaService, IOptions<RffmOptions> rffmOptions)
            : IRequestHandler<EventFederationActaQuery, MatchRffm>
        {
            public async ValueTask<MatchRffm> Handle(EventFederationActaQuery request, CancellationToken cancellationToken)
            {
                var sportEvent = await db.SportEvents
                    .AsNoTracking()
                    .Where(se => se.Id == request.EventId)
                    .Select(se => new
                    {
                        se.EventTypeId,
                        se.CodActa,
                        se.LocalGoals,
                        se.VisitorGoals,
                        CompetitionId = se.Team != null ? se.Team.RffmCompetitionId : null,
                        GroupId = se.Team != null ? se.Team.RffmGroupId : null
                    })
                    .SingleAsync(cancellationToken);

                var hasFederationReport = MatchReportRules.HasFederationReport(
                    sportEvent.EventTypeId, sportEvent.CodActa, sportEvent.LocalGoals, sportEvent.VisitorGoals);
                if (!hasFederationReport || sportEvent.CompetitionId is null || sportEvent.GroupId is null)
                    throw NotAvailable();

                var acta = await actaService.GetMatchFromActaAsync(
                    sportEvent.CodActa!,
                    rffmOptions.Value.CurrentSeasonId,
                    sportEvent.CompetitionId.Value,
                    sportEvent.GroupId.Value,
                    cancellationToken);

                return acta ?? throw NotAvailable();
            }

            private static NotFoundException NotAvailable()
                => new("El acta de federación no está disponible", ErrorCodes.FederationActaNotAvailable);
        }
    }
}
