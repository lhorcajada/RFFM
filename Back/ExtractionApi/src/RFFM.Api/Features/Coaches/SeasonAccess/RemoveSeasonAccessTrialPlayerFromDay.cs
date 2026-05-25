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
    public class RemoveSeasonAccessTrialPlayerFromDay : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapDelete("/api/catalog/season-access/trial-days/{dayId}/players/{playerId}",
                    [Authorize(Roles = "Coach,Administrator")]
                    async (string dayId, string playerId, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(new RemoveSeasonAccessTrialPlayerFromDayCommand(dayId, playerId), cancellationToken);
                        return Results.Ok(result);
                    })
                .WithName(nameof(RemoveSeasonAccessTrialPlayerFromDay))
                .WithTags("SeasonAccess")
                .Produces<SeasonAccessTrialDto>()
                .Produces(StatusCodes.Status403Forbidden);
        }

        public record RemoveSeasonAccessTrialPlayerFromDayCommand(string DayId, string PlayerId) : RFFM.Api.Common.ICommand<SeasonAccessTrialDto?>;

        public class Validator : AbstractValidator<RemoveSeasonAccessTrialPlayerFromDayCommand>
        {
            public Validator()
            {
                RuleFor(x => x.DayId).NotEmpty();
                RuleFor(x => x.PlayerId).NotEmpty();
            }
        }

        public class Handler : IRequestHandler<RemoveSeasonAccessTrialPlayerFromDayCommand, SeasonAccessTrialDto?>
        {
            private readonly AppDbContext _db;
            private readonly ICurrentUserService _currentUser;

            public Handler(AppDbContext db, ICurrentUserService currentUser)
            {
                _db = db;
                _currentUser = currentUser;
            }

            public async ValueTask<SeasonAccessTrialDto?> Handle(RemoveSeasonAccessTrialPlayerFromDayCommand command, CancellationToken cancellationToken = default)
            {
                var userId = _currentUser.UserId ?? throw new UnauthorizedAccessException("Usuario no autenticado");

                var day = await _db.SeasonAccessTrialDays
                    .Include(d => d.Trial)
                    .FirstOrDefaultAsync(d => d.Id == command.DayId, cancellationToken);

                if (day is null || day.Trial?.ApplicationUserId != userId)
                    return null;

                var player = await _db.SeasonAccessTrialPlayers
                    .FirstOrDefaultAsync(p => p.Id == command.PlayerId && p.TrialId == day.TrialId, cancellationToken);

                if (player is null)
                {
                    var trialNotFound = await _db.SeasonAccessTrials
                        .AsNoTracking()
                        .Include(t => t.Players)
                        .FirstOrDefaultAsync(t => t.ApplicationUserId == userId && t.Id == day.TrialId, cancellationToken);

                    return trialNotFound?.ToDto() ?? null;
                }

                // mark player as removed from the provided day
                player.SetRemovedFromDate(day.Date);

                // find day ids for this trial with date >= current day
                var futureDayIds = await _db.SeasonAccessTrialDays
                    .Where(d => d.TrialId == day.TrialId && d.Date >= day.Date)
                    .Select(d => d.Id)
                    .ToListAsync(cancellationToken);

                // No per-day ratings table anymore: just set the removed date on the
                // player snapshot and persist. Any per-day records are no longer used.
                await _db.SaveChangesAsync(cancellationToken);

                var refreshed = await _db.SeasonAccessTrials
                    .AsNoTracking()
                    .Include(x => x.Players)
                    .FirstOrDefaultAsync(x => x.ApplicationUserId == userId && x.Id == day.TrialId, cancellationToken);

                return refreshed?.ToDto();
            }
        }
    }
}
