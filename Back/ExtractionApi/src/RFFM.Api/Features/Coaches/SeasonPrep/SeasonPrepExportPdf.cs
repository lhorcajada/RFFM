using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Entities.Coaches;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Features.Coaches.SportEvents.Queries;
using RFFM.Api.Services.Export;
using System.Text.Json;

namespace RFFM.Api.Features.Coaches.SeasonPrep
{
    public class ExportSeasonPrepPdf : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("api/season-prep/export",
                    async (ExportSeasonPrepCommand command, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(command, cancellationToken);
                        if (result is null) return Results.StatusCode(StatusCodes.Status500InternalServerError);
                        return Results.File(result.Bytes, result.ContentType, result.FileName);
                    })
                .WithName(nameof(ExportSeasonPrepPdf))
                .WithTags("SeasonPrep")
                .Accepts<ExportSeasonPrepCommand>("application/json")
                .Produces(StatusCodes.Status200OK)
                .RequireAuthorization();
        }
    }

    public record ExportSeasonPrepCommand(string Data, string? SportEventId, bool SaveBeforeExport, bool TemplateMode, bool ListMode, int? TeamIndex, string? ClubName, string? ClubLogoBase64) : IRequest<ExportPdfResult>;

    public record ExportPdfResult(byte[] Bytes, string FileName, string ContentType);

    public class ExportSeasonPrepHandler : IRequestHandler<ExportSeasonPrepCommand, ExportPdfResult>
    {
        private readonly AppDbContext _db;
        private readonly SeasonPrepPdfGenerator _generator;
        private readonly IMediator _mediator;

        public ExportSeasonPrepHandler(AppDbContext db, IMediator mediator, SeasonPrepPdfGenerator generator)
        {
            _db = db;
            _mediator = mediator;
            _generator = generator;
        }

        public async ValueTask<ExportPdfResult> Handle(ExportSeasonPrepCommand request, CancellationToken cancellationToken)
        {
            if (request.SaveBeforeExport)
            {
                var session = await _db.SeasonPrepAllTeamsSessions.FirstOrDefaultAsync(s => s.SportEventId == request.SportEventId, cancellationToken);

                if (session is null)
                {
                    session = new SeasonPrepAllTeamsSession
                    {
                        SportEventId = request.SportEventId,
                        Data = request.Data,
                        UpdatedAt = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Utc),
                    };
                    _db.SeasonPrepAllTeamsSessions.Add(session);
                }
                else
                {
                    session.Data = request.Data;
                    session.UpdatedAt = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Utc);
                }

                await _db.SaveChangesAsync(cancellationToken);
            }

            // Try to obtain sport event info for date/labels
            DateTime? eventDate = null;
            string? teamNameFromEvent = null;
            if (!string.IsNullOrWhiteSpace(request.SportEventId))
            {
                try
                {
                    var ev = await _mediator.Send(new GetSportEventItem.SportEventItemQuery { Id = request.SportEventId }, cancellationToken);
                    if (ev is not null)
                    {
                        eventDate = ev.EveDateTime;
                        teamNameFromEvent = ev.TeamName ?? ev.Name;
                    }
                }
                catch
                {
                    // ignore lookup failures
                }
            }

            // Generate PDF bytes
            // When generating a printable template, ignore any passed club name so the generator prints placeholders
            var clubNameParam = request.TemplateMode ? null : (request.ClubName ?? teamNameFromEvent);
            var pdfBytes = await _generator.GeneratePdfAsync(request.Data, request.SportEventId, request.TemplateMode, clubNameParam, request.ClubLogoBase64, request.ListMode, request.TeamIndex);

            var filename = $"Preparacion_{(eventDate.HasValue ? eventDate.Value.ToString("yyyyMMdd") : DateTime.UtcNow.ToString("yyyyMMdd_HHmmss"))}.pdf";
            return new ExportPdfResult(pdfBytes, filename, "application/pdf");
        }
    }
}
