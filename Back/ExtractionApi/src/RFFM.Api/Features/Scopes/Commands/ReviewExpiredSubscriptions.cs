using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;
using System.Security.Claims;

namespace RFFM.Api.Features.Scopes.Commands
{
    public class ReviewExpiredSubscriptions : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("api/scopes/subscriptions/review",
                    async (IMediator mediator, HttpContext httpContext, CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                                     ?? httpContext.User.FindFirst("sub")?.Value;
                        if (string.IsNullOrEmpty(userId))
                        {
                            return Results.Unauthorized();
                        }

                        var command = new ReviewExpiredSubscriptionsCommand
                        {
                            CallerUserId = userId
                        };
                        return await mediator.Send(command, cancellationToken);
                    })
                .WithName(nameof(ReviewExpiredSubscriptions))
                .WithTags(ScopesConstants.ScopesFeature)
                .RequireAuthorization()
                .Produces<ReviewExpiredSubscriptionsResponse>(StatusCodes.Status200OK);
        }
    }

    public class ReviewExpiredSubscriptionsCommand : IRequest<IResult>
    {
        public string CallerUserId { get; set; } = string.Empty;
    }

    public class ReviewExpiredSubscriptionsResponse
    {
        public int ReviewedScopes { get; set; }
        public int EvictedMembers { get; set; }
    }

    public class ReviewExpiredSubscriptionsHandler : IRequestHandler<ReviewExpiredSubscriptionsCommand, IResult>
    {
        private readonly AppDbContext _db;

        public ReviewExpiredSubscriptionsHandler(AppDbContext db)
        {
            _db = db;
        }

        public async ValueTask<IResult> Handle(ReviewExpiredSubscriptionsCommand request, CancellationToken cancellationToken)
        {
            var nowUtc = DateTime.UtcNow;
            var reviewedScopes = 0;
            var evictedMembers = 0;

            var expiredClubSubs = await _db.Subscriptions
                .AsNoTracking()
                .Where(s => (s.Status != SubscriptionStatus.Active || s.EndDate < nowUtc))
                .Select(s => new { s.UserId, s.Status, s.EndDate })
                .ToListAsync(cancellationToken);

            var expiredUsers = expiredClubSubs
                .Select(s => s.UserId)
                .Distinct()
                .ToList();

            var userClubsToEvictByUser = await _db.UserClubs
                .Where(uc => expiredUsers.Contains(uc.ApplicationUserId))
                .ToListAsync(cancellationToken);

            var groupedByClub = userClubsToEvictByUser
                .Where(uc => uc.IsCreator)
                .GroupBy(uc => uc.ClubId)
                .ToList();

            foreach (var clubGroup in groupedByClub)
            {
                var clubId = clubGroup.Key;
                var nonCreators = await _db.UserClubs
                    .Where(uc => uc.ClubId == clubId && !uc.IsCreator)
                    .ToListAsync(cancellationToken);
                if (nonCreators.Count > 0)
                {
                    _db.UserClubs.RemoveRange(nonCreators);
                    evictedMembers += nonCreators.Count;
                }
                reviewedScopes++;
            }

            var userTeamCreators = userClubsToEvictByUser
                .Where(uc => uc.IsCreator)
                .Select(uc => uc.ApplicationUserId)
                .Distinct()
                .ToList();

            var teamLinks = await _db.UserTeams
                .Where(ut => expiredUsers.Contains(ut.ApplicationUserId) && ut.IsCreator)
                .ToListAsync(cancellationToken);

            foreach (var teamLink in teamLinks)
            {
                var nonCreators = await _db.UserTeams
                    .Where(ut => ut.TeamId == teamLink.TeamId && !ut.IsCreator)
                    .ToListAsync(cancellationToken);
                if (nonCreators.Count > 0)
                {
                    _db.UserTeams.RemoveRange(nonCreators);
                    evictedMembers += nonCreators.Count;
                }
                reviewedScopes++;
            }

            if (evictedMembers > 0)
            {
                await _db.SaveChangesAsync(cancellationToken);
            }

            return Results.Ok(new ReviewExpiredSubscriptionsResponse
            {
                ReviewedScopes = reviewedScopes,
                EvictedMembers = evictedMembers
            });
        }
    }
}
