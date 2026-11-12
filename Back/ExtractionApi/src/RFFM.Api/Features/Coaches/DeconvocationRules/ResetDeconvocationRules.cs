using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.DeconvocationRules
{
    /// <summary>
    /// El entrenador restablece las reglas por defecto: se elimina la configuración guardada del equipo.
    /// DELETE /api/teams/{teamId}/deconvocation-rules
    /// </summary>
    public class ResetDeconvocationRules : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapDelete(DeconvocationRulesConstants.BaseRoute,
                    async (string teamId, IMediator mediator, CancellationToken ct) =>
                    {
                        await mediator.Send(new Command(teamId), ct);
                        return Results.NoContent();
                    })
                .WithName(nameof(ResetDeconvocationRules))
                .WithTags(DeconvocationRulesConstants.Tag)
                .RequireAuthorization()
                .Produces(StatusCodes.Status204NoContent)
                .ProducesProblem(StatusCodes.Status403Forbidden);
        }

        public record Command(string TeamId) : RFFM.Api.Common.ICommand;

        public class Validator : AbstractValidator<Command>
        {
            public Validator() => RuleFor(c => c.TeamId).NotEmpty();
        }

        public class Handler(AppDbContext db, ICurrentUserService currentUser) : IRequestHandler<Command, Unit>
        {
            public async ValueTask<Unit> Handle(Command request, CancellationToken cancellationToken)
            {
                await DeconvocationRulesSupport.RequireCoachAsync(db, currentUser, request.TeamId, cancellationToken);

                await db.DeconvocationRulesSettings
                    .Where(s => s.TeamId == request.TeamId)
                    .ExecuteDeleteAsync(cancellationToken);
                return Unit.Value;
            }
        }
    }
}
