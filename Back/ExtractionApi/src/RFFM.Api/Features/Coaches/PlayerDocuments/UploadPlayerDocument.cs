using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities.PlayerDocuments;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Infrastructure.Storage;

namespace RFFM.Api.Features.Coaches.PlayerDocuments
{
    public class UploadPlayerDocument : IFeatureModule
    {
        private const string PlayerDocumentsBucket = "player-documents";
        private const long MaxFileSizeBytes = 10 * 1024 * 1024;
        private static readonly HashSet<string> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase)
        {
            "application/pdf", "image/jpeg", "image/png"
        };

        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/catalog/teamplayer/{teamPlayerId}/documents/{documentTypeId}",
                    [Authorize(Roles = "Coach,Administrator,Player,FamilyMember")]
                    async (string teamPlayerId, string documentTypeId, IFormFile file,
                        AppDbContext db, ICurrentUserService currentUser, IStorageService storageService,
                        CancellationToken ct) =>
                    {
                        var isPrivileged = GetPlayerDocuments.IsPrivileged(currentUser);
                        if (!isPrivileged && !await GetPlayerDocuments.IsOwnTeamPlayer(db, currentUser, teamPlayerId, ct))
                            return Results.Problem(
                                statusCode: StatusCodes.Status403Forbidden,
                                title: "No autorizado",
                                detail: "No tienes permiso para subir documentos de este jugador.",
                                extensions: new Dictionary<string, object?> { ["code"] = ErrorCodes.PlayerDocumentAccessForbidden });

                        if (file is null || file.Length == 0 || !AllowedContentTypes.Contains(file.ContentType))
                            return Results.ValidationProblem(new Dictionary<string, string[]>
                            {
                                ["file"] = new[] { "El fichero debe ser un PDF, JPG o PNG." }
                            }, extensions: new Dictionary<string, object?> { ["code"] = ErrorCodes.PlayerDocumentInvalidFile });

                        if (file.Length > MaxFileSizeBytes)
                            return Results.ValidationProblem(new Dictionary<string, string[]>
                            {
                                ["file"] = new[] { "El fichero no puede superar los 10 MB." }
                            }, extensions: new Dictionary<string, object?> { ["code"] = ErrorCodes.PlayerDocumentFileTooLarge });

                        var teamPlayerExists = await db.TeamPlayers.AnyAsync(tp => tp.Id == teamPlayerId, ct);
                        if (!teamPlayerExists) return Results.NotFound();

                        var documentType = await db.DocumentTypes.FirstOrDefaultAsync(d => d.Id == documentTypeId, ct);
                        if (documentType is null)
                            return Results.Problem(
                                statusCode: StatusCodes.Status404NotFound,
                                title: "Tipo de documento no encontrado",
                                extensions: new Dictionary<string, object?> { ["code"] = ErrorCodes.DocumentTypeNotFound });

                        var existing = await db.PlayerDocuments
                            .FirstOrDefaultAsync(pd => pd.TeamPlayerId == teamPlayerId && pd.DocumentTypeId == documentTypeId, ct);

                        var storedFileName = $"{teamPlayerId}/{documentTypeId}/{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
                        var previousUrl = existing?.StorageUrl;

                        var url = await storageService.UploadAsync(PlayerDocumentsBucket, storedFileName, file, ct);

                        var uploadedOnBehalf = isPrivileged && !await GetPlayerDocuments.IsOwnTeamPlayer(db, currentUser, teamPlayerId, ct);

                        if (existing is null)
                        {
                            existing = PlayerDocument.Create(
                                teamPlayerId, documentTypeId, file.FileName, url, file.ContentType,
                                currentUser.UserId!, uploadedOnBehalf);
                            db.PlayerDocuments.Add(existing);
                        }
                        else
                        {
                            existing.ReplaceFile(file.FileName, url, file.ContentType, currentUser.UserId!, uploadedOnBehalf);
                        }

                        await db.SaveChangesAsync(ct);

                        if (previousUrl is not null)
                        {
                            var previousPath = ExtractFilePath(previousUrl, PlayerDocumentsBucket);
                            try { await storageService.DeleteAsync(PlayerDocumentsBucket, previousPath, ct); }
                            catch { /* best-effort, do not fail the upload */ }
                        }

                        return Results.Ok(new GetPlayerDocuments.PlayerDocumentResponse(
                            documentTypeId, documentType.Name, teamPlayerId, existing.Status.Name,
                            existing.FileName, existing.StorageUrl, existing.ContentType, existing.UploadedAt,
                            existing.UploadedOnBehalf, existing.ReviewedAt, existing.ReviewNote));
                    })
                .WithName(nameof(UploadPlayerDocument))
                .RequireAuthorization()
                .DisableAntiforgery();
        }

        /// <summary>Same helper as SetTeamInjuryProtocol.cs — recovers the storage-relative path
        /// from a stored URL that may be a bare "bucket/path" or an absolute public URL.</summary>
        private static string ExtractFilePath(string storageUrl, string bucket)
        {
            var marker = $"{bucket}/";
            var index = storageUrl.IndexOf(marker, StringComparison.Ordinal);
            return index >= 0 ? storageUrl[(index + marker.Length)..] : storageUrl;
        }
    }
}
