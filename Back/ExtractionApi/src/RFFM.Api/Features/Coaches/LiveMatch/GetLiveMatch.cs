using System.Security.Claims;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.LiveMatch
{
    public class GetLiveMatch : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet(
                    "/api/events/{eventId}/live-match",
                    [Authorize(Roles = "Coach,Administrator")]
                    async (string eventId, HttpContext httpContext, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                                     ?? httpContext.User.FindFirst("sub")?.Value;
                        if (string.IsNullOrEmpty(userId))
                            return Results.Unauthorized();

                        var state = await mediator.Send(new GetLiveMatchQuery(eventId, userId), cancellationToken);
                        return Results.Ok(state);
                    })
                .WithName(nameof(GetLiveMatch))
                .WithTags("LiveMatch")
                .Produces<LiveMatchStateResponse>(StatusCodes.Status200OK)
                .Produces(StatusCodes.Status403Forbidden)
                .Produces(StatusCodes.Status404NotFound);
        }

        public record GetLiveMatchQuery(string EventId, string UserId) : IQueryApp<LiveMatchStateResponse>;

        public class Handler : IRequestHandler<GetLiveMatchQuery, LiveMatchStateResponse>
        {
            private const string LiveMatchNotFoundCode = "LiveMatchNotFound";

            private readonly AppDbContext _db;

            public Handler(AppDbContext db) => _db = db;

            public async ValueTask<LiveMatchStateResponse> Handle(GetLiveMatchQuery request, CancellationToken cancellationToken = default)
            {
                var userIsTeamCoach = await LiveMatchTeamAccess.IsTeamCoachAsync(_db, request.UserId, request.EventId, cancellationToken);
                if (!userIsTeamCoach)
                    throw new ForbiddenAccessException("No tienes acceso a este partido en directo.");

                var state = await _db.LiveMatchStates
                    .AsNoTracking()
                    .FirstOrDefaultAsync(s => s.EventId == request.EventId, cancellationToken);
                if (state is null)
                    throw new NotFoundException("El partido en directo no existe.", LiveMatchNotFoundCode);

                return LiveMatchStateResponse.From(state, DateTime.UtcNow);
            }
        }
    }
}
