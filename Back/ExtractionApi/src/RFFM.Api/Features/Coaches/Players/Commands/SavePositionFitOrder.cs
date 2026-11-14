using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.PositionFit;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;
using static RFFM.Api.Features.Coaches.Players.Queries.GetTeamPositionFit;

namespace RFFM.Api.Features.Coaches.Players.Commands
{
    /// <summary>
    /// Stores the order of the candidates of a position confirmed by the coach for the current week.
    /// PUT /api/catalog/team/{teamId}/position-fit/{position}
    /// </summary>
    public class SavePositionFitOrder : IFeatureModule
    {
        public const int MaxPlayers = 100;

        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut("/api/catalog/team/{teamId}/position-fit/{position}",
                    [Authorize(Roles = "Coach,Administrator")] async (string teamId, string position, SavePositionFitOrderRequest req, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(new SavePositionFitOrderCommand(teamId, position, req), cancellationToken);
                        return Results.Ok(result);
                    })
                .WithName(nameof(SavePositionFitOrder))
                .WithTags(PlayerConstants.PlayerFeature)
                .Produces<PositionFitResponse>()
                .Produces(StatusCodes.Status400BadRequest)
                .Produces(StatusCodes.Status403Forbidden)
                .Produces(StatusCodes.Status404NotFound);
        }

        public record SavePositionFitOrderRequest(IReadOnlyList<string> TeamPlayerIds);

        public record SavePositionFitOrderCommand(string TeamId, string Position, SavePositionFitOrderRequest Request)
            : RFFM.Api.Common.ICommand<PositionFitResponse>;

        public class Validator : AbstractValidator<SavePositionFitOrderCommand>
        {
            public Validator()
            {
                RuleFor(x => x.TeamId).NotEmpty();
                RuleFor(x => x.Position)
                    .Must(position => FitPositionKeys.TryParse(position).HasValue)
                    .WithMessage("El puesto indicado no existe.");
                RuleFor(x => x.Request.TeamPlayerIds)
                    .NotEmpty()
                    .Must(ids => ids.Count <= MaxPlayers)
                    .WithMessage($"No se pueden ordenar más de {MaxPlayers} jugadores.")
                    .Must(ids => ids.Distinct().Count() == ids.Count)
                    .WithMessage("Cada jugador solo puede aparecer una vez.");
                RuleForEach(x => x.Request.TeamPlayerIds).NotEmpty();
            }
        }

        public class Handler : IRequestHandler<SavePositionFitOrderCommand, PositionFitResponse>
        {
            private readonly AppDbContext _db;
            private readonly ICurrentUserService _currentUser;

            public Handler(AppDbContext db, ICurrentUserService currentUser)
            {
                _db = db;
                _currentUser = currentUser;
            }

            public async ValueTask<PositionFitResponse> Handle(SavePositionFitOrderCommand request, CancellationToken cancellationToken = default)
            {
                var teamId = await TeamTraitRatingAccess.EnsureCanManageAsync(_db, _currentUser, request.TeamId, cancellationToken);
                var position = FitPositionKeys.TryParse(request.Position)
                               ?? throw new DomainException("Encaje", "El puesto indicado no existe.", ErrorCodes.PositionFitPlayerNotCandidate);
                var positionKey = FitPositionKeys.ToKey(position);

                var proposed = (await BuildAsync(_db, teamId, useConfirmedOrder: false, cancellationToken))
                    .Single(p => p.Position == positionKey);
                var candidateIds = proposed.Candidates.Select(c => c.TeamPlayerId).ToHashSet();
                var allAreCandidates = request.Request.TeamPlayerIds.All(candidateIds.Contains);
                if (!allAreCandidates)
                    throw new DomainException("Encaje", "Algún jugador no es candidato de este puesto.", ErrorCodes.PositionFitPlayerNotCandidate);

                var proposedCandidates = proposed.Candidates
                    .Select(c => new FitCandidate(c.TeamPlayerId, c.Name, c.Fit, c.Trend))
                    .ToList();
                var isManual = PositionFitOrdering.IsManual(proposedCandidates, request.Request.TeamPlayerIds);

                var weekStart = CurrentWeekStart();
                var existing = await _db.TeamPositionFitOrders
                    .Where(o => o.TeamId == teamId && o.Position == (int)position && o.WeekStart == weekStart)
                    .FirstOrDefaultAsync(cancellationToken);
                if (existing is not null)
                    _db.TeamPositionFitOrders.Remove(existing);

                _db.TeamPositionFitOrders.Add(TeamPositionFitOrder.Create(
                    teamId, (int)position, weekStart, request.Request.TeamPlayerIds, isManual));
                await _db.SaveChangesAsync(cancellationToken);

                return (await BuildAsync(_db, teamId, useConfirmedOrder: true, cancellationToken))
                    .Single(p => p.Position == positionKey);
            }

            private static DateTime CurrentWeekStart()
            {
                var today = DateTime.UtcNow.Date;
                var daysSinceMonday = ((int)today.DayOfWeek + 6) % 7;
                return today.AddDays(-daysSinceMonday);
            }
        }
    }
}
