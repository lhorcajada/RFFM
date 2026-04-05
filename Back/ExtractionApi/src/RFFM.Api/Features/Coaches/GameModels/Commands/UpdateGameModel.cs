using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.GameModels;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.GameModels.Commands
{
    /// <summary>
    /// Replaces all scenarios of an existing game model.
    /// PUT /api/game-models/{id}
    /// </summary>
    public class UpdateGameModel : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut("/api/game-models/{id}",
                    async (string id, UpdateGameModelCommand command, HttpContext httpContext, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.Claims
                            .FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;

                        if (string.IsNullOrEmpty(userId))
                            return Results.Unauthorized();

                        await mediator.Send(command with { Id = id, UserId = userId }, cancellationToken);
                        return Results.NoContent();
                    })
                .WithName(nameof(UpdateGameModel))
                .WithTags(GameModelConstants.Tag)
                .RequireAuthorization()
                .Produces(StatusCodes.Status204NoContent)
                .Produces(StatusCodes.Status401Unauthorized)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound)
                .Produces<ProblemDetails>(StatusCodes.Status403Forbidden);
        }
    }

    // ── Request ──────────────────────────────────────────────────────────────────

    public record UpdateGameModelCommand(
        string Name,
        List<ScenarioRequest> Scenarios) : IRequest
    {
        public string Id { get; init; } = string.Empty;
        public string UserId { get; init; } = string.Empty;
    }

    // ── Handler ──────────────────────────────────────────────────────────────────

    public class UpdateGameModelHandler : IRequestHandler<UpdateGameModelCommand, Unit>
    {
        private readonly AppDbContext _db;
        public UpdateGameModelHandler(AppDbContext db) => _db = db;

        public async ValueTask<Unit> Handle(UpdateGameModelCommand request, CancellationToken cancellationToken = default)
        {
            var model = await _db.GameModels
                .Include(gm => gm.Scenarios)
                    .ThenInclude(s => s.TacticalPrinciples)
                .Include(gm => gm.Scenarios)
                    .ThenInclude(s => s.SubPrinciples)
                        .ThenInclude(sp => sp.TacticalPrinciples)
                .Include(gm => gm.Scenarios)
                    .ThenInclude(s => s.SubPrinciples)
                        .ThenInclude(sp => sp.SubSubPrinciples)
                            .ThenInclude(ssp => ssp.EssentialSkills)
                .FirstOrDefaultAsync(gm => gm.Id == request.Id, cancellationToken);

            if (model is null)
                throw new DomainException("Modelo de Juego", "Modelo de juego no encontrado.", "");

            var hasAccess = await _db.UserClubs
                .Join(_db.Teams, uc => uc.ClubId, t => t.ClubId, (uc, t) => new { uc, t })
                .AnyAsync(x => x.uc.ApplicationUserId == request.UserId && x.t.Id == model.TeamId, cancellationToken);

            if (!hasAccess)
                throw new DomainException("Modelo de Juego", "No tienes acceso a este modelo de juego.", "");

            model.UpdateName(request.Name);

            // Replace all scenarios (cascade deletes handle nested entities)
            _db.GameScenarios.RemoveRange(model.Scenarios);
            model.Scenarios.Clear();

            foreach (var sr in request.Scenarios)
            {
                var scenario = new GameScenario(model.Id, sr.GameMomentId, sr.GameZoneId, sr.Order, sr.Name, sr.Context);

                foreach (var tpId in sr.TacticalPrincipleIds)
                    scenario.TacticalPrinciples.Add(new ScenarioTacticalPrinciple(scenario.Id, tpId));

                foreach (var spr in sr.SubPrinciples)
                {
                    var subPrinciple = new SubPrinciple(scenario.Id, spr.Label, spr.Name, spr.Context, spr.Order);

                    foreach (var tpId in spr.TacticalPrincipleIds)
                        subPrinciple.TacticalPrinciples.Add(new SubPrincipleTacticalPrinciple(subPrinciple.Id, tpId));

                    foreach (var sspr in spr.SubSubPrinciples)
                    {
                        var subSubPrinciple = new SubSubPrinciple(subPrinciple.Id, sspr.Name, sspr.Action, sspr.Order);

                        foreach (var skr in sspr.EssentialSkills)
                            subSubPrinciple.EssentialSkills.Add(new EssentialSkill(subSubPrinciple.Id, skr.Name, skr.Description));

                        subPrinciple.SubSubPrinciples.Add(subSubPrinciple);
                    }

                    scenario.SubPrinciples.Add(subPrinciple);
                }

                model.Scenarios.Add(scenario);
            }

            await _db.SaveChangesAsync(cancellationToken);
            return Unit.Value;
        }
    }

    // ── Validator ────────────────────────────────────────────────────────────────

    public class UpdateGameModelValidator : AbstractValidator<UpdateGameModelCommand>
    {
        public UpdateGameModelValidator()
        {
            RuleFor(x => x.Id).NotEmpty();
            RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        }
    }
}
