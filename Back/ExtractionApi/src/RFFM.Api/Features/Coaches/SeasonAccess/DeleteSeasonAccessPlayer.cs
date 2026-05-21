using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.SeasonAccess
{
    public class DeleteSeasonAccessPlayer : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapDelete("/api/catalog/season-access/players/{playerCode}",
                    [Authorize(Roles = "Coach,Administrator")]
                    async (string playerCode, string seasonId, string category, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(new DeleteSeasonAccessPlayerCommand(playerCode, seasonId, category), cancellationToken);
                        return Results.Ok(result);
                    })
                .WithName(nameof(DeleteSeasonAccessPlayer))
                .WithTags("SeasonAccess")
                .Produces<SeasonAccessTrialDto>()
                .Produces(StatusCodes.Status403Forbidden);
        }

        public record DeleteSeasonAccessPlayerCommand(string PlayerCode, string SeasonId, string Category) : RFFM.Api.Common.ICommand<SeasonAccessTrialDto?>;

        public class Validator : AbstractValidator<DeleteSeasonAccessPlayerCommand>
        {
            public Validator()
            {
                RuleFor(x => x.PlayerCode).NotEmpty();
                RuleFor(x => x.SeasonId).NotEmpty();
                RuleFor(x => x.Category).NotEmpty();
            }
        }

        public class Handler : IRequestHandler<DeleteSeasonAccessPlayerCommand, SeasonAccessTrialDto?>
        {
            private readonly AppDbContext _db;
            private readonly ICurrentUserService _currentUser;

            public Handler(AppDbContext db, ICurrentUserService currentUser)
            {
                _db = db;
                _currentUser = currentUser;
            }

            public async ValueTask<SeasonAccessTrialDto?> Handle(DeleteSeasonAccessPlayerCommand command, CancellationToken cancellationToken = default)
            {
                var userId = _currentUser.UserId ?? throw new UnauthorizedAccessException("Usuario no autenticado");

                var trial = await _db.SeasonAccessTrials
                    .Include(x => x.Players)
                    .FirstOrDefaultAsync(
                        x => x.ApplicationUserId == userId && x.SeasonId == command.SeasonId && x.Category == command.Category,
                        cancellationToken);

                if (trial is null)
                    return null;

                var player = trial.Players.FirstOrDefault(x => x.FederationPlayerCode == command.PlayerCode);
                if (player is null)
                    return trial.ToDto();

                trial.Players.Remove(player);
                _db.SeasonAccessTrialPlayers.Remove(player);

                if (trial.Players.Count == 0)
                {
                    _db.SeasonAccessTrials.Remove(trial);
                    await _db.SaveChangesAsync(cancellationToken);
                    return new SeasonAccessTrialDto(string.Empty, command.SeasonId, command.Category, Array.Empty<SeasonAccessPlayerDto>());
                }

                await _db.SaveChangesAsync(cancellationToken);

                var refreshed = await _db.SeasonAccessTrials
                    .AsNoTracking()
                    .Include(x => x.Players)
                    .FirstAsync(
                        x => x.ApplicationUserId == userId && x.SeasonId == command.SeasonId && x.Category == command.Category,
                        cancellationToken);

                return refreshed.ToDto();
            }
        }
    }
}