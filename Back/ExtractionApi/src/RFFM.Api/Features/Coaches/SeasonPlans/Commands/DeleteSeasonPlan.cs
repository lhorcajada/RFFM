using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.SeasonPlans.Commands
{
    /// <summary>
    /// Deletes a season plan and all its nested Macrociclo/Mesociclo/Microciclo data.
    /// Any TrainingSession linked to one of this plan's Microciclos is preserved — only its
    /// MicrocicloId is cleared, via the SetNull FK behavior configured on
    /// TrainingSession.MicrocicloId (see SessionTrainingEntityConfiguration).
    /// DELETE /api/season-plans/{id}
    /// </summary>
    public class DeleteSeasonPlan : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapDelete("/api/season-plans/{id}",
                    async (string id, HttpContext httpContext, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.Claims
                            .FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;

                        if (string.IsNullOrEmpty(userId))
                            return Results.Unauthorized();

                        await mediator.Send(new DeleteSeasonPlanCommand(id, userId), cancellationToken);
                        return Results.NoContent();
                    })
                .WithName(nameof(DeleteSeasonPlan))
                .WithTags(SeasonPlanConstants.Tag)
                .RequireAuthorization()
                .Produces(StatusCodes.Status204NoContent)
                .Produces(StatusCodes.Status401Unauthorized)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound)
                .Produces<ProblemDetails>(StatusCodes.Status403Forbidden);
        }
    }

    // ── Request ──────────────────────────────────────────────────────────────────

    public record DeleteSeasonPlanCommand(string Id, string UserId) : IRequest, IRequireFeaturePermission
    {
        public string FeatureRoute => CoachFeatureRoutes.SeasonPlan;
        public string RequiredPermission => "ReadWrite";
    }

    // ── Handler ──────────────────────────────────────────────────────────────────

    public class DeleteSeasonPlanHandler : IRequestHandler<DeleteSeasonPlanCommand, Unit>
    {
        private readonly AppDbContext _db;
        public DeleteSeasonPlanHandler(AppDbContext db) => _db = db;

        public async ValueTask<Unit> Handle(DeleteSeasonPlanCommand request, CancellationToken cancellationToken = default)
        {
            var plan = await _db.SeasonPlans
                .Include(sp => sp.Macrociclos)
                    .ThenInclude(m => m.Mesociclos)
                        .ThenInclude(m => m.Microciclos)
                .AsSplitQuery()
                .FirstOrDefaultAsync(sp => sp.Id == request.Id, cancellationToken);

            if (plan is null)
                throw new DomainException("Planificación de Temporada", "Planificación no encontrada.", ErrorCodes.SeasonPlanNotFound);

            var hasAccess = await _db.UserClubs
                .Join(_db.Teams, uc => uc.ClubId, t => t.ClubId, (uc, t) => new { uc, t })
                .AnyAsync(x => x.uc.ApplicationUserId == request.UserId && x.t.Id == plan.TeamId, cancellationToken);

            if (!hasAccess)
                throw new DomainException("Planificación de Temporada", "No tienes acceso a esta planificación.", ErrorCodes.SeasonPlanAccessDenied);

            _db.SeasonPlans.Remove(plan);
            await _db.SaveChangesAsync(cancellationToken);

            return Unit.Value;
        }
    }
}
