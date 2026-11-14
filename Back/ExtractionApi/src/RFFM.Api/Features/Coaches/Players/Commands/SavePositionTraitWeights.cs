using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.PositionFit;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;
using static RFFM.Api.Features.Coaches.Players.Queries.GetTeamPositionFit;

namespace RFFM.Api.Features.Coaches.Players.Commands
{
    /// <summary>
    /// Replaces the team's trait weights for a position (key, sum or indifferent per trait).
    /// PUT /api/catalog/team/{teamId}/position-fit/{position}/weights
    /// </summary>
    public class SavePositionTraitWeights : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut("/api/catalog/team/{teamId}/position-fit/{position}/weights",
                    [Authorize(Roles = "Coach,Administrator")] async (string teamId, string position, SavePositionTraitWeightsRequest req, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(new SavePositionTraitWeightsCommand(teamId, position, req), cancellationToken);
                        return Results.Ok(result);
                    })
                .WithName(nameof(SavePositionTraitWeights))
                .WithTags(PlayerConstants.PlayerFeature)
                .Produces<PositionFitResponse>()
                .Produces(StatusCodes.Status400BadRequest)
                .Produces(StatusCodes.Status403Forbidden)
                .Produces(StatusCodes.Status404NotFound);
        }

        public record SavePositionTraitWeightsRequest(IReadOnlyDictionary<string, string> Weights);

        public record SavePositionTraitWeightsCommand(string TeamId, string Position, SavePositionTraitWeightsRequest Request)
            : RFFM.Api.Common.ICommand<PositionFitResponse>;

        public class Validator : AbstractValidator<SavePositionTraitWeightsCommand>
        {
            public Validator()
            {
                RuleFor(x => x.TeamId).NotEmpty();
                RuleFor(x => x.Position)
                    .Must(position => FitPositionKeys.TryParse(position).HasValue)
                    .WithMessage("El puesto indicado no existe.");
                RuleFor(x => x.Request.Weights)
                    .NotEmpty()
                    .Must(weights => weights.Keys.All(TraitCatalog.IsKnown))
                    .WithMessage("Algún rasgo indicado no existe.")
                    .Must(weights => weights.Values.All(w => TraitWeightKeys.TryParse(w).HasValue))
                    .WithMessage("El peso debe ser key, sum o indifferent.");
            }
        }

        public class Handler : IRequestHandler<SavePositionTraitWeightsCommand, PositionFitResponse>
        {
            private readonly AppDbContext _db;
            private readonly ICurrentUserService _currentUser;

            public Handler(AppDbContext db, ICurrentUserService currentUser)
            {
                _db = db;
                _currentUser = currentUser;
            }

            public async ValueTask<PositionFitResponse> Handle(SavePositionTraitWeightsCommand request, CancellationToken cancellationToken = default)
            {
                var teamId = await TeamTraitRatingAccess.EnsureCanManageAsync(_db, _currentUser, request.TeamId, cancellationToken);
                var position = FitPositionKeys.TryParse(request.Position)!.Value;

                var existing = await _db.TeamTraitWeights
                    .Where(w => w.TeamId == teamId && w.Position == (int)position)
                    .ToListAsync(cancellationToken);
                _db.TeamTraitWeights.RemoveRange(existing);
                _db.TeamTraitWeights.AddRange(request.Request.Weights
                    .Select(w => TeamTraitWeight.Create(teamId, (int)position, w.Key, w.Value)));
                await _db.SaveChangesAsync(cancellationToken);

                var positionKey = FitPositionKeys.ToKey(position);
                return (await BuildAsync(_db, teamId, useConfirmedOrder: true, cancellationToken))
                    .Single(p => p.Position == positionKey);
            }
        }
    }
}
