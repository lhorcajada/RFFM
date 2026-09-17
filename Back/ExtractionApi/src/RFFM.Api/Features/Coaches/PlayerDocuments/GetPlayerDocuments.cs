using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.PlayerDocuments
{
    // Ownership-branching inline Minimal API handler, mirroring UpdateTeamPlayer.cs's rationale
    // exactly: Player/FamilyMember may only read their OWN linked TeamPlayer's documents
    // (UserTeam.LinkedTeamPlayerId), Coach/Administrator may read anyone's.
    public class GetPlayerDocuments : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/catalog/teamplayer/{teamPlayerId}/documents",
                    [Authorize(Roles = "Coach,Administrator,Player,FamilyMember")]
                    async (string teamPlayerId, AppDbContext db, ICurrentUserService currentUser, CancellationToken ct) =>
                    {
                        var isPrivileged = IsPrivileged(currentUser);
                        if (!isPrivileged && !await IsOwnTeamPlayer(db, currentUser, teamPlayerId, ct))
                            return Results.Problem(
                                statusCode: StatusCodes.Status403Forbidden,
                                title: "No autorizado",
                                detail: "No tienes permiso para ver los documentos de este jugador.",
                                extensions: new Dictionary<string, object?> { ["code"] = ErrorCodes.PlayerDocumentAccessForbidden });

                        var teamPlayerExists = await db.TeamPlayers.AnyAsync(tp => tp.Id == teamPlayerId, ct);
                        if (!teamPlayerExists) return Results.NotFound();

                        var responses = await BuildResponses(db, teamPlayerId, ct);
                        return Results.Ok(responses);
                    })
                .WithName(nameof(GetPlayerDocuments))
                .RequireAuthorization();
        }

        internal static bool IsPrivileged(ICurrentUserService currentUser)
            => (currentUser.Roles ?? Enumerable.Empty<string>())
                .Any(r => string.Equals(r, "Coach", StringComparison.OrdinalIgnoreCase) ||
                          string.Equals(r, "Administrator", StringComparison.OrdinalIgnoreCase));

        internal static async Task<bool> IsOwnTeamPlayer(AppDbContext db, ICurrentUserService currentUser, string teamPlayerId, CancellationToken ct)
            => await db.Set<UserTeam>().AsNoTracking()
                .AnyAsync(ut => ut.ApplicationUserId == currentUser.UserId && ut.LinkedTeamPlayerId == teamPlayerId, ct);

        internal static async Task<PlayerDocumentResponse[]> BuildResponses(AppDbContext db, string teamPlayerId, CancellationToken ct)
        {
            var activeTypes = await db.DocumentTypes.AsNoTracking().Where(d => d.IsActive).ToListAsync(ct);
            var existingDocs = await db.PlayerDocuments.AsNoTracking()
                .Where(pd => pd.TeamPlayerId == teamPlayerId)
                .ToListAsync(ct);

            return activeTypes.Select(type =>
            {
                var doc = existingDocs.FirstOrDefault(d => d.DocumentTypeId == type.Id);
                return doc is null
                    ? new PlayerDocumentResponse(type.Id, type.Name, teamPlayerId, "Pending", null, null, null, null, null, null, null)
                    : new PlayerDocumentResponse(
                        type.Id, type.Name, teamPlayerId, doc.Status.Name,
                        doc.FileName, doc.StorageUrl, doc.ContentType, doc.UploadedAt, doc.UploadedOnBehalf,
                        doc.ReviewedAt, doc.ReviewNote);
            }).ToArray();
        }

        public record PlayerDocumentResponse(
            string DocumentTypeId, string DocumentTypeName, string TeamPlayerId, string Status,
            string? FileName, string? Url, string? ContentType, DateTime? UploadedAt,
            bool? UploadedOnBehalf, DateTime? ReviewedAt, string? ReviewNote);
    }
}
