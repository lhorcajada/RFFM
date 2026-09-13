using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Entities.Teams;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.Teams;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Infrastructure.Storage;

namespace RFFM.Api.Features.Coaches.Teams.InjuryProtocol
{
    // Mirrors SetPlayerSanction.cs/SetPlayerInjury.cs's rationale exactly: inline Minimal API
    // handlers (not Mediator ICommand/IQueryApp) for a simple per-team CRUD sub-resource, so
    // FluentValidation/pipeline behaviors don't apply here either (add-injury-protocol-and-
    // documents-tabs, design.md Decisión 1). GET stays open to every authenticated role; writes
    // (PUT/DELETE/attachments POST/DELETE) are restricted via
    // [Authorize(Roles = "Coach,Administrator")].
    public class SetTeamInjuryProtocol : IFeatureModule
    {
        private const string AttachmentsBucket = "injury-protocol-attachments";
        private const long MaxAttachmentSizeBytes = 10 * 1024 * 1024; // 10 MB

        public void AddRoutes(IEndpointRouteBuilder app)
        {
            // GET the team's protocol — 200 with content: null / attachments: [] if no row exists
            // yet (design.md Decisión 2: not a 404, so the frontend needn't special-case it).
            app.MapGet("/api/catalog/team/{teamId}/injury-protocol",
                async (string teamId, AppDbContext db, CancellationToken ct) =>
                {
                    var protocol = await db.TeamInjuryProtocols
                        .AsNoTracking()
                        .Include(p => p.Attachments)
                        .FirstOrDefaultAsync(p => p.TeamId == teamId, ct);

                    if (protocol is null)
                        return Results.Ok(new InjuryProtocolResponse(teamId, null, null, Array.Empty<InjuryProtocolAttachmentResponse>()));

                    return Results.Ok(ToResponse(protocol));
                })
            .WithName("GetTeamInjuryProtocol")
            .WithTags(TeamConstants.TeamFeature)
            .Produces<InjuryProtocolResponse>()
            .RequireAuthorization();

            // PUT upsert the protocol's Content (design.md Decisión 2/3: singleton per team,
            // created lazily on first write).
            app.MapPut("/api/catalog/team/{teamId}/injury-protocol",
                [Authorize(Roles = "Coach,Administrator")]
                async (string teamId, UpdateInjuryProtocolRequest req, AppDbContext db, ICurrentUserService currentUser, CancellationToken ct) =>
                {
                    var teamExists = await db.Teams.AnyAsync(t => t.Id == teamId, ct);
                    if (!teamExists) return Results.NotFound();

                    var protocol = await db.TeamInjuryProtocols
                        .Include(p => p.Attachments)
                        .FirstOrDefaultAsync(p => p.TeamId == teamId, ct);

                    if (protocol is null)
                    {
                        protocol = Domain.Entities.Teams.TeamInjuryProtocol.Create(teamId);
                        db.TeamInjuryProtocols.Add(protocol);
                    }

                    try
                    {
                        protocol.UpdateContent(req.Content, currentUser.UserId);
                    }
                    catch (ArgumentException ex)
                    {
                        return Results.ValidationProblem(new Dictionary<string, string[]> { ["content"] = new[] { ex.Message } });
                    }

                    await db.SaveChangesAsync(ct);

                    return Results.Ok(ToResponse(protocol));
                })
            .WithName("UpdateTeamInjuryProtocol")
            .WithTags(TeamConstants.TeamFeature)
            .Accepts<UpdateInjuryProtocolRequest>("application/json")
            .Produces<InjuryProtocolResponse>()
            .RequireAuthorization();

            // DELETE clears Content but keeps the row and its attachments (design.md Decisión 2).
            app.MapDelete("/api/catalog/team/{teamId}/injury-protocol",
                [Authorize(Roles = "Coach,Administrator")]
                async (string teamId, AppDbContext db, ICurrentUserService currentUser, CancellationToken ct) =>
                {
                    var protocol = await db.TeamInjuryProtocols
                        .FirstOrDefaultAsync(p => p.TeamId == teamId, ct);
                    if (protocol is null) return Results.NoContent();

                    protocol.ClearContent(currentUser.UserId);
                    await db.SaveChangesAsync(ct);

                    return Results.NoContent();
                })
            .WithName("DeleteTeamInjuryProtocol")
            .WithTags(TeamConstants.TeamFeature)
            .RequireAuthorization();

            // POST upload a PDF attachment (mirrors UploadPlayerPhoto.cs's IStorageService pattern).
            app.MapPost("/api/catalog/team/{teamId}/injury-protocol/attachments",
                [Authorize(Roles = "Coach,Administrator")]
                async (string teamId, IFormFile file, AppDbContext db, IStorageService storageService, CancellationToken ct) =>
                {
                    var teamExists = await db.Teams.AnyAsync(t => t.Id == teamId, ct);
                    if (!teamExists) return Results.NotFound();

                    if (file is null || file.Length == 0)
                        return Results.ValidationProblem(new Dictionary<string, string[]>
                        {
                            ["file"] = new[] { "El fichero es obligatorio." }
                        });

                    if (file.ContentType != "application/pdf")
                        return Results.ValidationProblem(new Dictionary<string, string[]>
                        {
                            ["file"] = new[] { "Solo se permiten ficheros PDF." }
                        });

                    if (file.Length > MaxAttachmentSizeBytes)
                        return Results.ValidationProblem(new Dictionary<string, string[]>
                        {
                            ["file"] = new[] { "El fichero no puede superar los 10 MB." }
                        });

                    var protocol = await db.TeamInjuryProtocols
                        .Include(p => p.Attachments)
                        .FirstOrDefaultAsync(p => p.TeamId == teamId, ct);

                    if (protocol is null)
                    {
                        protocol = Domain.Entities.Teams.TeamInjuryProtocol.Create(teamId);
                        db.TeamInjuryProtocols.Add(protocol);
                        await db.SaveChangesAsync(ct);
                    }

                    var storedFileName = $"{teamId}/{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
                    var url = await storageService.UploadAsync(AttachmentsBucket, storedFileName, file, ct);

                    var attachment = TeamInjuryProtocolAttachment.Create(protocol.Id, file.FileName, url, file.ContentType);
                    db.TeamInjuryProtocolAttachments.Add(attachment);
                    await db.SaveChangesAsync(ct);

                    return Results.Created(
                        $"/api/catalog/team/{teamId}/injury-protocol/attachments/{attachment.Id}",
                        ToAttachmentResponse(attachment));
                })
            .WithName("UploadTeamInjuryProtocolAttachment")
            .WithTags(TeamConstants.TeamFeature)
            .Produces<InjuryProtocolAttachmentResponse>(StatusCodes.Status201Created)
            .RequireAuthorization()
            .DisableAntiforgery();

            // DELETE removes an attachment from storage and from the database.
            app.MapDelete("/api/catalog/team/{teamId}/injury-protocol/attachments/{attachmentId}",
                [Authorize(Roles = "Coach,Administrator")]
                async (string teamId, string attachmentId, AppDbContext db, IStorageService storageService, CancellationToken ct) =>
                {
                    var attachment = await db.TeamInjuryProtocolAttachments
                        .Include(a => a.Protocol)
                        .FirstOrDefaultAsync(a => a.Id == attachmentId && a.Protocol.TeamId == teamId, ct);
                    if (attachment is null) return Results.NotFound();

                    var filePath = ExtractFilePath(attachment.StorageUrl, AttachmentsBucket);
                    await storageService.DeleteAsync(AttachmentsBucket, filePath, ct);

                    db.TeamInjuryProtocolAttachments.Remove(attachment);
                    await db.SaveChangesAsync(ct);

                    return Results.NoContent();
                })
            .WithName("DeleteTeamInjuryProtocolAttachment")
            .WithTags(TeamConstants.TeamFeature)
            .RequireAuthorization();
        }

        /// <summary>Recovers the storage-relative file path from a stored URL, which may be a bare
        /// "bucket/path" (LocalStorageService) or an absolute public URL (SupabaseStorageService)
        /// — both contain "{bucket}/" immediately before the file path.</summary>
        private static string ExtractFilePath(string storageUrl, string bucket)
        {
            var marker = $"{bucket}/";
            var index = storageUrl.IndexOf(marker, StringComparison.Ordinal);
            return index >= 0 ? storageUrl[(index + marker.Length)..] : storageUrl;
        }

        private static InjuryProtocolResponse ToResponse(Domain.Entities.Teams.TeamInjuryProtocol protocol)
            => new(
                protocol.TeamId,
                protocol.Content,
                protocol.UpdatedAt,
                protocol.Attachments.Select(ToAttachmentResponse).ToArray());

        private static InjuryProtocolAttachmentResponse ToAttachmentResponse(TeamInjuryProtocolAttachment attachment)
            => new(attachment.Id, attachment.FileName, attachment.StorageUrl, attachment.UploadedAt);

        public record UpdateInjuryProtocolRequest(string Content);

        public record InjuryProtocolResponse(string TeamId, string? Content, DateTime? UpdatedAt, InjuryProtocolAttachmentResponse[] Attachments);

        public record InjuryProtocolAttachmentResponse(string Id, string FileName, string Url, DateTime UploadedAt);
    }
}
