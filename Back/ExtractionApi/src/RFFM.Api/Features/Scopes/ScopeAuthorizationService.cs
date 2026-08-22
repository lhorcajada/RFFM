using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Scopes
{
    public interface IScopeAuthorizationService
    {
        Task<ScopeAuthorizationResult> EnsureCreatorAsync(
            string userId, string scopeKind, string scopeId, CancellationToken cancellationToken);

        /// <summary>
        /// Like <see cref="EnsureCreatorAsync"/> but accepts ANY member of the scope (coach/director
        /// with a UserTeam/UserClub row), not just the creator. Use for routine team-management actions
        /// that aren't ownership/billing-sensitive (unlike club-join approval, invitation regeneration).
        /// </summary>
        Task<ScopeAuthorizationResult> EnsureMemberAsync(
            string userId, string scopeKind, string scopeId, CancellationToken cancellationToken);

        Task<ActiveScopeInfo?> FindActiveScopeAsync(string userId, CancellationToken cancellationToken);

        Task<SubscriptionEvictionResult> EnsureSubscriptionActiveOrEvictAsync(
            ScopeContext scope, CancellationToken cancellationToken);
    }

    public sealed record SubscriptionEvictionResult
    {
        public bool IsActive { get; init; }
        public int EvictedMembers { get; init; }
        public int Status { get; init; }
        public string Title { get; init; } = string.Empty;
        public string Detail { get; init; } = string.Empty;
    }

    public class ScopeAuthorizationService : IScopeAuthorizationService
    {
        private readonly AppDbContext _db;

        public ScopeAuthorizationService(AppDbContext db)
        {
            _db = db;
        }

        public async Task<ScopeAuthorizationResult> EnsureCreatorAsync(
            string userId, string scopeKind, string scopeId, CancellationToken cancellationToken)
        {
            if (!ScopeKinds.IsValid(scopeKind) || string.IsNullOrEmpty(scopeId))
            {
                return ScopeAuthorizationResult.Fail(
                    StatusCodes.Status400BadRequest,
                    "Scope inválido",
                    "El tipo o identificador de scope no es válido.");
            }

            if (scopeKind == ScopeKinds.Club)
            {
                var club = await _db.Clubs
                    .AsNoTracking()
                    .FirstOrDefaultAsync(c => c.Id == scopeId, cancellationToken);
                if (club is null)
                {
                    return ScopeAuthorizationResult.Fail(
                        StatusCodes.Status404NotFound,
                        "Scope no encontrado",
                        "No existe el club indicado.");
                }

                var isCreator = await _db.UserClubs
                    .AsNoTracking()
                    .AnyAsync(uc => uc.ApplicationUserId == userId
                                    && uc.ClubId == scopeId
                                    && uc.IsCreator, cancellationToken);
                if (!isCreator)
                {
                    return ScopeAuthorizationResult.Fail(
                        StatusCodes.Status403Forbidden,
                        "Acción no permitida",
                        "No eres creador de este scope.");
                }

                return ScopeAuthorizationResult.Ok(new ScopeContext
                {
                    Kind = ScopeKinds.Club,
                    Id = club.Id,
                    Name = club.Name
                });
            }

            var team = await _db.Teams
                .AsNoTracking()
                .FirstOrDefaultAsync(t => t.Id == scopeId, cancellationToken);
            if (team is null)
            {
                return ScopeAuthorizationResult.Fail(
                    StatusCodes.Status404NotFound,
                    "Scope no encontrado",
                    "No existe el equipo indicado.");
            }

            var teamIsCreator = await _db.UserTeams
                .AsNoTracking()
                .AnyAsync(ut => ut.ApplicationUserId == userId
                                && ut.TeamId == scopeId
                                && ut.IsCreator, cancellationToken);

            var parentClubIsCreator = await _db.UserClubs
                .AsNoTracking()
                .AnyAsync(uc => uc.ApplicationUserId == userId
                                && uc.ClubId == team.ClubId
                                && uc.IsCreator, cancellationToken);

            if (!teamIsCreator && !parentClubIsCreator)
            {
                return ScopeAuthorizationResult.Fail(
                    StatusCodes.Status403Forbidden,
                    "Acción no permitida",
                    "No eres creador de este scope.");
            }

            return ScopeAuthorizationResult.Ok(new ScopeContext
            {
                Kind = ScopeKinds.Team,
                Id = team.Id,
                Name = team.Name,
                ParentClubId = team.ClubId
            });
        }

        public async Task<ScopeAuthorizationResult> EnsureMemberAsync(
            string userId, string scopeKind, string scopeId, CancellationToken cancellationToken)
        {
            if (!ScopeKinds.IsValid(scopeKind) || string.IsNullOrEmpty(scopeId))
            {
                return ScopeAuthorizationResult.Fail(
                    StatusCodes.Status400BadRequest,
                    "Scope inválido",
                    "El tipo o identificador de scope no es válido.");
            }

            if (scopeKind == ScopeKinds.Club)
            {
                var club = await _db.Clubs
                    .AsNoTracking()
                    .FirstOrDefaultAsync(c => c.Id == scopeId, cancellationToken);
                if (club is null)
                {
                    return ScopeAuthorizationResult.Fail(
                        StatusCodes.Status404NotFound,
                        "Scope no encontrado",
                        "No existe el club indicado.");
                }

                var isMember = await _db.UserClubs
                    .AsNoTracking()
                    .AnyAsync(uc => uc.ApplicationUserId == userId && uc.ClubId == scopeId, cancellationToken);
                if (!isMember)
                {
                    return ScopeAuthorizationResult.Fail(
                        StatusCodes.Status403Forbidden,
                        "Acción no permitida",
                        "No perteneces a este scope.");
                }

                return ScopeAuthorizationResult.Ok(new ScopeContext
                {
                    Kind = ScopeKinds.Club,
                    Id = club.Id,
                    Name = club.Name
                });
            }

            var teamForMember = await _db.Teams
                .AsNoTracking()
                .FirstOrDefaultAsync(t => t.Id == scopeId, cancellationToken);
            if (teamForMember is null)
            {
                return ScopeAuthorizationResult.Fail(
                    StatusCodes.Status404NotFound,
                    "Scope no encontrado",
                    "No existe el equipo indicado.");
            }

            var isTeamMember = await _db.UserTeams
                .AsNoTracking()
                .AnyAsync(ut => ut.ApplicationUserId == userId && ut.TeamId == scopeId, cancellationToken);
            var isParentClubMember = await _db.UserClubs
                .AsNoTracking()
                .AnyAsync(uc => uc.ApplicationUserId == userId && uc.ClubId == teamForMember.ClubId, cancellationToken);

            if (!isTeamMember && !isParentClubMember)
            {
                return ScopeAuthorizationResult.Fail(
                    StatusCodes.Status403Forbidden,
                    "Acción no permitida",
                    "No perteneces a este scope.");
            }

            return ScopeAuthorizationResult.Ok(new ScopeContext
            {
                Kind = ScopeKinds.Team,
                Id = teamForMember.Id,
                Name = teamForMember.Name,
                ParentClubId = teamForMember.ClubId
            });
        }

        public async Task<ActiveScopeInfo?> FindActiveScopeAsync(
            string userId, CancellationToken cancellationToken)
        {
            var userClub = await _db.UserClubs
                .AsNoTracking()
                .Include(uc => uc.Club)
                .Where(uc => uc.ApplicationUserId == userId)
                .Select(uc => new { uc.Club.Id, uc.Club.Name })
                .FirstOrDefaultAsync(cancellationToken);
            if (userClub is not null)
            {
                return new ActiveScopeInfo(ScopeKinds.Club, userClub.Id, userClub.Name);
            }

            var userTeam = await _db.UserTeams
                .AsNoTracking()
                .Include(ut => ut.Team)
                .Where(ut => ut.ApplicationUserId == userId)
                .Select(ut => new { ut.Team.Id, ut.Team.Name })
                .FirstOrDefaultAsync(cancellationToken);
            if (userTeam is not null)
            {
                return new ActiveScopeInfo(ScopeKinds.Team, userTeam.Id, userTeam.Name);
            }

            return null;
        }

        public async Task<SubscriptionEvictionResult> EnsureSubscriptionActiveOrEvictAsync(
            ScopeContext scope, CancellationToken cancellationToken)
        {
            var creatorUserId = await ResolveCreatorUserIdAsync(scope, cancellationToken);
            if (string.IsNullOrEmpty(creatorUserId))
            {
                return new SubscriptionEvictionResult
                {
                    IsActive = false,
                    Status = StatusCodes.Status403Forbidden,
                    Title = "Acción no permitida",
                    Detail = "No se pudo determinar el creador del scope."
                };
            }

            var subscription = await _db.Subscriptions
                .Where(s => s.UserId == creatorUserId)
                .OrderByDescending(s => s.CreatedAt)
                .FirstOrDefaultAsync(cancellationToken);

            var nowUtc = DateTime.UtcNow;
            var isActive = subscription is not null
                           && subscription.Status == SubscriptionStatus.Active
                           && subscription.EndDate >= nowUtc;

            if (isActive)
            {
                return new SubscriptionEvictionResult { IsActive = true };
            }

            var evicted = await EvictNonCreatorsAsync(scope, cancellationToken);

            return new SubscriptionEvictionResult
            {
                IsActive = false,
                EvictedMembers = evicted,
                Status = StatusCodes.Status402PaymentRequired,
                Title = "Suscripción inactiva",
                Detail = $"Suscripción inactiva. Se han desvinculado {evicted} miembros de tu espacio."
            };
        }

        private async Task<string?> ResolveCreatorUserIdAsync(
            ScopeContext scope, CancellationToken cancellationToken)
        {
            if (scope.Kind == ScopeKinds.Club)
            {
                return await _db.UserClubs
                    .AsNoTracking()
                    .Where(uc => uc.ClubId == scope.Id && uc.IsCreator)
                    .Select(uc => uc.ApplicationUserId)
                    .FirstOrDefaultAsync(cancellationToken);
            }

            var teamCreator = await _db.UserTeams
                .AsNoTracking()
                .Where(ut => ut.TeamId == scope.Id && ut.IsCreator)
                .Select(ut => ut.ApplicationUserId)
                .FirstOrDefaultAsync(cancellationToken);
            if (!string.IsNullOrEmpty(teamCreator))
            {
                return teamCreator;
            }

            var team = await _db.Teams
                .AsNoTracking()
                .Where(t => t.Id == scope.Id)
                .Select(t => t.ClubId)
                .FirstOrDefaultAsync(cancellationToken);
            if (string.IsNullOrEmpty(team))
            {
                return null;
            }

            return await _db.UserClubs
                .AsNoTracking()
                .Where(uc => uc.ClubId == team && uc.IsCreator)
                .Select(uc => uc.ApplicationUserId)
                .FirstOrDefaultAsync(cancellationToken);
        }

        private async Task<int> EvictNonCreatorsAsync(ScopeContext scope, CancellationToken cancellationToken)
        {
            var count = 0;
            if (scope.Kind == ScopeKinds.Club)
            {
                var links = await _db.UserClubs
                    .Where(uc => uc.ClubId == scope.Id && !uc.IsCreator)
                    .ToListAsync(cancellationToken);
                if (links.Count > 0)
                {
                    _db.UserClubs.RemoveRange(links);
                    count = links.Count;
                    await _db.SaveChangesAsync(cancellationToken);
                }
            }
            else
            {
                var links = await _db.UserTeams
                    .Where(ut => ut.TeamId == scope.Id && !ut.IsCreator)
                    .ToListAsync(cancellationToken);
                if (links.Count > 0)
                {
                    _db.UserTeams.RemoveRange(links);
                    count = links.Count;
                    await _db.SaveChangesAsync(cancellationToken);
                }
            }

            return count;
        }
    }
}