using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain.Entities.Teams;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Quiniela
{
    /// <summary>
    /// Ajustes de la quiniela del equipo (porcentaje de lo cobrado que va al fondo). Solo el entrenador.
    /// GET /api/teams/{teamId}/quiniela/settings
    /// </summary>
    public class GetQuinielaSettings : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet($"{QuinielaConstants.BaseRoute}/settings",
                    async (string teamId, IMediator mediator, CancellationToken ct) =>
                        Results.Ok(await mediator.Send(new Query(teamId), ct)))
                .WithName(nameof(GetQuinielaSettings))
                .WithTags(QuinielaConstants.Tag)
                .RequireAuthorization()
                .Produces<QuinielaSettingsDto>()
                .ProducesProblem(StatusCodes.Status403Forbidden);
        }

        public record Query(string TeamId) : IQueryApp<QuinielaSettingsDto>;

        public class Handler(AppDbContext db, ICurrentUserService currentUser) : IRequestHandler<Query, QuinielaSettingsDto>
        {
            public async ValueTask<QuinielaSettingsDto> Handle(Query request, CancellationToken cancellationToken)
            {
                await QuinielaSupport.RequireRoleAsync(db, currentUser, request.TeamId, QuinielaSupport.CoachOnly, cancellationToken);

                var fundPercent = await db.QuinielaTeamSettings.AsNoTracking()
                    .Where(s => s.TeamId == request.TeamId)
                    .Select(s => (decimal?)s.FundPercent)
                    .SingleOrDefaultAsync(cancellationToken);
                return new QuinielaSettingsDto(fundPercent ?? QuinielaTeamSettings.DefaultFundPercent);
            }
        }
    }
}
