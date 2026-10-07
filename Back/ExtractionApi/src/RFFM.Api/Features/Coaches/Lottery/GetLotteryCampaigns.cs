using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Lottery
{
    /// <summary>
    /// Campañas de lotería del equipo, de la más reciente a la más antigua.
    /// GET /api/teams/{teamId}/lottery-campaigns
    /// See openspec/changes/team-lottery/design.md → D3.
    /// </summary>
    public class GetLotteryCampaigns : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet(LotteryConstants.BaseRoute,
                    async (string teamId, IMediator mediator, CancellationToken ct) =>
                        Results.Ok(await mediator.Send(new Query(teamId), ct)))
                .WithName(nameof(GetLotteryCampaigns))
                .WithTags(LotteryConstants.Tag)
                .RequireAuthorization()
                .Produces<IReadOnlyList<LotteryCampaignSummaryDto>>()
                .ProducesProblem(StatusCodes.Status403Forbidden);
        }

        public record Query(string TeamId) : IQueryApp<IReadOnlyList<LotteryCampaignSummaryDto>>, IRequireFeaturePermission, IRequireTeamMembership
        {
            public string FeatureRoute => CoachFeatureRoutes.Lottery;
            public string RequiredPermission => LotteryConstants.Read;
        }

        public class Handler(AppDbContext db) : IRequestHandler<Query, IReadOnlyList<LotteryCampaignSummaryDto>>
        {
            public async ValueTask<IReadOnlyList<LotteryCampaignSummaryDto>> Handle(Query request, CancellationToken cancellationToken) =>
                await db.LotteryCampaigns
                    .AsNoTracking()
                    .Where(c => c.TeamId == request.TeamId)
                    .OrderByDescending(c => c.DrawDate)
                    .Select(c => new LotteryCampaignSummaryDto(c.Id, c.Name, c.DrawDate))
                    .ToListAsync(cancellationToken);
        }
    }
}
