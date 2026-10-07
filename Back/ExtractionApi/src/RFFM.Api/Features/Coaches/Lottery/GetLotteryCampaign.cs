using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.Common;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Lottery
{
    /// <summary>
    /// Detalle de la campaña con sus tacos y totales. Player y FamilyMember solo reciben los suyos.
    /// GET /api/teams/{teamId}/lottery-campaigns/{campaignId}
    /// See openspec/changes/team-lottery/design.md → D3.
    /// </summary>
    public class GetLotteryCampaign : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet($"{LotteryConstants.BaseRoute}/{{campaignId}}",
                    async (string teamId, string campaignId, IMediator mediator, CancellationToken ct) =>
                        Results.Ok(await mediator.Send(new Query(teamId, campaignId), ct)))
                .WithName(nameof(GetLotteryCampaign))
                .WithTags(LotteryConstants.Tag)
                .RequireAuthorization()
                .Produces<LotteryCampaignDto>()
                .ProducesProblem(StatusCodes.Status403Forbidden)
                .ProducesProblem(StatusCodes.Status404NotFound);
        }

        public record Query(string TeamId, string CampaignId) : IQueryApp<LotteryCampaignDto>, IRequireFeaturePermission, IRequireTeamMembership
        {
            public string FeatureRoute => CoachFeatureRoutes.Lottery;
            public string RequiredPermission => LotteryConstants.Read;
        }

        public class Handler(AppDbContext db, ICurrentUserService currentUser) : IRequestHandler<Query, LotteryCampaignDto>
        {
            public async ValueTask<LotteryCampaignDto> Handle(Query request, CancellationToken cancellationToken)
            {
                var campaign = await LotteryCampaignMapping.LoadAsync(db, request.TeamId, request.CampaignId, cancellationToken, tracking: false);
                return await LotteryCampaignMapping.ToDtoAsync(db, currentUser, campaign, cancellationToken);
            }
        }
    }
}
