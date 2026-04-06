using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Trainings.Sessions
{
    /// <summary>
    /// Deletes a training session.
    /// DELETE /api/trainings/sessions/{id}
    /// </summary>
    public class DeleteSession : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapDelete("/api/trainings/sessions/{id}",
                    async (string id, HttpContext httpContext, IMediator mediator, CancellationToken ct) =>
                    {
                        var userId = httpContext.User.Claims
                            .FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;
                        if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

                        await mediator.Send(new DeleteSessionCommand(id, userId), ct);
                        return Results.NoContent();
                    })
                .WithName(nameof(DeleteSession))
                .WithTags(TrainingConstants.SessionsTag)
                .RequireAuthorization()
                .Produces(StatusCodes.Status204NoContent)
                .Produces(StatusCodes.Status401Unauthorized)
                .Produces(StatusCodes.Status404NotFound);
        }
    }

    public record DeleteSessionCommand(string Id, string UserId) : IRequest;

    public class DeleteSessionHandler : IRequestHandler<DeleteSessionCommand>
    {
        private readonly AppDbContext _db;
        public DeleteSessionHandler(AppDbContext db) => _db = db;

        public async ValueTask<Unit> Handle(DeleteSessionCommand request, CancellationToken ct = default)
        {
            var session = await _db.TrainingSessions
                .Include(s => s.Team)
                .FirstOrDefaultAsync(s => s.Id == request.Id, ct);

            if (session is null)
                throw new DomainException("Sesiones", "Sesión no encontrada.", request.Id);

            var hasAccess = await _db.UserClubs
                .AnyAsync(uc => uc.ApplicationUserId == request.UserId && uc.ClubId == session.Team.ClubId, ct);

            if (!hasAccess)
                throw new DomainException("Sesiones", "No tienes acceso a esta sesión.", request.Id);

            _db.TrainingSessions.Remove(session);
            await _db.SaveChangesAsync(ct);
            return Unit.Value;
        }
    }
}
