using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain.Entities.SeasonAccess;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.SeasonAccess
{
    public class UpsertSeasonAccessPlayer : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/catalog/season-access/players",
                    [Authorize(Roles = "Coach,Administrator")]
                    async (UpsertSeasonAccessPlayerRequest request, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(new UpsertSeasonAccessPlayerCommand(request), cancellationToken);
                        return Results.Ok(result);
                    })
                .WithName(nameof(UpsertSeasonAccessPlayer))
                .WithTags("SeasonAccess")
                .Produces<SeasonAccessTrialDto>()
                .Produces(StatusCodes.Status403Forbidden);
        }

        public record UpsertSeasonAccessPlayerCommand(UpsertSeasonAccessPlayerRequest Request) : RFFM.Api.Common.ICommand<SeasonAccessTrialDto?>;

        public class Validator : AbstractValidator<UpsertSeasonAccessPlayerCommand>
        {
            public Validator()
            {
                RuleFor(x => x.Request.SeasonId).NotEmpty();
                RuleFor(x => x.Request.Category).NotEmpty();
                RuleFor(x => x.Request.FederationPlayerCode).NotEmpty();
                RuleFor(x => x.Request.PlayerName).NotEmpty();
                RuleFor(x => x.Request.TeamCode).NotEmpty();
                RuleFor(x => x.Request.TeamName).NotEmpty();
            }
        }

        public class Handler : IRequestHandler<UpsertSeasonAccessPlayerCommand, SeasonAccessTrialDto?>
        {
            private readonly AppDbContext _db;
            private readonly ICurrentUserService _currentUser;

            public Handler(AppDbContext db, ICurrentUserService currentUser)
            {
                _db = db;
                _currentUser = currentUser;
            }

            public async ValueTask<SeasonAccessTrialDto?> Handle(UpsertSeasonAccessPlayerCommand command, CancellationToken cancellationToken = default)
            {
                var userId = _currentUser.UserId ?? throw new UnauthorizedAccessException("Usuario no autenticado");
                var request = command.Request;

                var trial = await _db.SeasonAccessTrials
                    .Include(x => x.Players)
                    .FirstOrDefaultAsync(
                        x => x.ApplicationUserId == userId && x.SeasonId == request.SeasonId && x.Category == request.Category,
                        cancellationToken);

                if (trial is null)
                {
                    trial = SeasonAccessTrial.Create(userId, request.SeasonId, request.Category);
                    _db.SeasonAccessTrials.Add(trial);
                    await _db.SaveChangesAsync(cancellationToken);
                }

                var player = trial.Players.FirstOrDefault(x => x.FederationPlayerCode == request.FederationPlayerCode);
                if (player is null)
                {
                    player = SeasonAccessTrialPlayer.Create(
                        trial.Id,
                        request.FederationPlayerCode,
                        request.PlayerName,
                        request.TeamCode,
                        request.TeamName,
                        request.Category,
                        request.BirthYear,
                        request.PossibleDemarcationIds,
                        request.IdealDemarcationId,
                        request.TotalGoals);

                    trial.Players.Add(player);
                    _db.SeasonAccessTrialPlayers.Add(player);
                }
                else
                {
                    player.Update(
                        trial.Id,
                        request.FederationPlayerCode,
                        request.PlayerName,
                        request.TeamCode,
                        request.TeamName,
                        request.Category,
                        request.BirthYear,
                        request.PossibleDemarcationIds,
                        request.IdealDemarcationId,
                        request.TotalGoals);
                }

                await _db.SaveChangesAsync(cancellationToken);

                var refreshed = await _db.SeasonAccessTrials
                    .AsNoTracking()
                    .Include(x => x.Players)
                    .FirstAsync(
                        x => x.ApplicationUserId == userId && x.SeasonId == request.SeasonId && x.Category == request.Category,
                        cancellationToken);

                return refreshed.ToDto();
            }
        }
    }
}