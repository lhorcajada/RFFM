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
    /// Creates a new game model for a team and season.
    /// POST /api/game-models
    /// </summary>
    public class CreateGameModel : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/game-models",
                    async (CreateGameModelCommand command, HttpContext httpContext, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.Claims
                            .FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;

                        if (string.IsNullOrEmpty(userId))
                            return Results.Unauthorized();

                        var id = await mediator.Send(command with { UserId = userId }, cancellationToken);
                        return Results.Created($"/api/game-models?teamId={command.TeamId}&season={command.Season}", new { id });
                    })
                .WithName(nameof(CreateGameModel))
                .WithTags(GameModelConstants.Tag)
                .RequireAuthorization()
                .Produces(StatusCodes.Status201Created)
                .Produces(StatusCodes.Status401Unauthorized)
                .Produces<ProblemDetails>(StatusCodes.Status409Conflict)
                .Produces<ProblemDetails>(StatusCodes.Status403Forbidden);
        }
    }

    // ── Request ──────────────────────────────────────────────────────────────────

    public record CreateGameModelCommand(
        string TeamId,
        string Name,
        string Season,
        List<ScenarioRequest> Scenarios) : IRequest<string>
    {
        public string UserId { get; init; } = string.Empty;
    }

    public record ScenarioRequest(
        int GameMomentId,
        int GameZoneId,
        int Order,
        string Name,
        string Context,
        List<int> TacticalPrincipleIds,
        List<SubPrincipleRequest> SubPrinciples);

    public record SubPrincipleRequest(
        string Label,
        int Order,
        string Name,
        string Context,
        List<int> TacticalPrincipleIds,
        List<SubSubPrincipleRequest> SubSubPrinciples);

    public record SubSubPrincipleRequest(
        int Order,
        string Name,
        string Action,
        List<EssentialSkillRequest> EssentialSkills);

    public record EssentialSkillRequest(string Name, string Description);

    // ── Handler ──────────────────────────────────────────────────────────────────

    public class CreateGameModelHandler : IRequestHandler<CreateGameModelCommand, string>
    {
        private readonly AppDbContext _db;
        public CreateGameModelHandler(AppDbContext db) => _db = db;

        public async ValueTask<string> Handle(CreateGameModelCommand request, CancellationToken cancellationToken = default)
        {
            var hasAccess = await _db.UserClubs
                .Join(_db.Teams, uc => uc.ClubId, t => t.ClubId, (uc, t) => new { uc, t })
                .AnyAsync(x => x.uc.ApplicationUserId == request.UserId && x.t.Id == request.TeamId, cancellationToken);

            if (!hasAccess)
                throw new DomainException("Modelo de Juego", "No tienes acceso a este equipo.", "");

            var exists = await _db.GameModels
                .AnyAsync(gm => gm.TeamId == request.TeamId && gm.Season == request.Season, cancellationToken);

            if (exists)
                throw new DomainException("Modelo de Juego",
                    $"Ya existe un modelo de juego para la temporada {request.Season}.", "");

            var model = new GameModel(request.TeamId, request.Name, request.Season);

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

            await _db.GameModels.AddAsync(model, cancellationToken);
            await _db.SaveChangesAsync(cancellationToken);

            return model.Id;
        }
    }

    // ── Validator ────────────────────────────────────────────────────────────────

    public class CreateGameModelValidator : AbstractValidator<CreateGameModelCommand>
    {
        public CreateGameModelValidator()
        {
            RuleFor(x => x.TeamId).NotEmpty();
            RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
            RuleFor(x => x.Season).NotEmpty().MaximumLength(20);
        }
    }
}
