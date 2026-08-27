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
    /// Replaces the full Macrociclo/Mesociclo/Microciclo tree of an existing season plan.
    /// Nodes are matched by Id when provided (SeasonPlan nodes have no stable business key
    /// like GameModel's Key), otherwise treated as new. Order is always re-derived server-side
    /// from each list's array position, ignoring any client-sent order value.
    /// PUT /api/season-plans/{id}
    /// </summary>
    public class UpdateSeasonPlan : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut("/api/season-plans/{id}",
                    async (string id, UpdateSeasonPlanCommand command, HttpContext httpContext, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.Claims
                            .FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;

                        if (string.IsNullOrEmpty(userId))
                            return Results.Unauthorized();

                        await mediator.Send(command with { Id = id, UserId = userId }, cancellationToken);
                        return Results.NoContent();
                    })
                .WithName(nameof(UpdateSeasonPlan))
                .WithTags(SeasonPlanConstants.Tag)
                .RequireAuthorization()
                .Produces(StatusCodes.Status204NoContent)
                .Produces(StatusCodes.Status401Unauthorized)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound)
                .Produces<ProblemDetails>(StatusCodes.Status403Forbidden);
        }
    }

    // ── Request ──────────────────────────────────────────────────────────────────

    public record UpdateSeasonPlanCommand(
        List<MacrocicloUpdateRequest> Macrociclos) : IRequest, IRequireFeaturePermission
    {
        public string Id { get; init; } = string.Empty;
        public string UserId { get; init; } = string.Empty;

        public string FeatureRoute => CoachFeatureRoutes.SeasonPlan;
        public string RequiredPermission => "ReadWrite";
    }

    public record MacrocicloUpdateRequest(
        string? Id,
        string Name,
        DateOnly StartDate,
        DateOnly EndDate,
        List<MesocicloUpdateRequest> Mesociclos);

    public record MesocicloUpdateRequest(
        string? Id,
        string Name,
        DateOnly StartDate,
        DateOnly EndDate,
        int GameZoneId,
        List<MicrocicloUpdateRequest> Microciclos);

    public record MicrocicloUpdateRequest(
        string? Id,
        string WeekLabel,
        DateOnly StartDate,
        DateOnly EndDate,
        List<string>? SubprincipioObjetivoIds = null);

    // ── Handler ──────────────────────────────────────────────────────────────────

    public class UpdateSeasonPlanHandler : IRequestHandler<UpdateSeasonPlanCommand, Unit>
    {
        private readonly AppDbContext _db;
        public UpdateSeasonPlanHandler(AppDbContext db) => _db = db;

        public async ValueTask<Unit> Handle(UpdateSeasonPlanCommand request, CancellationToken cancellationToken = default)
        {
            var plan = await _db.SeasonPlans
                .Include(sp => sp.Macrociclos)
                    .ThenInclude(m => m.Mesociclos)
                        .ThenInclude(m => m.Microciclos)
                            .ThenInclude(m => m.SubprincipiosObjetivo)
                .AsSplitQuery()
                .FirstOrDefaultAsync(sp => sp.Id == request.Id, cancellationToken);

            if (plan is null)
                throw new DomainException("Planificación de Temporada", "Planificación no encontrada.", ErrorCodes.SeasonPlanNotFound);

            var hasAccess = await _db.UserClubs
                .Join(_db.Teams, uc => uc.ClubId, t => t.ClubId, (uc, t) => new { uc, t })
                .AnyAsync(x => x.uc.ApplicationUserId == request.UserId && x.t.Id == plan.TeamId, cancellationToken);

            if (!hasAccess)
                throw new DomainException("Planificación de Temporada", "No tienes acceso a esta planificación.", ErrorCodes.SeasonPlanAccessDenied);

            var matchedMacrocicloIds = new HashSet<string>();
            var macrocicloOrder = 0;

            foreach (var mr in request.Macrociclos)
            {
                macrocicloOrder++;
                var existing = string.IsNullOrEmpty(mr.Id) ? null : plan.Macrociclos.FirstOrDefault(m => m.Id == mr.Id);

                if (existing is not null)
                {
                    matchedMacrocicloIds.Add(existing.Id);
                    existing.UpdateOrder(macrocicloOrder);
                    existing.UpdateName(mr.Name);
                    existing.Reschedule(mr.StartDate, mr.EndDate);

                    UpsertMesociclos(existing, mr.Mesociclos);
                }
                else
                {
                    var newMacrociclo = new Macrociclo(plan.Id, macrocicloOrder, mr.Name, mr.StartDate, mr.EndDate);
                    foreach (var mesr in mr.Mesociclos)
                        newMacrociclo.Mesociclos.Add(BuildNewMesociclo(newMacrociclo.Id, mesr));

                    plan.Macrociclos.Add(newMacrociclo);
                    matchedMacrocicloIds.Add(newMacrociclo.Id);
                }
            }

            _db.Macrociclos.RemoveRange(plan.Macrociclos.Where(m => !matchedMacrocicloIds.Contains(m.Id)).ToList());

            await _db.SaveChangesAsync(cancellationToken);
            return Unit.Value;
        }

        private void UpsertMesociclos(Macrociclo macrociclo, List<MesocicloUpdateRequest> requests)
        {
            var matchedIds = new HashSet<string>();
            var order = 0;

            foreach (var mesr in requests)
            {
                order++;
                var existing = string.IsNullOrEmpty(mesr.Id) ? null : macrociclo.Mesociclos.FirstOrDefault(m => m.Id == mesr.Id);

                if (existing is not null)
                {
                    matchedIds.Add(existing.Id);
                    existing.UpdateOrder(order);
                    existing.UpdateName(mesr.Name);
                    existing.Reschedule(mesr.StartDate, mesr.EndDate);
                    existing.UpdateGameZoneId(mesr.GameZoneId);

                    UpsertMicrociclos(existing, mesr.Microciclos);
                }
                else
                {
                    var built = new Mesociclo(macrociclo.Id, order, mesr.Name, mesr.StartDate, mesr.EndDate, mesr.GameZoneId);
                    var microOrder = 0;
                    foreach (var mir in mesr.Microciclos)
                    {
                        microOrder++;
                        built.Microciclos.Add(new Microciclo(
                            built.Id, microOrder, mir.WeekLabel, mir.StartDate, mir.EndDate));
                    }

                    macrociclo.Mesociclos.Add(built);
                    matchedIds.Add(built.Id);
                }
            }

            _db.Mesociclos.RemoveRange(macrociclo.Mesociclos.Where(m => !matchedIds.Contains(m.Id)).ToList());
        }

        private void UpsertMicrociclos(Mesociclo mesociclo, List<MicrocicloUpdateRequest> requests)
        {
            var matchedIds = new HashSet<string>();
            var order = 0;

            foreach (var mir in requests)
            {
                order++;
                var existing = string.IsNullOrEmpty(mir.Id) ? null : mesociclo.Microciclos.FirstOrDefault(m => m.Id == mir.Id);

                if (existing is not null)
                {
                    matchedIds.Add(existing.Id);
                    existing.UpdateOrder(order);
                    existing.UpdateWeekLabel(mir.WeekLabel);
                    existing.Reschedule(mir.StartDate, mir.EndDate);
                    existing.ReplaceSubprincipiosObjetivo(mir.SubprincipioObjetivoIds);
                }
                else
                {
                    var newMicrociclo = new Microciclo(mesociclo.Id, order, mir.WeekLabel, mir.StartDate, mir.EndDate);
                    newMicrociclo.ReplaceSubprincipiosObjetivo(mir.SubprincipioObjetivoIds);
                    mesociclo.Microciclos.Add(newMicrociclo);
                    matchedIds.Add(newMicrociclo.Id);
                }
            }

            _db.Microciclos.RemoveRange(mesociclo.Microciclos.Where(m => !matchedIds.Contains(m.Id)).ToList());
        }

        private static Mesociclo BuildNewMesociclo(string macrocicloId, MesocicloUpdateRequest mesr)
        {
            var mesociclo = new Mesociclo(macrocicloId, default, mesr.Name, mesr.StartDate, mesr.EndDate, mesr.GameZoneId);
            var order = 0;
            foreach (var mir in mesr.Microciclos)
            {
                order++;
                var newMicrociclo = new Microciclo(mesociclo.Id, order, mir.WeekLabel, mir.StartDate, mir.EndDate);
                newMicrociclo.ReplaceSubprincipiosObjetivo(mir.SubprincipioObjetivoIds);
                mesociclo.Microciclos.Add(newMicrociclo);
            }
            return mesociclo;
        }
    }

    // ── Validator ────────────────────────────────────────────────────────────────

    public class UpdateSeasonPlanValidator : AbstractValidator<UpdateSeasonPlanCommand>
    {
        public UpdateSeasonPlanValidator()
        {
            RuleFor(x => x.Id).NotEmpty();
            RuleForEach(x => x.Macrociclos).SetValidator(new MacrocicloUpdateRequestValidator());
        }
    }

    public class MacrocicloUpdateRequestValidator : AbstractValidator<MacrocicloUpdateRequest>
    {
        public MacrocicloUpdateRequestValidator()
        {
            RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
            RuleFor(x => x.EndDate).GreaterThanOrEqualTo(x => x.StartDate);
            RuleForEach(x => x.Mesociclos).SetValidator(new MesocicloUpdateRequestValidator());
        }
    }

    public class MesocicloUpdateRequestValidator : AbstractValidator<MesocicloUpdateRequest>
    {
        public MesocicloUpdateRequestValidator()
        {
            RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
            RuleFor(x => x.GameZoneId).GreaterThan(0);
            RuleFor(x => x.EndDate).GreaterThanOrEqualTo(x => x.StartDate);
            RuleForEach(x => x.Microciclos).SetValidator(new MicrocicloUpdateRequestValidator());
        }
    }

    public class MicrocicloUpdateRequestValidator : AbstractValidator<MicrocicloUpdateRequest>
    {
        public MicrocicloUpdateRequestValidator()
        {
            RuleFor(x => x.WeekLabel).NotEmpty().MaximumLength(200);
            RuleFor(x => x.EndDate).GreaterThanOrEqualTo(x => x.StartDate);
            RuleForEach(x => x.SubprincipioObjetivoIds).NotEmpty();
        }
    }
}
