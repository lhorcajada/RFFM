using Mediator;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Services;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Common.Behaviors
{
    /// <summary>
    /// Pipeline behavior that enforces team membership.
    /// If the incoming request implements <see cref="IRequireTeamMembership"/>
    /// and the user has a Player or FamilyMember role, verifies they belong to the specified team.
    /// Other roles (Administrator, Coach, etc.) bypass this check.
    /// </summary>
    public class TeamMembershipBehavior<TRequest, TResponse>(ICurrentUserService currentUser, AppDbContext db)
        : IPipelineBehavior<TRequest, TResponse>
        where TRequest : IRequest<TResponse>
    {
        private static readonly string[] RestrictedRoles = { "Player", "FamilyMember" };

        public async ValueTask<TResponse> Handle(
            TRequest message, MessageHandlerDelegate<TRequest, TResponse> next, CancellationToken cancellationToken)
        {
            if (message is not IRequireTeamMembership requirement)
                return await next(message, cancellationToken);

            var roles = (currentUser.Roles ?? []).ToArray();
            if (!roles.Any(r => RestrictedRoles.Contains(r, StringComparer.OrdinalIgnoreCase)))
                return await next(message, cancellationToken);

            if (!currentUser.IsAuthenticated || string.IsNullOrEmpty(currentUser.UserId))
                throw new UnauthorizedAccessException("No autenticado.");

            var belongs = await db.Set<UserTeam>()
                .AsNoTracking()
                .AnyAsync(ut => ut.ApplicationUserId == currentUser.UserId && ut.TeamId == requirement.TeamId, cancellationToken);

            if (!belongs)
                throw new ForbiddenAccessException("No tienes acceso a este equipo.");

            return await next(message, cancellationToken);
        }
    }
}
