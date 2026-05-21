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
    public class GetSeasonAccessTrialDayRatings : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/catalog/season-access/trial-days/{dayId}/ratings",
                    [Authorize(Roles = "Coach,Administrator")]
                    async (string dayId, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(new GetSeasonAccessTrialDayRatingsQuery(dayId), cancellationToken);
                        return result is null ? Results.NotFound() : Results.Ok(result);
                    })
                .WithName(nameof(GetSeasonAccessTrialDayRatings))
                .WithTags("SeasonAccess")
                .Produces<IReadOnlyCollection<SeasonAccessTrialDayRatingDto>>()
                .Produces(StatusCodes.Status404NotFound)
                .Produces(StatusCodes.Status403Forbidden);
        }

        public record GetSeasonAccessTrialDayRatingsQuery(string DayId) : IQueryApp<IReadOnlyCollection<SeasonAccessTrialDayRatingDto>?>;

        public class Validator : AbstractValidator<GetSeasonAccessTrialDayRatingsQuery>
        {
            public Validator()
            {
                RuleFor(x => x.DayId).NotEmpty();
            }
        }

        public class Handler : IRequestHandler<GetSeasonAccessTrialDayRatingsQuery, IReadOnlyCollection<SeasonAccessTrialDayRatingDto>?>
        {
            private readonly AppDbContext _db;
            private readonly ICurrentUserService _currentUser;

            public Handler(AppDbContext db, ICurrentUserService currentUser)
            {
                _db = db;
                _currentUser = currentUser;
            }

            public async ValueTask<IReadOnlyCollection<SeasonAccessTrialDayRatingDto>?> Handle(GetSeasonAccessTrialDayRatingsQuery request, CancellationToken cancellationToken = default)
            {
                var userId = _currentUser.UserId ?? throw new UnauthorizedAccessException("Usuario no autenticado");

                var day = await _db.SeasonAccessTrialDays
                    .AsNoTracking()
                    .Include(x => x.Trial)
                    .FirstOrDefaultAsync(x => x.Id == request.DayId, cancellationToken);

                if (day is null || day.Trial?.ApplicationUserId != userId)
                    return null;

                var ratings = await _db.SeasonAccessTrialDayRatings
                    .AsNoTracking()
                    .Where(x => x.TrialDayId == request.DayId)
                    .ToListAsync(cancellationToken);

                return ratings.Select(r => r.ToDto()).ToList();
            }
        }
    }
}
