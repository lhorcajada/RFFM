using System.Linq;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Mobile.Teams.Queries
{
    /// <summary>
    /// Returns a team's structured rules ("Normas del equipo"), used by the Mobile "Normas del
    /// equipo" screen and by the Coach app (Features/Coaches/Teams) to pre-fill its edit form.
    /// Accessible by every team member (no feature-permission gate, only team membership).
    /// GET /api/mobile/teams/{teamId}/rules
    /// </summary>
    public class GetTeamRules : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("api/mobile/teams/{teamId}/rules",
                    async (string teamId, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var query = new GetTeamRulesQuery { TeamId = teamId };
                        var result = await mediator.Send(query, cancellationToken);
                        return result != null ? Results.Ok(result) : Results.NoContent();
                    })
                .WithName(nameof(GetTeamRules))
                .WithTags("Mobile")
                .Produces<TeamRulesDto>(StatusCodes.Status200OK)
                .Produces(StatusCodes.Status204NoContent)
                .Produces(StatusCodes.Status404NotFound);
        }

        // ─── Query ────────────────────────────────────────────────────────────

        public record GetTeamRulesQuery : IQueryApp<TeamRulesDto?>, IRequireTeamMembership
        {
            public string TeamId { get; set; } = null!;
        }

        // ─── DTOs (shared read model reused by Features/Coaches/Teams) ─────────

        public record TeamRulesDto(
            string TeamId,
            string Title,
            string Subtitle,
            string IntroNote,
            string? ClosingNote,
            string? ApplicationNote,
            List<TeamRuleDto> Rules,
            DateTime UpdatedAt);

        public record TeamRuleDto(
            string Id,
            int Order,
            string ShortTitle,
            string? Highlight,
            string ViolationSummary,
            string ConsequenceSummary,
            string? LongDescription,
            List<string>? BulletPoints,
            string? ConsequenceDetail);

        // ─── Handler ──────────────────────────────────────────────────────────

        public class Handler(AppDbContext db) : IRequestHandler<GetTeamRulesQuery, TeamRulesDto?>
        {
            public async ValueTask<TeamRulesDto?> Handle(GetTeamRulesQuery request, CancellationToken cancellationToken)
            {
                var team = await db.Teams
                    .AsNoTracking()
                    .Include(t => t.RulesSet)
                        .ThenInclude(rs => rs!.Rules)
                    .SingleOrDefaultAsync(t => t.Id == request.TeamId, cancellationToken);

                if (team == null)
                    throw new NotFoundException("Equipo no encontrado", "TeamNotFound");

                if (team.RulesSet == null)
                    return null;

                return Map(team.RulesSet);
            }

            internal static TeamRulesDto Map(Domain.Aggregates.UserClubs.TeamRulesSet rulesSet) => new(
                rulesSet.TeamId,
                rulesSet.Title,
                rulesSet.Subtitle,
                rulesSet.IntroNote,
                rulesSet.ClosingNote,
                rulesSet.ApplicationNote,
                rulesSet.Rules
                    .OrderBy(r => r.Order)
                    .Select(r => new TeamRuleDto(
                        r.Id,
                        r.Order,
                        r.ShortTitle,
                        r.Highlight,
                        r.ViolationSummary,
                        r.ConsequenceSummary,
                        r.LongDescription,
                        r.BulletPoints,
                        r.ConsequenceDetail))
                    .ToList(),
                rulesSet.UpdatedAt);
        }
    }
}
