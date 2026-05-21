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
    public class GetSeasonAccessTrialDays : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/catalog/season-access/trial-days",
                    [Authorize(Roles = "Coach,Administrator")]
                    async (string seasonId, string category, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(new GetSeasonAccessTrialDaysQuery(seasonId, category), cancellationToken);
                        return Results.Ok(result);
                    })
                .WithName(nameof(GetSeasonAccessTrialDays))
                .WithTags("SeasonAccess")
                .Produces<IReadOnlyCollection<SeasonAccessTrialDayDto>>()
                .Produces(StatusCodes.Status403Forbidden);
        }

        public record GetSeasonAccessTrialDaysQuery(string SeasonId, string Category) : IQueryApp<IReadOnlyCollection<SeasonAccessTrialDayDto>>;

        public class Validator : AbstractValidator<GetSeasonAccessTrialDaysQuery>
        {
            public Validator()
            {
                RuleFor(x => x.SeasonId).NotEmpty();
                RuleFor(x => x.Category).NotEmpty();
            }
        }

        public class Handler : IRequestHandler<GetSeasonAccessTrialDaysQuery, IReadOnlyCollection<SeasonAccessTrialDayDto>>
        {
            private readonly AppDbContext _db;
            private readonly ICurrentUserService _currentUser;

            public Handler(AppDbContext db, ICurrentUserService currentUser)
            {
                _db = db;
                _currentUser = currentUser;
            }

            public async ValueTask<IReadOnlyCollection<SeasonAccessTrialDayDto>> Handle(GetSeasonAccessTrialDaysQuery request, CancellationToken cancellationToken = default)
            {
                var userId = _currentUser.UserId ?? throw new UnauthorizedAccessException("Usuario no autenticado");

                var trial = await _db.SeasonAccessTrials
                    .AsNoTracking()
                    .FirstOrDefaultAsync(
                        x => x.ApplicationUserId == userId && x.SeasonId == request.SeasonId && x.Category == request.Category,
                        cancellationToken);

                if (trial is null)
                    return Array.Empty<SeasonAccessTrialDayDto>();

                var days = await _db.SeasonAccessTrialDays
                    .AsNoTracking()
                    .Where(x => x.TrialId == trial.Id)
                    .OrderBy(x => x.Date)
                    .ToListAsync(cancellationToken);

                return days.Select(d => d.ToDto()).ToList();
            }
        }
    }
}
