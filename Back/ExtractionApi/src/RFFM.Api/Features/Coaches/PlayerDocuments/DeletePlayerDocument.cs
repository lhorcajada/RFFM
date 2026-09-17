using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Infrastructure.Storage;

namespace RFFM.Api.Features.Coaches.PlayerDocuments
{
    // Same ownership-branching pattern as GetPlayerDocuments/UploadPlayerDocument:
    // Player/FamilyMember may only delete their OWN linked TeamPlayer's document,
    // Coach/Administrator may delete anyone's (e.g. undo a wrong upload-on-behalf).
    // Deleting the row makes the document revert to the synthesized "Pending" status.
    public class DeletePlayerDocument : IFeatureModule
    {
        private const string PlayerDocumentsBucket = "player-documents";

        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapDelete("/api/catalog/teamplayer/{teamPlayerId}/documents/{documentTypeId}",
                    [Authorize(Roles = "Coach,Administrator,Player,FamilyMember")]
                    async (string teamPlayerId, string documentTypeId,
                        AppDbContext db, ICurrentUserService currentUser, IStorageService storageService,
                        CancellationToken ct) =>
                    {
                        var isPrivileged = GetPlayerDocuments.IsPrivileged(currentUser);
                        if (!isPrivileged && !await GetPlayerDocuments.IsOwnTeamPlayer(db, currentUser, teamPlayerId, ct))
                            return Results.Problem(
                                statusCode: StatusCodes.Status403Forbidden,
                                title: "No autorizado",
                                detail: "No tienes permiso para eliminar documentos de este jugador.",
                                extensions: new Dictionary<string, object?> { ["code"] = ErrorCodes.PlayerDocumentAccessForbidden });

                        var existing = await db.PlayerDocuments
                            .FirstOrDefaultAsync(pd => pd.TeamPlayerId == teamPlayerId && pd.DocumentTypeId == documentTypeId, ct);

                        if (existing is null)
                            return Results.Problem(
                                statusCode: StatusCodes.Status404NotFound,
                                title: "Documento no encontrado",
                                extensions: new Dictionary<string, object?> { ["code"] = ErrorCodes.PlayerDocumentNotFound });

                        db.PlayerDocuments.Remove(existing);
                        await db.SaveChangesAsync(ct);

                        var previousPath = ExtractFilePath(existing.StorageUrl, PlayerDocumentsBucket);
                        try { await storageService.DeleteAsync(PlayerDocumentsBucket, previousPath, ct); }
                        catch { /* best-effort, do not fail the delete */ }

                        return Results.NoContent();
                    })
                .WithName(nameof(DeletePlayerDocument))
                .RequireAuthorization();
        }

        /// <summary>Same helper as UploadPlayerDocument.cs.</summary>
        private static string ExtractFilePath(string storageUrl, string bucket)
        {
            var marker = $"{bucket}/";
            var index = storageUrl.IndexOf(marker, StringComparison.Ordinal);
            return index >= 0 ? storageUrl[(index + marker.Length)..] : storageUrl;
        }
    }
}
