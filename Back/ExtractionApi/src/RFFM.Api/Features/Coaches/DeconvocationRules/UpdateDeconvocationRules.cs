using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Entities.Teams;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.DeconvocationRules
{
    /// <summary>
    /// El entrenador guarda las reglas de la propuesta de desconvocatoria de su equipo.
    /// PUT /api/teams/{teamId}/deconvocation-rules
    /// </summary>
    public class UpdateDeconvocationRules : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut(DeconvocationRulesConstants.BaseRoute,
                    async (string teamId, Body body, IMediator mediator, CancellationToken ct) =>
                        Results.Ok(await mediator.Send(new Command(teamId, body.Rules), ct)))
                .WithName(nameof(UpdateDeconvocationRules))
                .WithTags(DeconvocationRulesConstants.Tag)
                .RequireAuthorization()
                .Produces<DeconvocationRulesDto>()
                .ProducesValidationProblem()
                .ProducesProblem(StatusCodes.Status403Forbidden);
        }

        public record Body(IReadOnlyList<DeconvocationRuleDto> Rules);

        public record Command(string TeamId, IReadOnlyList<DeconvocationRuleDto> Rules) : RFFM.Api.Common.ICommand<DeconvocationRulesDto>;

        public class Validator : AbstractValidator<Command>
        {
            public Validator()
            {
                RuleFor(c => c.TeamId).NotEmpty();
                RuleFor(c => c.Rules).NotNull()
                    .Must(r => r.Count <= DeconvocationRulesConstants.MaxRules)
                    .WithMessage($"Como máximo {DeconvocationRulesConstants.MaxRules} reglas.")
                    .Must(r => r.Select(x => x.Condition).Distinct().Count() == r.Count)
                    .WithMessage("No puede haber dos reglas con la misma condición.");
                RuleForEach(c => c.Rules).ChildRules(rule =>
                {
                    rule.RuleFor(r => r.Condition).Must(c => c is not null && DeconvocationRulesConstants.Conditions.Contains(c))
                        .WithMessage("Condición de regla desconocida.");
                    rule.RuleFor(r => r.Text).NotEmpty().MaximumLength(DeconvocationRulesConstants.MaxTextLength);
                    rule.RuleFor(r => r.Points).NotNull().Must(AllInRange).WithMessage("Los puntos deben estar entre -1000 y 1000.");
                    rule.RuleFor(r => r.Weights).NotNull().Must(AllInRange).WithMessage("Los pesos deben estar entre -1000 y 1000.");
                });
            }

            private static bool AllInRange(Dictionary<string, double> values) =>
                values.Values.All(v => double.IsFinite(v) && Math.Abs(v) <= DeconvocationRulesConstants.MaxValue);
        }

        public class Handler(AppDbContext db, ICurrentUserService currentUser) : IRequestHandler<Command, DeconvocationRulesDto>
        {
            public async ValueTask<DeconvocationRulesDto> Handle(Command request, CancellationToken cancellationToken)
            {
                await DeconvocationRulesSupport.RequireCoachAsync(db, currentUser, request.TeamId, cancellationToken);

                var json = DeconvocationRulesSupport.Serialize(request.Rules);
                var settings = await db.DeconvocationRulesSettings.SingleOrDefaultAsync(s => s.TeamId == request.TeamId, cancellationToken);
                if (settings is null)
                    db.DeconvocationRulesSettings.Add(DeconvocationRulesSettings.Create(request.TeamId, json));
                else
                    settings.UpdateRules(json);

                await db.SaveChangesAsync(cancellationToken);
                return new DeconvocationRulesDto(request.Rules, false);
            }
        }
    }
}
