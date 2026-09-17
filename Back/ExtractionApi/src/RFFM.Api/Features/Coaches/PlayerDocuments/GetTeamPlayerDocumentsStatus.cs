using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.PlayerDocuments
{
    public class GetTeamPlayerDocumentsStatus : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/catalog/team/{teamId}/documents",
                    [Authorize(Roles = "Coach,Administrator")]
                    async (string teamId, string documentTypeId, IMediator mediator, CancellationToken ct) =>
                        Results.Ok(await mediator.Send(new TeamPlayerDocumentsStatusQuery(teamId, documentTypeId), ct)))
                .WithName(nameof(GetTeamPlayerDocumentsStatus))
                .RequireAuthorization();
        }

        // NOTE: no SeasonId here — Team is itself season-scoped (design.md Decision 7); teamId
        // alone already identifies a single season's roster, exactly like GetPlayersByTeam.cs.
        public record TeamPlayerDocumentsStatusQuery(string TeamId, string DocumentTypeId) : IQueryApp<TeamPlayerDocumentStatusResponse[]>;

        public record TeamPlayerDocumentStatusResponse(
            string TeamPlayerId, string PlayerId, string PlayerName, string? PlayerLastName, string Alias, string? UrlPhoto, int? Dorsal,
            string Status, DateTime? UploadedAt, DateTime? ReviewedAt);

        public class Handler(AppDbContext db) : IRequestHandler<TeamPlayerDocumentsStatusQuery, TeamPlayerDocumentStatusResponse[]>
        {
            public async ValueTask<TeamPlayerDocumentStatusResponse[]> Handle(
                TeamPlayerDocumentsStatusQuery request, CancellationToken cancellationToken)
            {
                // Mirrors GetPlayersByTeam.cs's Where(tp => tp.TeamId == teamId) exactly — no
                // season filter, because a teamId can only ever have TeamPlayers from its own season.
                var roster = await db.TeamPlayers.AsNoTracking()
                    .Include(tp => tp.Player)
                    .Where(tp => tp.TeamId == request.TeamId)
                    .Select(tp => new
                    {
                        tp.Id,
                        tp.PlayerId,
                        Name = tp.Player.Name,
                        LastName = tp.Player.LastName,
                        Alias = tp.Player.Alias,
                        UrlPhoto = tp.Player.UrlPhoto,
                        Dorsal = tp.Dorsal != null ? tp.Dorsal.Number : (int?)null
                    })
                    .ToListAsync(cancellationToken);

                var docs = await db.PlayerDocuments.AsNoTracking()
                    .Where(pd => pd.DocumentTypeId == request.DocumentTypeId && roster.Select(r => r.Id).Contains(pd.TeamPlayerId))
                    .ToListAsync(cancellationToken);

                return roster.Select(r =>
                {
                    var doc = docs.FirstOrDefault(d => d.TeamPlayerId == r.Id);
                    return new TeamPlayerDocumentStatusResponse(
                        r.Id, r.PlayerId, r.Name, r.LastName, r.Alias, r.UrlPhoto, r.Dorsal,
                        doc?.Status.Name ?? "Pending", doc?.UploadedAt, doc?.ReviewedAt);
                }).ToArray();
            }
        }
    }
}
