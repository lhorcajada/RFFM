using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Infrastructure.Storage;

namespace RFFM.Api.Features.Coaches.Trainings.Exercises
{
    /// <summary>
    /// Uploads an image or video for an exercise.
    /// POST /api/trainings/exercises/{id}/media
    /// </summary>
    public class UploadExerciseMedia : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/trainings/exercises/{id}/media",
                    async (string id, IFormFile file, HttpContext httpContext,
                        IMediator mediator, CancellationToken ct) =>
                    {
                        var userId = httpContext.User.Claims
                            .FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;
                        if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

                        var result = await mediator.Send(new UploadExerciseMediaCommand(id, file, userId), ct);
                        return Results.Ok(result);
                    })
                .WithName(nameof(UploadExerciseMedia))
                .WithTags(TrainingConstants.ExercisesTag)
                .RequireAuthorization()
                .DisableAntiforgery()
                .Produces<UploadExerciseMediaResult>()
                .Produces(StatusCodes.Status401Unauthorized)
                .Produces(StatusCodes.Status404NotFound);
        }
    }

    public record UploadExerciseMediaCommand(string ExerciseId, IFormFile File, string UserId)
        : IRequest<UploadExerciseMediaResult>, IRequireFeaturePermission
    {
        public string FeatureRoute => CoachFeatureRoutes.Trainings;
        public string RequiredPermission => "ReadWrite";
    }

    public record UploadExerciseMediaResult(string Url);

    public class UploadExerciseMediaHandler : IRequestHandler<UploadExerciseMediaCommand, UploadExerciseMediaResult>
    {
        private const string Bucket = "exercises";

        private readonly AppDbContext _db;
        private readonly IStorageService _storage;

        public UploadExerciseMediaHandler(AppDbContext db, IStorageService storage)
        {
            _db = db;
            _storage = storage;
        }

        public async ValueTask<UploadExerciseMediaResult> Handle(UploadExerciseMediaCommand request, CancellationToken ct = default)
        {
            var exercise = await _db.TaskTrainingBases
                .FirstOrDefaultAsync(tb => tb.Id == request.ExerciseId, ct);

            if (exercise is null)
                throw new DomainException("Ejercicios", $"Ejercicio no encontrado: {request.ExerciseId}", ErrorCodes.ExerciseNotFound);

            var hasAccess = await _db.UserClubs
                .AnyAsync(uc => uc.ApplicationUserId == request.UserId && uc.ClubId == exercise.ClubId, ct);

            if (!hasAccess)
                throw new DomainException("Ejercicios", "No tienes acceso a este ejercicio.", ErrorCodes.ExerciseAccessDenied);

            var ext = Path.GetExtension(request.File.FileName);
            var fileName = $"{Guid.NewGuid()}{ext}";

            var url = await _storage.UploadAsync(Bucket, fileName, request.File, ct);

            // Delete old file if it was also local
            if (!string.IsNullOrEmpty(exercise.UrlImage))
                await _storage.DeleteAsync(Bucket, Path.GetFileName(exercise.UrlImage), ct);

            exercise.UrlImage = url;
            await _db.SaveChangesAsync(ct);

            return new UploadExerciseMediaResult(url);
        }
    }
}
