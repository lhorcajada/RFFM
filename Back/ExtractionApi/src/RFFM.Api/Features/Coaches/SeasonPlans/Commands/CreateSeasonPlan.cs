using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.SeasonPlans;
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.SeasonPlans.Commands
{
    /// <summary>
    /// Creates a new season plan for a team and season: Macrociclo → Mesociclo → Microciclo.
    /// POST /api/season-plans
    /// </summary>
    public class CreateSeasonPlan : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/season-plans",
                    async (CreateSeasonPlanCommand command, HttpContext httpContext, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.Claims
                            .FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;

                        if (string.IsNullOrEmpty(userId))
                            return Results.Unauthorized();

                        var id = await mediator.Send(command with { UserId = userId }, cancellationToken);
                        return Results.Created($"/api/season-plans?teamId={command.TeamId}&seasonId={command.SeasonId}", new { id });
                    })
                .WithName(nameof(CreateSeasonPlan))
                .WithTags(SeasonPlanConstants.Tag)
                .RequireAuthorization()
                .Produces(StatusCodes.Status201Created)
                .Produces(StatusCodes.Status401Unauthorized)
                .Produces<ProblemDetails>(StatusCodes.Status409Conflict)
                .Produces<ProblemDetails>(StatusCodes.Status403Forbidden);
        }
    }

    // ── Request ──────────────────────────────────────────────────────────────────

    public record CreateSeasonPlanCommand(
        string TeamId,
        string SeasonId,
        List<MacrocicloRequest> Macrociclos) : IRequest<string>, IRequireFeaturePermission
    {
        public string UserId { get; init; } = string.Empty;

        public string FeatureRoute => CoachFeatureRoutes.SeasonPlan;
        public string RequiredPermission => "ReadWrite";
    }

    public record MacrocicloRequest(
        int Order,
        string Name,
        DateOnly StartDate,
        DateOnly EndDate,
        List<MesocicloRequest> Mesociclos);

    public record MesocicloRequest(
        int Order,
        string Name,
        DateOnly StartDate,
        DateOnly EndDate,
        int GameZoneId,
        List<MicrocicloRequest> Microciclos);

    public record MicrocicloRequest(
        int Order,
        string WeekLabel,
        DateOnly StartDate,
        DateOnly EndDate,
        string ObjetivoSesionA,
        string ObjetivoSesionB,
        List<string>? SesionASubprincipioIds = null,
        List<string>? SesionASubSubPrincipioIds = null,
        List<string>? SesionAHabilidades = null,
        List<string>? SesionBSubprincipioIds = null,
        List<string>? SesionBSubSubPrincipioIds = null,
        List<string>? SesionBHabilidades = null);

    // ── Handler ──────────────────────────────────────────────────────────────────

    public class CreateSeasonPlanHandler : IRequestHandler<CreateSeasonPlanCommand, string>
    {
        private readonly AppDbContext _db;
        public CreateSeasonPlanHandler(AppDbContext db) => _db = db;

        public async ValueTask<string> Handle(CreateSeasonPlanCommand request, CancellationToken cancellationToken = default)
        {
            var hasAccess = await _db.UserClubs
                .Join(_db.Teams, uc => uc.ClubId, t => t.ClubId, (uc, t) => new { uc, t })
                .AnyAsync(x => x.uc.ApplicationUserId == request.UserId && x.t.Id == request.TeamId, cancellationToken);

            if (!hasAccess)
                throw new DomainException("Planificación de Temporada", "No tienes acceso a este equipo.", ErrorCodes.TeamAccessDenied);

            var exists = await _db.SeasonPlans
                .AnyAsync(sp => sp.TeamId == request.TeamId && sp.SeasonId == request.SeasonId, cancellationToken);

            if (exists)
                throw new DomainException("Planificación de Temporada",
                    "Ya existe una planificación de temporada para este equipo y temporada.", ErrorCodes.SeasonPlanAlreadyExists);

            var plan = new SeasonPlan(request.TeamId, request.SeasonId);

            foreach (var mr in request.Macrociclos)
                plan.Macrociclos.Add(BuildMacrociclo(plan.Id, mr));

            await _db.SeasonPlans.AddAsync(plan, cancellationToken);
            await _db.SaveChangesAsync(cancellationToken);

            return plan.Id;
        }

        internal static Macrociclo BuildMacrociclo(string seasonPlanId, MacrocicloRequest mr)
        {
            var macrociclo = new Macrociclo(seasonPlanId, mr.Order, mr.Name, mr.StartDate, mr.EndDate);

            foreach (var mesr in mr.Mesociclos)
                macrociclo.Mesociclos.Add(BuildMesociclo(macrociclo.Id, mesr));

            return macrociclo;
        }

        private static Mesociclo BuildMesociclo(string macrocicloId, MesocicloRequest mesr)
        {
            var mesociclo = new Mesociclo(macrocicloId, mesr.Order, mesr.Name, mesr.StartDate, mesr.EndDate, mesr.GameZoneId);

            foreach (var mir in mesr.Microciclos)
                mesociclo.Microciclos.Add(BuildMicrociclo(mesociclo.Id, mir));

            return mesociclo;
        }

        internal static Microciclo BuildMicrociclo(string mesocicloId, MicrocicloRequest mir)
        {
            var microciclo = new Microciclo(
                mesocicloId, mir.Order, mir.WeekLabel, mir.StartDate, mir.EndDate, mir.ObjetivoSesionA, mir.ObjetivoSesionB);

            ApplySesionAdnLinks(microciclo, mir);

            return microciclo;
        }

        internal static void ApplySesionAdnLinks(Microciclo microciclo, MicrocicloRequest mir)
        {
            microciclo.UpdateSesionAHabilidades(mir.SesionAHabilidades);
            microciclo.UpdateSesionBHabilidades(mir.SesionBHabilidades);
            microciclo.ReplaceSubprincipioLinks(Microciclo.SessionA, mir.SesionASubprincipioIds);
            microciclo.ReplaceSubprincipioLinks(Microciclo.SessionB, mir.SesionBSubprincipioIds);
            microciclo.ReplaceSubSubPrincipioLinks(Microciclo.SessionA, mir.SesionASubSubPrincipioIds);
            microciclo.ReplaceSubSubPrincipioLinks(Microciclo.SessionB, mir.SesionBSubSubPrincipioIds);
        }
    }

    // ── Validator ────────────────────────────────────────────────────────────────

    public class CreateSeasonPlanValidator : AbstractValidator<CreateSeasonPlanCommand>
    {
        public CreateSeasonPlanValidator()
        {
            RuleFor(x => x.TeamId).NotEmpty();
            RuleFor(x => x.SeasonId).NotEmpty();
            RuleForEach(x => x.Macrociclos).SetValidator(new MacrocicloRequestValidator());
        }
    }

    public class MacrocicloRequestValidator : AbstractValidator<MacrocicloRequest>
    {
        public MacrocicloRequestValidator()
        {
            RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
            RuleFor(x => x.EndDate).GreaterThanOrEqualTo(x => x.StartDate);
            RuleForEach(x => x.Mesociclos).SetValidator(new MesocicloRequestValidator());
        }
    }

    public class MesocicloRequestValidator : AbstractValidator<MesocicloRequest>
    {
        public MesocicloRequestValidator()
        {
            RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
            RuleFor(x => x.GameZoneId).GreaterThan(0);
            RuleFor(x => x.EndDate).GreaterThanOrEqualTo(x => x.StartDate);
            RuleForEach(x => x.Microciclos).SetValidator(new MicrocicloRequestValidator());
        }
    }

    public class MicrocicloRequestValidator : AbstractValidator<MicrocicloRequest>
    {
        public MicrocicloRequestValidator()
        {
            RuleFor(x => x.WeekLabel).NotEmpty().MaximumLength(200);
            RuleFor(x => x.ObjetivoSesionA).NotEmpty().MaximumLength(2000);
            RuleFor(x => x.ObjetivoSesionB).NotEmpty().MaximumLength(2000);
            RuleFor(x => x.EndDate).GreaterThanOrEqualTo(x => x.StartDate);
        }
    }
}
