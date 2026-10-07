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
    /// Deshace la liquidación con el club.
    /// DELETE /api/teams/{teamId}/lottery-campaigns/{campaignId}/club-delivery
    /// See openspec/changes/team-lottery/design.md → D3.
    /// </summary>
    public class UndoLotteryClubDelivery : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapDelete($"{LotteryConstants.BaseRoute}/{{campaignId}}/club-delivery",
                    async (string teamId, string campaignId, IMediator mediator, CancellationToken ct) =>
                        Results.Ok(await mediator.Send(new Command(teamId, campaignId), ct)))
                .WithName(nameof(UndoLotteryClubDelivery))
                .WithTags(LotteryConstants.Tag)
                .RequireAuthorization()
                .Produces<LotteryCampaignDto>()
                .ProducesProblem(StatusCodes.Status403Forbidden)
                .ProducesProblem(StatusCodes.Status404NotFound);
        }

        public record Command(string TeamId, string CampaignId)
            : RFFM.Api.Common.ICommand<LotteryCampaignDto>, IRequireFeaturePermission, IRequireTeamMembership
        {
            public string FeatureRoute => CoachFeatureRoutes.Lottery;
            public string RequiredPermission => LotteryConstants.ReadWrite;
        }

        public class Handler(AppDbContext db, ICurrentUserService currentUser) : IRequestHandler<Command, LotteryCampaignDto>
        {
            public async ValueTask<LotteryCampaignDto> Handle(Command request, CancellationToken cancellationToken)
            {
                var campaign = await LotteryCampaignMapping.LoadAsync(db, request.TeamId, request.CampaignId, cancellationToken);
                campaign.UndoClubDelivery();
                await db.SaveChangesAsync(cancellationToken);
                return await LotteryCampaignMapping.ToDtoAsync(db, currentUser, campaign, cancellationToken);
            }
        }
    }
}
