using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Infrastructure.Storage;

namespace RFFM.Api.Features.Mobile.Teams.Commands
{
    /// <summary>
    /// Uploads (or replaces) a team's rules document (PDF), used by the Mobile "Normas del
    /// equipo" screen. Coach/Admin only. Any previously uploaded document is deleted.
    /// POST /api/mobile/teams/{teamId}/rules-document
    /// </summary>
    public class UploadTeamRulesDocument : IFeatureModule
    {
        public const string ContainerName = "team-rules-documents";

        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("api/mobile/teams/{teamId}/rules-document",
                    async (string teamId, IFormFile file, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var command = new UploadTeamRulesDocumentCommand { TeamId = teamId, File = file };
                        var result = await mediator.Send(command, cancellationToken);
                        return Results.Ok(result);
                    })
                .WithName(nameof(UploadTeamRulesDocument))
                .WithTags("Mobile")
                .Produces<UploadTeamRulesDocumentResult>(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces<ProblemDetails>(StatusCodes.Status403Forbidden)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound)
                .DisableAntiforgery();
        }

        // ─── Command ──────────────────────────────────────────────────────────

        public record UploadTeamRulesDocumentCommand
            : IRequest<UploadTeamRulesDocumentResult>, IRequireFeaturePermission, IRequireTeamMembership
        {
            public string TeamId { get; set; } = null!;
            public IFormFile File { get; set; } = null!;

            public string FeatureRoute => CoachFeatureRoutes.TeamRulesDocument;
            public string RequiredPermission => "ReadWrite";
        }

        public record UploadTeamRulesDocumentResult(string Url, DateTime UploadedAt);

        // ─── Validator ────────────────────────────────────────────────────────

        public class Validator : AbstractValidator<UploadTeamRulesDocumentCommand>
        {
            public const long MaxFileSizeBytes = 20 * 1024 * 1024;

            public Validator()
            {
                RuleFor(r => r.TeamId).NotEmpty();

                RuleFor(r => r.File)
                    .NotNull()
                    .Must(file => file.Length > 0)
                    .WithMessage("File cannot be empty.");

                RuleFor(r => r.File.ContentType)
                    .Equal("application/pdf")
                    .WithMessage("Only PDF files are allowed.")
                    .When(r => r.File != null);

                RuleFor(r => r.File.Length)
                    .LessThanOrEqualTo(MaxFileSizeBytes)
                    .WithMessage("File cannot be larger than 20 MB.")
                    .When(r => r.File != null);
            }
        }

        // ─── Handler ──────────────────────────────────────────────────────────

        public class Handler(AppDbContext db, IStorageService storageService)
            : IRequestHandler<UploadTeamRulesDocumentCommand, UploadTeamRulesDocumentResult>
        {
            public async ValueTask<UploadTeamRulesDocumentResult> Handle(
                UploadTeamRulesDocumentCommand request, CancellationToken cancellationToken)
            {
                var team = await db.Teams
                    .SingleOrDefaultAsync(t => t.Id == request.TeamId, cancellationToken);

                if (team == null)
                    throw new NotFoundException("Equipo no encontrado", "TeamNotFound");

                var previousUrl = team.RulesDocumentUrl;

                var fileName = $"{Guid.NewGuid()}.pdf";
                var url = await storageService.UploadAsync(ContainerName, fileName, request.File, cancellationToken);

                team.UpdateRulesDocumentUrl(url);
                await db.SaveChangesAsync(cancellationToken);

                if (!string.IsNullOrEmpty(previousUrl))
                    await storageService.DeleteAsync(ContainerName, Path.GetFileName(previousUrl), cancellationToken);

                return new UploadTeamRulesDocumentResult(url, DateTime.UtcNow);
            }
        }
    }
}
