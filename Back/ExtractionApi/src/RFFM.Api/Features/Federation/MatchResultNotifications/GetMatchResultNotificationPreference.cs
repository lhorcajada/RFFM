using System.Security.Claims;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Options;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Federation.MatchResultNotifications
{
    /// <summary>GET /api/match-result-notifications/preference — preferencia del usuario y nombre de su equipo principal.</summary>
    public class GetMatchResultNotificationPreference : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/match-result-notifications/preference",
                    async (IMediator mediator, HttpContext httpContext, CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                                     ?? throw new UnauthorizedAccessException("Usuario no autenticado");

                        var result = await mediator.Send(new GetMatchResultNotificationPreferenceQuery(userId), cancellationToken);
                        return Results.Ok(result);
                    })
                .WithName(nameof(GetMatchResultNotificationPreference))
                .WithTags("Notifications")
                .Produces<MatchResultNotificationPreferenceResponse>()
                .RequireAuthorization();
        }

        /// <summary>No es <c>IQueryApp</c>: depende del usuario y no debe cachearse.</summary>
        public record GetMatchResultNotificationPreferenceQuery(string UserId) : IRequest<MatchResultNotificationPreferenceResponse>;

        public record MatchResultNotificationPreferenceResponse(bool Enabled, string? TeamName);

        public class Handler(FederationDbContext db, IOptions<RffmOptions> rffmOptions)
            : IRequestHandler<GetMatchResultNotificationPreferenceQuery, MatchResultNotificationPreferenceResponse>
        {
            public async ValueTask<MatchResultNotificationPreferenceResponse> Handle(
                GetMatchResultNotificationPreferenceQuery request, CancellationToken cancellationToken)
            {
                var optedOut = await db.MatchResultNotificationOptOuts
                    .AsNoTracking()
                    .AnyAsync(o => o.UserId == request.UserId, cancellationToken);

                var teamName = await db.FederationSettings
                    .AsNoTracking()
                    .Where(s => s.UserId == request.UserId)
                    .CurrentPrimaryTeams(rffmOptions.Value.CurrentSeasonId)
                    .OrderByDescending(s => s.CreatedAt)
                    .Select(s => s.TeamName)
                    .FirstOrDefaultAsync(cancellationToken);

                return new MatchResultNotificationPreferenceResponse(!optedOut, teamName);
            }
        }
    }
}
