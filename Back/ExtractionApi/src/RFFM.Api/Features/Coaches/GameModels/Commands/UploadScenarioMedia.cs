using System.Collections.Generic;
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

namespace RFFM.Api.Features.Coaches.GameModels.Commands
{
    /// <summary>
    /// Uploads an image or video for a game scenario, replacing (and deleting) any previous media.
    /// POST /api/game-models/scenarios/{id}/media
    /// </summary>
    public class UploadScenarioMedia : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/game-models/scenarios/{id}/media",
                    async (string id, IFormFile file, HttpContext httpContext, IMediator mediator, CancellationToken ct) =>
                    {
                        var userId = httpContext.User.Claims
                            .FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;
                        if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

                        var result = await mediator.Send(new UploadScenarioMediaCommand(id, file, userId), ct);
                        return Results.Ok(result);
                    })
                .WithName(nameof(UploadScenarioMedia))
                .WithTags(GameModelConstants.Tag)
                .RequireAuthorization()
                .DisableAntiforgery()
                .Produces<UploadScenarioMediaResult>()
                .Produces(StatusCodes.Status401Unauthorized)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest);
        }
    }

    public record UploadScenarioMediaCommand(string ScenarioId, IFormFile File, string UserId)
        : IRequest<UploadScenarioMediaResult>, IRequireFeaturePermission
    {
        public string FeatureRoute => CoachFeatureRoutes.GameModel;
        public string RequiredPermission => "ReadWrite";
    }

    public record UploadScenarioMediaResult(string Url, string MediaType);

    public class UploadScenarioMediaHandler : IRequestHandler<UploadScenarioMediaCommand, UploadScenarioMediaResult>
    {
        private const string Bucket = "game-scenarios";

        private readonly AppDbContext _db;
        private readonly IStorageService _storage;

        public UploadScenarioMediaHandler(AppDbContext db, IStorageService storage)
        {
            _db = db;
            _storage = storage;
        }

        public async ValueTask<UploadScenarioMediaResult> Handle(UploadScenarioMediaCommand request, CancellationToken ct = default)
        {
            var scenario = await _db.GameScenarios
                .Include(s => s.GamePrinciple)
                    .ThenInclude(p => p.GameModel)
                .FirstOrDefaultAsync(s => s.Id == request.ScenarioId, ct);
            if (scenario is null)
                throw new DomainException("Modelo de Juego", "Escenario no encontrado.", ErrorCodes.ScenarioNotFound);

            var hasAccess = await _db.UserClubs
                .Join(_db.Teams, uc => uc.ClubId, t => t.ClubId, (uc, t) => new { uc, t })
                .AnyAsync(x => x.uc.ApplicationUserId == request.UserId && x.t.Id == scenario.GamePrinciple.GameModel.TeamId, ct);
            if (!hasAccess)
                throw new DomainException("Modelo de Juego", "No tienes acceso a este escenario.", ErrorCodes.GameModelAccessDenied);

            var mediaType = request.File.ContentType.StartsWith("video/") ? "video" : "image";
            var ext = Path.GetExtension(request.File.FileName);
            var fileName = $"{Guid.NewGuid()}{ext}";

            var url = await _storage.UploadAsync(Bucket, fileName, request.File, ct);

            if (!string.IsNullOrEmpty(scenario.MediaUrl))
                await _storage.DeleteAsync(Bucket, Path.GetFileName(scenario.MediaUrl), ct);

            scenario.UpdateMedia(url, mediaType);
            await _db.SaveChangesAsync(ct);

            return new UploadScenarioMediaResult(url, mediaType);
        }
    }

    public class UploadScenarioMediaValidator : AbstractValidator<UploadScenarioMediaCommand>
    {
        private static readonly HashSet<string> AllowedContentTypes = new()
        {
            "image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"
        };
        private const long MaxBytes = 20 * 1024 * 1024; // 20 MB

        public UploadScenarioMediaValidator()
        {
            RuleFor(x => x.ScenarioId).NotEmpty();
            RuleFor(x => x.File)
                .NotNull()
                .Must(f => f.Length > 0).WithMessage("El archivo no puede estar vacío.")
                .Must(f => f.Length <= MaxBytes).WithMessage("El archivo supera el límite de 20 MB.")
                .Must(f => AllowedContentTypes.Contains(f.ContentType)).WithMessage("Formato no permitido.");
        }
    }
}
