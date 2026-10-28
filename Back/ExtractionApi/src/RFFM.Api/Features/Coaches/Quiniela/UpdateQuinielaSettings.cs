using FluentValidation;
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
    /// El entrenador fija el porcentaje de lo cobrado que va al fondo del equipo. Se aplica también a la
    /// jornada abierta (si la hay); las liquidadas no cambian.
    /// PUT /api/teams/{teamId}/quiniela/settings
    /// </summary>
    public class UpdateQuinielaSettings : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut($"{QuinielaConstants.BaseRoute}/settings",
                    async (string teamId, Body body, IMediator mediator, CancellationToken ct) =>
                        Results.Ok(await mediator.Send(new Command(teamId, body.FundPercent), ct)))
                .WithName(nameof(UpdateQuinielaSettings))
                .WithTags(QuinielaConstants.Tag)
                .RequireAuthorization()
                .Produces<QuinielaSettingsDto>()
                .ProducesValidationProblem()
                .ProducesProblem(StatusCodes.Status403Forbidden);
        }

        public record Body(decimal FundPercent);

        public record Command(string TeamId, decimal FundPercent) : RFFM.Api.Common.ICommand<QuinielaSettingsDto>;

        public class Validator : AbstractValidator<Command>
        {
            public Validator()
            {
                RuleFor(c => c.TeamId).NotEmpty();
                RuleFor(c => c.FundPercent).InclusiveBetween(0m, 100m);
            }
        }

        public class Handler(AppDbContext db, ICurrentUserService currentUser) : IRequestHandler<Command, QuinielaSettingsDto>
        {
            public async ValueTask<QuinielaSettingsDto> Handle(Command request, CancellationToken cancellationToken)
            {
                await QuinielaSupport.RequireRoleAsync(db, currentUser, request.TeamId, QuinielaSupport.CoachOnly, cancellationToken);

                var settings = await db.QuinielaTeamSettings.SingleOrDefaultAsync(s => s.TeamId == request.TeamId, cancellationToken);
                if (settings is null)
                {
                    settings = QuinielaTeamSettings.Create(request.TeamId, request.FundPercent);
                    db.QuinielaTeamSettings.Add(settings);
                }
                else
                {
                    settings.UpdateFundPercent(request.FundPercent);
                }

                var openJornada = await db.QuinielaJornadas.SingleOrDefaultAsync(
                    j => j.TeamId == request.TeamId && j.Status == QuinielaJornadaStatus.Open, cancellationToken);
                openJornada?.ApplyPrizePercent(settings.PrizePercent);

                await db.SaveChangesAsync(cancellationToken);
                return new QuinielaSettingsDto(settings.FundPercent);
            }
        }
    }
}
