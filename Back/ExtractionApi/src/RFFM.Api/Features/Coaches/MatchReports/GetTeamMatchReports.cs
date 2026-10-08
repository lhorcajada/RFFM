using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.MatchReports
{
    public class GetTeamMatchReports : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet(
                    "/api/teams/{teamId}/match-reports",
                    async (string teamId, IMediator mediator, CancellationToken cancellationToken) =>
                        Results.Ok(await mediator.Send(new TeamMatchReportsQuery { TeamId = teamId }, cancellationToken)))
                .WithName(nameof(GetTeamMatchReports))
                .WithTags("MatchReports")
                .Produces<MatchReportAvailability[]>()
                .Produces(StatusCodes.Status403Forbidden);
        }

        public record TeamMatchReportsQuery : IQueryApp<MatchReportAvailability[]>, IRequireFeaturePermission, IRequireTeamMembership
        {
            public string TeamId { get; set; } = null!;

            public string FeatureRoute => CoachFeatureRoutes.Convocations;
            public string RequiredPermission => "Read";
        }

        public record MatchReportAvailability(string EventId, string? CodActa, bool HasLiveReport, bool HasFederationReport);

        public class Handler(AppDbContext db) : IRequestHandler<TeamMatchReportsQuery, MatchReportAvailability[]>
        {
            public async ValueTask<MatchReportAvailability[]> Handle(TeamMatchReportsQuery request, CancellationToken cancellationToken)
            {
                var events = await db.SportEvents
                    .AsNoTracking()
                    .Where(e => e.TeamId == request.TeamId)
                    .OrderBy(e => e.EveDateTime)
                    .Select(e => new
                    {
                        e.Id,
                        e.EventTypeId,
                        e.CodActa,
                        e.LocalGoals,
                        e.VisitorGoals,
                        HasLiveReport = db.MatchParticipations.Any(mp => mp.EventId == e.Id && mp.MatchPhase == MatchReportRules.FinishedPhase)
                    })
                    .ToListAsync(cancellationToken);

                return events
                    .Select(e => new MatchReportAvailability(
                        e.Id,
                        e.CodActa,
                        e.HasLiveReport,
                        MatchReportRules.HasFederationReport(e.EventTypeId, e.CodActa, e.LocalGoals, e.VisitorGoals)))
                    .Where(r => r.HasLiveReport || r.HasFederationReport)
                    .ToArray();
            }
        }
    }
}
