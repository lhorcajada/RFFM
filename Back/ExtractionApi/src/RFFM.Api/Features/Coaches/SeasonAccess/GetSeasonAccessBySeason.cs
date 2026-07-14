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
    public class GetSeasonAccessBySeason : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/catalog/season-access/season/{seasonId}",
                    [Authorize(Roles = "Coach,Administrator")]
                    async (string seasonId, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(new GetSeasonAccessBySeasonQuery(seasonId), cancellationToken);
                        return Results.Ok(result);
                    })
                .WithName(nameof(GetSeasonAccessBySeason))
                .WithTags("SeasonAccess")
                .Produces<IReadOnlyCollection<SeasonAccessTrialDto>>()
                .Produces(StatusCodes.Status403Forbidden);
        }

        public record GetSeasonAccessBySeasonQuery(string SeasonId) : IQueryApp<IReadOnlyCollection<SeasonAccessTrialDto>>, IRequireFeaturePermission
        {
            public string FeatureRoute => CoachFeatureRoutes.SeasonAccess;
            public string RequiredPermission => "Read";
        }

        public class Validator : AbstractValidator<GetSeasonAccessBySeasonQuery>
        {
            public Validator()
            {
                RuleFor(x => x.SeasonId).NotEmpty();
            }
        }

        public class Handler : IRequestHandler<GetSeasonAccessBySeasonQuery, IReadOnlyCollection<SeasonAccessTrialDto>>
        {
            private readonly AppDbContext _db;
            private readonly ICurrentUserService _currentUser;

            public Handler(AppDbContext db, ICurrentUserService currentUser)
            {
                _db = db;
                _currentUser = currentUser;
            }

            public async ValueTask<IReadOnlyCollection<SeasonAccessTrialDto>> Handle(GetSeasonAccessBySeasonQuery request, CancellationToken cancellationToken = default)
            {
                var userId = _currentUser.UserId ?? throw new UnauthorizedAccessException("Usuario no autenticado");

                var trials = await _db.SeasonAccessTrials
                    .AsNoTracking()
                    .Include(x => x.Players)
                    .Where(x => x.ApplicationUserId == userId && x.SeasonId == request.SeasonId)
                    .OrderBy(x => x.Category)
                    .ToListAsync(cancellationToken);

                return trials.Select(trial => trial.ToDto()).ToList();
            }
        }
    }
}