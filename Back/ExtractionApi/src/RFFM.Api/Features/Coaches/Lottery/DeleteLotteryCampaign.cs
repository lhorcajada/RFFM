using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.Common;
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Lottery
{
    /// <summary>
    /// Elimina una campaña sin tacos.
    /// DELETE /api/teams/{teamId}/lottery-campaigns/{campaignId}
    /// See openspec/changes/team-lottery/design.md → D3.
    /// </summary>
    public class DeleteLotteryCampaign : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapDelete($"{LotteryConstants.BaseRoute}/{{campaignId}}",
                    async (string teamId, string campaignId, IMediator mediator, CancellationToken ct) =>
                    {
                        await mediator.Send(new Command(teamId, campaignId), ct);
                        return Results.NoContent();
                    })
                .WithName(nameof(DeleteLotteryCampaign))
                .WithTags(LotteryConstants.Tag)
                .RequireAuthorization()
                .Produces(StatusCodes.Status204NoContent)
                .ProducesProblem(StatusCodes.Status400BadRequest)
                .ProducesProblem(StatusCodes.Status403Forbidden)
                .ProducesProblem(StatusCodes.Status404NotFound);
        }

        public record Command(string TeamId, string CampaignId) : RFFM.Api.Common.ICommand, IRequireFeaturePermission, IRequireTeamMembership
        {
            public string FeatureRoute => CoachFeatureRoutes.Lottery;
            public string RequiredPermission => LotteryConstants.ReadWrite;
        }

        public class Handler(AppDbContext db) : IRequestHandler<Command>
        {
            public async ValueTask<Unit> Handle(Command request, CancellationToken cancellationToken)
            {
                var campaign = await LotteryCampaignMapping.LoadAsync(db, request.TeamId, request.CampaignId, cancellationToken);
                campaign.EnsureCanBeDeleted();
                db.LotteryCampaigns.Remove(campaign);
                await db.SaveChangesAsync(cancellationToken);
                return Unit.Value;
            }
        }
    }
}
