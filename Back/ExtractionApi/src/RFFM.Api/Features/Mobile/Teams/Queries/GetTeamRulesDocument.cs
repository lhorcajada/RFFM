using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Infrastructure.Storage;

namespace RFFM.Api.Features.Mobile.Teams.Queries
{
    /// <summary>
    /// Returns a team's rules document (PDF), used by the Mobile "Normas del equipo" screen.
    /// Accessible by every team member (no feature-permission gate, only team membership).
    /// GET /api/mobile/teams/{teamId}/rules-document
    /// </summary>
    public class GetTeamRulesDocument : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("api/mobile/teams/{teamId}/rules-document",
                    async (string teamId, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var query = new GetTeamRulesDocumentQuery { TeamId = teamId };
                        var result = await mediator.Send(query, cancellationToken);
                        return result != null
                            ? Results.File(result.Content, "application/pdf")
                            : Results.NoContent();
                    })
                .WithName(nameof(GetTeamRulesDocument))
                .WithTags("Mobile")
                .Produces(StatusCodes.Status200OK)
                .Produces(StatusCodes.Status204NoContent)
                .Produces(StatusCodes.Status404NotFound);
        }

        // ─── Query ────────────────────────────────────────────────────────────

        public record GetTeamRulesDocumentQuery : IQueryApp<GetTeamRulesDocumentResult?>, IRequireTeamMembership
        {
            public string TeamId { get; set; } = null!;
        }

        public record GetTeamRulesDocumentResult(byte[] Content);

        // ─── Handler ──────────────────────────────────────────────────────────

        public class Handler(AppDbContext db, IStorageService storageService)
            : IRequestHandler<GetTeamRulesDocumentQuery, GetTeamRulesDocumentResult?>
        {
            public async ValueTask<GetTeamRulesDocumentResult?> Handle(
                GetTeamRulesDocumentQuery request, CancellationToken cancellationToken)
            {
                var team = await db.Teams
                    .AsNoTracking()
                    .SingleOrDefaultAsync(t => t.Id == request.TeamId, cancellationToken);

                if (team == null)
                    throw new NotFoundException("Equipo no encontrado", "TeamNotFound");

                if (string.IsNullOrEmpty(team.RulesDocumentUrl))
                    return null;

                var file = await storageService.DownloadAsync(team.RulesDocumentUrl, cancellationToken);
                if (file == null)
                    return null;

                return new GetTeamRulesDocumentResult(file.Value.Content);
            }
        }
    }
}
