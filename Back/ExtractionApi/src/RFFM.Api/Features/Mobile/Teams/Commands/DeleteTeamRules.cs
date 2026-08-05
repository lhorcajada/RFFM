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

namespace RFFM.Api.Features.Mobile.Teams.Commands
{
    /// <summary>
    /// Removes a team's entire rules set ("Normas del equipo"), cascade-deleting its rules and
    /// returning the team to "no rules published". Coach/Admin only. Idempotent: no-op (still
    /// 204) if no rules set exists.
    /// DELETE /api/mobile/teams/{teamId}/rules
    /// </summary>
    public class DeleteTeamRules : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapDelete("api/mobile/teams/{teamId}/rules",
                    async (string teamId, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        await mediator.Send(new DeleteTeamRulesCommand { TeamId = teamId }, cancellationToken);
                        return Results.NoContent();
                    })
                .WithName(nameof(DeleteTeamRules))
                .WithTags("Mobile")
                .Produces(StatusCodes.Status204NoContent)
                .Produces<ProblemDetails>(StatusCodes.Status403Forbidden)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound);
        }

        // ─── Command ──────────────────────────────────────────────────────────

        public record DeleteTeamRulesCommand : IRequest, IRequireFeaturePermission, IRequireTeamMembership
        {
            public string TeamId { get; set; } = null!;

            public string FeatureRoute => CoachFeatureRoutes.TeamRulesDocument;
            public string RequiredPermission => "ReadWrite";
        }

        // ─── Handler ──────────────────────────────────────────────────────────

        public class Handler(AppDbContext db) : IRequestHandler<DeleteTeamRulesCommand, Unit>
        {
            public async ValueTask<Unit> Handle(DeleteTeamRulesCommand request, CancellationToken cancellationToken)
            {
                var team = await db.Teams
                    .Include(t => t.RulesSet)
                    .SingleOrDefaultAsync(t => t.Id == request.TeamId, cancellationToken);

                if (team == null)
                    throw new NotFoundException("Equipo no encontrado", "TeamNotFound");

                if (team.RulesSet != null)
                {
                    db.TeamRulesSets.Remove(team.RulesSet);
                    await db.SaveChangesAsync(cancellationToken);
                }

                return Unit.Value;
            }
        }
    }
}
