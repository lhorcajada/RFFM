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
    public class GetSeasonAccess : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/catalog/season-access",
                    [Authorize(Roles = "Coach,Administrator")]
                    async (string seasonId, string category, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(new GetSeasonAccessQuery(seasonId, category), cancellationToken);
                        return Results.Ok(result);
                    })
                .WithName(nameof(GetSeasonAccess))
                .WithTags("SeasonAccess")
                .Produces<SeasonAccessTrialDto>()
                .Produces(StatusCodes.Status403Forbidden);
        }

        public record GetSeasonAccessQuery(string SeasonId, string Category) : IQueryApp<SeasonAccessTrialDto?>;

        public class Validator : AbstractValidator<GetSeasonAccessQuery>
        {
            public Validator()
            {
                RuleFor(x => x.SeasonId).NotEmpty();
                RuleFor(x => x.Category).NotEmpty();
            }
        }

        public class Handler : IRequestHandler<GetSeasonAccessQuery, SeasonAccessTrialDto?>
        {
            private readonly AppDbContext _db;
            private readonly ICurrentUserService _currentUser;

            public Handler(AppDbContext db, ICurrentUserService currentUser)
            {
                _db = db;
                _currentUser = currentUser;
            }

            public async ValueTask<SeasonAccessTrialDto?> Handle(GetSeasonAccessQuery request, CancellationToken cancellationToken = default)
            {
                var userId = _currentUser.UserId ?? throw new UnauthorizedAccessException("Usuario no autenticado");

                var trial = await _db.SeasonAccessTrials
                    .AsNoTracking()
                    .Include(x => x.Players)
                    .FirstOrDefaultAsync(
                        x => x.ApplicationUserId == userId && x.SeasonId == request.SeasonId && x.Category == request.Category,
                        cancellationToken);

                return trial?.ToDto() ?? new SeasonAccessTrialDto(string.Empty, request.SeasonId, request.Category, Array.Empty<SeasonAccessPlayerDto>());
            }
        }
    }
}