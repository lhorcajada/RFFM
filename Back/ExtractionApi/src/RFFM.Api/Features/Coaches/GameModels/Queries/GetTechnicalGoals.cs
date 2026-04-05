using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.Domain.Aggregates.Training;
using RFFM.Api.FeatureModules;

namespace RFFM.Api.Features.Coaches.GameModels.Queries
{
    /// <summary>
    /// Returns all available tactical principles (TechnicalGoals catalog).
    /// GET /api/technical-goals
    /// </summary>
    public class GetTechnicalGoals : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/technical-goals",
                    (IMediator mediator, CancellationToken cancellationToken) =>
                        Results.Ok(TacticalGoalsEnum.List()
                            .Select(tg => new TechnicalGoalResponse(tg.Id, tg.Name))
                            .ToArray()))
                .WithName(nameof(GetTechnicalGoals))
                .WithTags(GameModelConstants.Tag)
                .RequireAuthorization()
                .Produces<TechnicalGoalResponse[]>();
        }

        public record TechnicalGoalResponse(int Id, string Name);
    }
}
