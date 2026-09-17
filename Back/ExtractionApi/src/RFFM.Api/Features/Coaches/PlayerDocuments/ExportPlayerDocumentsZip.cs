using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Infrastructure.Storage;
using RFFM.Api.Services.Export;

namespace RFFM.Api.Features.Coaches.PlayerDocuments
{
    public class ExportPlayerDocumentsZip : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/catalog/team/{teamId}/documents/zip",
                    [Authorize(Roles = "Coach,Administrator")]
                    async (string teamId, string documentTypeId, IMediator mediator, CancellationToken ct) =>
                    {
                        var result = await mediator.Send(new ExportPlayerDocumentsZipQuery(teamId, documentTypeId), ct);
                        return result is null
                            ? Results.NotFound()
                            : Results.File(result.Bytes, result.ContentType, result.FileName);
                    })
                .WithName(nameof(ExportPlayerDocumentsZip))
                .RequireAuthorization();
        }

        public record ExportPlayerDocumentsZipQuery(string TeamId, string DocumentTypeId) : RFFM.Api.Common.ICommand<ExportZipResult?>;

        public class Handler(AppDbContext db, IStorageService storageService, PlayerDocumentsZipBuilder zipBuilder)
            : IRequestHandler<ExportPlayerDocumentsZipQuery, ExportZipResult?>
        {
            public async ValueTask<ExportZipResult?> Handle(ExportPlayerDocumentsZipQuery request, CancellationToken cancellationToken)
            {
                var team = await db.Teams.AsNoTracking()
                    .Include(t => t.Season)
                    .FirstOrDefaultAsync(t => t.Id == request.TeamId, cancellationToken);

                if (team is null) return null;

                var documentType = await db.DocumentTypes.AsNoTracking()
                    .FirstOrDefaultAsync(d => d.Id == request.DocumentTypeId, cancellationToken);

                if (documentType is null) return null;

                // Mirrors GetTeamPlayerDocumentsStatus.cs's roster query exactly — no season
                // filter, because a teamId can only ever have TeamPlayers from its own season.
                var roster = await db.TeamPlayers.AsNoTracking()
                    .Include(tp => tp.Player)
                    .Where(tp => tp.TeamId == request.TeamId)
                    .Select(tp => new { tp.Id, Alias = tp.Player.Alias, Name = tp.Player.Name })
                    .ToListAsync(cancellationToken);

                var rosterIds = roster.Select(r => r.Id).ToList();

                // Only rows with an actual uploaded file (StorageUrl set) can be zipped — Pending
                // players never have a PlayerDocument row (see PlayerDocument.cs's class comment).
                var docs = await db.PlayerDocuments.AsNoTracking()
                    .Where(pd => pd.DocumentTypeId == request.DocumentTypeId && rosterIds.Contains(pd.TeamPlayerId))
                    .ToListAsync(cancellationToken);

                if (docs.Count == 0) return null;

                var entries = new List<PlayerDocumentZipEntry>();
                foreach (var doc in docs)
                {
                    var download = await storageService.DownloadAsync(doc.StorageUrl, cancellationToken);
                    if (download is null) continue;

                    var player = roster.FirstOrDefault(r => r.Id == doc.TeamPlayerId);
                    var label = !string.IsNullOrWhiteSpace(player?.Alias) ? player!.Alias : (player?.Name ?? doc.TeamPlayerId);
                    var extension = Path.GetExtension(doc.FileName);
                    entries.Add(new PlayerDocumentZipEntry($"{label}{extension}", download.Value.Content));
                }

                if (entries.Count == 0) return null;

                var zipBytes = zipBuilder.BuildZip(entries);

                var sanitizedDocTypeName = documentType.Name.Replace(" ", "_").Replace("/", "-");
                var sanitizedSeasonName = (team.Season?.Name ?? "Unknown").Replace(" ", "_").Replace("/", "-");
                var fileName = $"Documentos_{sanitizedDocTypeName}_{sanitizedSeasonName}_{DateTime.UtcNow:yyyyMMdd}.zip";

                return new ExportZipResult(zipBytes, fileName, "application/zip");
            }
        }
    }

    public record ExportZipResult(byte[] Bytes, string FileName, string ContentType);
}
