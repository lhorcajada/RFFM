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
    public class UpsertSeasonAccessTrialDayRating : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/catalog/season-access/trial-days/{dayId}/ratings",
                    [Authorize(Roles = "Coach,Administrator")]
                    async (string dayId, UpsertSeasonAccessTrialDayRatingRequest request, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(new UpsertSeasonAccessTrialDayRatingCommand(dayId, request), cancellationToken);
                        return result is null ? Results.NotFound() : Results.Ok(result);
                    })
                .WithName(nameof(UpsertSeasonAccessTrialDayRating))
                .WithTags("SeasonAccess")
                .Produces<SeasonAccessTrialDayRatingDto>()
                .Produces(StatusCodes.Status404NotFound)
                .Produces(StatusCodes.Status403Forbidden);
        }

        public record UpsertSeasonAccessTrialDayRatingCommand(string DayId, UpsertSeasonAccessTrialDayRatingRequest Request) : RFFM.Api.Common.ICommand<SeasonAccessTrialDayRatingDto?>;

        public class Validator : AbstractValidator<UpsertSeasonAccessTrialDayRatingCommand>
        {
            public Validator()
            {
                RuleFor(x => x.DayId).NotEmpty();
                RuleFor(x => x.Request.TrialPlayerId).NotEmpty();
                RuleFor(x => x.Request.Score).InclusiveBetween(0, 100).When(x => x.Request.Score.HasValue);
                    RuleFor(x => x.Request.TotalGoals).GreaterThanOrEqualTo(0).When(x => x.Request.TotalGoals.HasValue);
            }
        }

        public class Handler : IRequestHandler<UpsertSeasonAccessTrialDayRatingCommand, SeasonAccessTrialDayRatingDto?>
        {
            private readonly AppDbContext _db;
            private readonly ICurrentUserService _currentUser;

            public Handler(AppDbContext db, ICurrentUserService currentUser)
            {
                _db = db;
                _currentUser = currentUser;
            }

            public async ValueTask<SeasonAccessTrialDayRatingDto?> Handle(UpsertSeasonAccessTrialDayRatingCommand command, CancellationToken cancellationToken = default)
            {
                var userId = _currentUser.UserId ?? throw new UnauthorizedAccessException("Usuario no autenticado");

                var day = await _db.SeasonAccessTrialDays
                    .Include(x => x.Trial)
                    .FirstOrDefaultAsync(x => x.Id == command.DayId, cancellationToken);

                if (day is null || day.Trial?.ApplicationUserId != userId)
                    return null;

                var rating = await _db.SeasonAccessTrialDayRatings
                    .FirstOrDefaultAsync(
                        x => x.TrialDayId == command.DayId && x.TrialPlayerId == command.Request.TrialPlayerId,
                        cancellationToken);

                if (rating is null)
                {
                    rating = SeasonAccessTrialDayRating.Create(
                        command.DayId,
                        command.Request.TrialPlayerId,
                        command.Request.Score,
                        command.Request.Notes,
                        command.Request.Status,
                        command.Request.IdealDemarcationId,
                        command.Request.PossibleDemarcationIds,
                        command.Request.TotalGoals);
                    _db.SeasonAccessTrialDayRatings.Add(rating);
                }
                else
                {
                    rating.Update(command.Request.Score, command.Request.Notes, command.Request.Status,
                        command.Request.IdealDemarcationId, command.Request.PossibleDemarcationIds, command.Request.TotalGoals);
                }

                await _db.SaveChangesAsync(cancellationToken);

                return rating.ToDto();
            }
        }
    }
}
