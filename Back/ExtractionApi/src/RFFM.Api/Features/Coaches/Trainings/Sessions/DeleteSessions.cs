using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Trainings.Sessions
{
    /// <summary>
    /// Deletes multiple training sessions in bulk.
    /// POST /api/trainings/sessions/bulk-delete
    /// </summary>
    public class DeleteSessions : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/trainings/sessions/bulk-delete",
                    async (DeleteSessionsRequest request, HttpContext httpContext, IMediator mediator, CancellationToken ct) =>
                    {
                        var userId = httpContext.User.Claims
                            .FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;
                        if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

                        var deletedCount = await mediator.Send(new DeleteSessionsCommand(request.Ids, userId), ct);
                        return Results.Ok(new DeleteSessionsResponse(deletedCount));
                    })
                .WithName(nameof(DeleteSessions))
                .WithTags(TrainingConstants.SessionsTag)
                .RequireAuthorization()
                .Produces<DeleteSessionsResponse>()
                .Produces(StatusCodes.Status401Unauthorized);
        }

        public record DeleteSessionsRequest(IReadOnlyCollection<string> Ids);
        public record DeleteSessionsResponse(int DeletedCount);
    }

    public record DeleteSessionsCommand(IReadOnlyCollection<string> Ids, string UserId) : IRequest<int>, IRequireFeaturePermission
    {
        public string FeatureRoute => CoachFeatureRoutes.Trainings;
        public string RequiredPermission => "ReadWrite";
    }

    public class DeleteSessionsHandler : IRequestHandler<DeleteSessionsCommand, int>
    {
        private readonly AppDbContext _db;
        public DeleteSessionsHandler(AppDbContext db) => _db = db;

        public async ValueTask<int> Handle(DeleteSessionsCommand request, CancellationToken ct = default)
        {
            if (request.Ids.Count == 0) return 0;

            var sessions = await _db.TrainingSessions
                .Include(s => s.Team)
                .Where(s => request.Ids.Contains(s.Id))
                .ToListAsync(ct);

            var accessibleClubIds = await _db.UserClubs
                .Where(uc => uc.ApplicationUserId == request.UserId)
                .Select(uc => uc.ClubId)
                .ToListAsync(ct);

            var deletable = sessions.Where(s => accessibleClubIds.Contains(s.Team.ClubId)).ToList();

            _db.TrainingSessions.RemoveRange(deletable);
            await _db.SaveChangesAsync(ct);

            return deletable.Count;
        }
    }
}
