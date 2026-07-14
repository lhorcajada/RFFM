using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain.Entities;
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
                        return Results.Ok(result);
                    })
                .WithName(nameof(GetSeasonAccessTrialDayRatings))
                .WithTags("SeasonAccess")
                .Produces<IReadOnlyCollection<SeasonAccessTrialPlayerDto>>()
                .Produces(StatusCodes.Status404NotFound)
                .Produces(StatusCodes.Status403Forbidden);
        }

        public record GetSeasonAccessTrialDayRatingsQuery(string DayId) : IQueryApp<IReadOnlyCollection<SeasonAccessTrialPlayerDto>>, IRequireFeaturePermission
        {
            public string FeatureRoute => CoachFeatureRoutes.SeasonAccess;
            public string RequiredPermission => "Read";
        }

        public class Validator : AbstractValidator<GetSeasonAccessTrialDayRatingsQuery>
        {
            public Validator()
            {
                RuleFor(x => x.DayId).NotEmpty();
            }
        }

        public class Handler : IRequestHandler<GetSeasonAccessTrialDayRatingsQuery, IReadOnlyCollection<SeasonAccessTrialPlayerDto>?>
        {
            private readonly AppDbContext _db;
            private readonly ICurrentUserService _currentUser;

            public Handler(AppDbContext db, ICurrentUserService currentUser)
            {
                _db = db;
                _currentUser = currentUser;
            }

            public async ValueTask<IReadOnlyCollection<SeasonAccessTrialPlayerDto>?> Handle(GetSeasonAccessTrialDayRatingsQuery request, CancellationToken cancellationToken = default)
            {
                var userId = _currentUser.UserId ?? throw new UnauthorizedAccessException("Usuario no autenticado");

                var day = await _db.SeasonAccessTrialDays
                    .AsNoTracking()
                    .Include(x => x.Trial)
                    .FirstOrDefaultAsync(x => x.Id == request.DayId, cancellationToken);

                if (day is null || day.Trial?.ApplicationUserId != userId)
                    return null;

                var ratings = await _db.SeasonAccessTrialPlayers
                    .AsNoTracking()
                    .Where(x => x.TrialId == day.TrialId)
                    .ToListAsync(cancellationToken);

                return ratings.Select(r => new SeasonAccessTrialPlayerDto(
                    r.Id,
                    r.TrialDayId ?? day.Id,
                    r.Score,
                    r.Notes,
                    r.IdealDemarcationId,
                    r.PossibleDemarcationIds,
                    r.TotalGoals,
                    r.Status,
                    r.BirthYear,
                    r.Category,
                    r.TeamCode,
                    r.TeamName,
                    r.FederationPlayerCode,
                    r.PlayerName,
                    r.RemovedFromDate)).ToList();
            }
        }
    }
}
