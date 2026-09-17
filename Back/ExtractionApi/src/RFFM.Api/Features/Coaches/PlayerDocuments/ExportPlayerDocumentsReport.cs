using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Services.Export;

namespace RFFM.Api.Features.Coaches.PlayerDocuments
{
    public class ExportPlayerDocumentsReport : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/catalog/team/{teamId}/documents/report",
                    [Authorize(Roles = "Coach,Administrator")]
                    async (string teamId, string documentTypeId, IMediator mediator, CancellationToken ct) =>
                    {
                        var result = await mediator.Send(new ExportPlayerDocumentsReportQuery(teamId, documentTypeId), ct);
                        return result is null
                            ? Results.NotFound()
                            : Results.File(result.Bytes, result.ContentType, result.FileName);
                    })
                .WithName(nameof(ExportPlayerDocumentsReport))
                .RequireAuthorization();
        }

        public record ExportPlayerDocumentsReportQuery(string TeamId, string DocumentTypeId) : RFFM.Api.Common.ICommand<ExportPdfResult?>;

        public class Handler(AppDbContext db, IMediator mediator, PlayerDocumentsReportPdfGenerator pdfGenerator)
            : IRequestHandler<ExportPlayerDocumentsReportQuery, ExportPdfResult?>
        {
            public async ValueTask<ExportPdfResult?> Handle(ExportPlayerDocumentsReportQuery request, CancellationToken cancellationToken)
            {
                var team = await db.Teams.AsNoTracking()
                    .Include(t => t.Season)
                    .FirstOrDefaultAsync(t => t.Id == request.TeamId, cancellationToken);

                if (team is null) return null;

                var documentType = await db.DocumentTypes.AsNoTracking()
                    .FirstOrDefaultAsync(d => d.Id == request.DocumentTypeId, cancellationToken);

                if (documentType is null) return null;

                var statusQuery = new GetTeamPlayerDocumentsStatus.TeamPlayerDocumentsStatusQuery(request.TeamId, request.DocumentTypeId);
                var statuses = await mediator.Send(statusQuery, cancellationToken);

                // PlayerDocumentsReportPdfGenerator groups rows by the raw English status codes
                // ("Pending"/"Delivered"/"Approved"/"Rejected") and translates them itself — do not
                // translate here, or the generator's grouping filter will never match any row.
                var rows = statuses.Select(s => (BuildFullName(s.PlayerName, s.PlayerLastName), s.Dorsal, s.Status)).ToList();

                var pdf = pdfGenerator.GeneratePdf(team.Name, documentType.Name, team.Season?.Name ?? "N/A", rows);

                var sanitizedDocTypeName = documentType.Name.Replace(" ", "_").Replace("/", "-");
                var sanitizedSeasonName = (team.Season?.Name ?? "Unknown").Replace(" ", "_").Replace("/", "-");
                var fileName = $"Documentos_{sanitizedDocTypeName}_{sanitizedSeasonName}_{DateTime.UtcNow:yyyyMMdd}.pdf";

                return new ExportPdfResult(pdf, fileName, "application/pdf");
            }

            internal static string BuildFullName(string name, string? lastName)
                => string.IsNullOrWhiteSpace(lastName) ? name : $"{name} {lastName}";
        }
    }

    public record ExportPdfResult(byte[] Bytes, string FileName, string ContentType);
}
