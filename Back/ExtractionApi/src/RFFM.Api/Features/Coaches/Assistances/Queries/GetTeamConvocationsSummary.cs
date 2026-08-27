using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Assistances.Queries
{
    /// <summary>
    /// Returns every convocation across all of a team's events in a single call,
    /// avoiding one HTTP round-trip per event.
    /// </summary>
    public class GetTeamConvocationsSummary : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet(
                    "/api/attendance/team-convocations/{teamId}",
                    [Authorize] async (
                        string teamId,
                        IMediator mediator,
                        CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(new Query { TeamId = teamId }, cancellationToken);
                        return Results.Ok(result);
                    })
                .WithName(nameof(GetTeamConvocationsSummary))
                .WithTags("Assistances")
                .Produces<ConvocationRow[]>();
        }

        public record Query : Common.IQueryApp<ConvocationRow[]>, IRequireFeaturePermission
        {
            public string TeamId { get; init; } = null!;

            public string FeatureRoute => CoachFeatureRoutes.AttendanceSummary;
            public string RequiredPermission => "Read";
        }

        public record ConvocationRow(
            string EventId,
            string ConvocationId,
            string TeamPlayerId,
            string? PlayerId,
            string Alias,
            int? StatusId,
            int? ExcuseTypeId,
            int? AssistanceTypeId);

        public class Handler : IRequestHandler<Query, ConvocationRow[]>
        {
            private readonly AppDbContext _db;

            public Handler(AppDbContext db) => _db = db;

            public async ValueTask<ConvocationRow[]> Handle(Query request, CancellationToken cancellationToken = default)
            {
                return await _db.Convocations
                    .AsNoTracking()
                    .Where(c => c.Player.TeamId == request.TeamId)
                    .Select(c => new ConvocationRow(
                        c.SportEventId,
                        c.Id,
                        c.TeamPlayerId,
                        c.Player.PlayerId,
                        c.Player.Player.Alias,
                        c.ConvocationStatusId,
                        c.ExcuseTypeId,
                        c.AssistanceTypeId))
                    .ToArrayAsync(cancellationToken);
            }
        }
    }
}
