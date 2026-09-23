using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Entities.Audit;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Audit
{
    /// <summary>
    /// GET /api/audit-log — paginated audit log query with scope-based filtering.
    /// Federation/Administrator see all rows; ClubDirector sees own clubs; Coach sees own teams.
    /// Additional filter params (eventType, from, to, userId) narrow within scope.
    /// Response includes X-Total-Count header for pagination metadata.
    /// </summary>
    public class SearchAuditLog : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/audit-log",
                    async (
                        int pageNumber = 1,
                        int pageSize = 25,
                        string? clubId = null,
                        string? teamId = null,
                        string? userId = null,
                        string? search = null,
                        string? eventType = null,
                        string? from = null,
                        string? to = null,
                        IMediator mediator = null!,
                        IHttpContextAccessor httpContextAccessor = null!,
                        CancellationToken cancellationToken = default) =>
                    {
                        var (items, total) = await mediator.Send(
                            new SearchAuditLogQuery(pageNumber, pageSize, clubId, teamId, userId, search, eventType, from, to),
                            cancellationToken);

                        try
                        {
                            httpContextAccessor.HttpContext!.Response.Headers["X-Total-Count"] = total.ToString();
                        }
                        catch
                        {
                            // ignore if no http context available (e.g. unit tests calling the handler directly)
                        }

                        return Results.Ok(items);
                    })
                .WithName(nameof(SearchAuditLog))
                .WithTags("Audit")
                .RequireAuthorization(new AuthorizeAttribute { Roles = "Federation,Administrator,ClubDirector,Coach" })
                .Produces<UserActivityLogResponse[]>();
        }

        public record SearchAuditLogQuery(
            int PageNumber = 1,
            int PageSize = 25,
            string? ClubId = null,
            string? TeamId = null,
            string? UserId = null,
            string? Search = null,
            string? EventType = null,
            string? From = null,
            string? To = null) : IRequest<(UserActivityLogResponse[], int)>;

        public class SearchAuditLogHandler : IRequestHandler<SearchAuditLogQuery, (UserActivityLogResponse[], int)>
        {
            private const int MaxPageSize = 100;
            private readonly AppDbContext _db;
            private readonly ICurrentUserService _currentUser;
            private readonly UserManager<IdentityUser> _userManager;

            public SearchAuditLogHandler(AppDbContext db, ICurrentUserService currentUser, UserManager<IdentityUser> userManager)
            {
                _db = db;
                _currentUser = currentUser;
                _userManager = userManager;
            }

            public async ValueTask<(UserActivityLogResponse[], int)> Handle(SearchAuditLogQuery request, CancellationToken ct = default)
            {
                var userId = _currentUser.UserId ?? throw new UnauthorizedAccessException("User not authenticated");
                var roles = (_currentUser.Roles ?? Enumerable.Empty<string>()).ToArray();

                // Clamp pageSize
                var pageSize = Math.Min(request.PageSize, MaxPageSize);
                if (pageSize < 1) pageSize = 25;
                var pageNumber = Math.Max(request.PageNumber, 1);

                // Build base query
                IQueryable<UserActivityLog> query = _db.UserActivityLogs.AsNoTracking();

                // Resolve scope: Federation/Administrator see all; ClubDirector see own clubs; Coach see own teams
                var isFederationOrAdmin = roles.Any(r =>
                    r.Equals(AppRoles.Federation.Name, StringComparison.OrdinalIgnoreCase) ||
                    r.Equals(AppRoles.Administrator.Name, StringComparison.OrdinalIgnoreCase));

                if (!isFederationOrAdmin)
                {
                    var isClubDirector = roles.Any(r =>
                        r.Equals(AppRoles.ClubDirector.Name, StringComparison.OrdinalIgnoreCase));

                    if (isClubDirector)
                    {
                        // Get all clubs this director is part of
                        var clubIds = await _db.Set<UserClub>()
                            .AsNoTracking()
                            .Where(uc => uc.ApplicationUserId == userId)
                            .Select(uc => uc.ClubId)
                            .ToArrayAsync(ct);
                        query = query.Where(a => a.ClubId != null && clubIds.Contains(a.ClubId));
                    }
                    else
                    {
                        // Coach: get all teams
                        var teamIds = await _db.Set<UserTeam>()
                            .AsNoTracking()
                            .Where(ut => ut.ApplicationUserId == userId)
                            .Select(ut => ut.TeamId)
                            .ToArrayAsync(ct);
                        query = query.Where(a => a.TeamId != null && teamIds.Contains(a.TeamId));
                    }
                }

                // Apply additional filters (within scope)
                if (!string.IsNullOrWhiteSpace(request.ClubId))
                {
                    query = query.Where(a => a.ClubId == request.ClubId);
                }

                if (!string.IsNullOrWhiteSpace(request.TeamId))
                {
                    query = query.Where(a => a.TeamId == request.TeamId);
                }

                if (!string.IsNullOrWhiteSpace(request.UserId))
                {
                    query = query.Where(a => a.UserId == request.UserId);
                }

                if (!string.IsNullOrWhiteSpace(request.Search))
                {
                    var search = request.Search.Trim();

                    // UserManager.Users is not guaranteed to be an EF-async-capable source in every
                    // implementation (e.g. mocked in tests), so this one is materialized synchronously.
                    var matchedByUsername = _userManager.Users
                        .Where(u => u.UserName != null && u.UserName.ToLower().Contains(search.ToLower()))
                        .Select(u => u.Id)
                        .ToArray();

                    var matchedByPlayer = await _db.Set<UserTeam>().AsNoTracking()
                        .Where(ut => ut.LinkedTeamPlayerId != null && ut.TeamPlayer != null &&
                            (EF.Functions.ILike(ut.TeamPlayer!.Player.Name, $"%{search}%")
                             || (ut.TeamPlayer.Player.LastName != null && EF.Functions.ILike(ut.TeamPlayer.Player.LastName, $"%{search}%"))
                             || EF.Functions.ILike(ut.TeamPlayer.Player.Alias, $"%{search}%")))
                        .Select(ut => ut.ApplicationUserId)
                        .ToArrayAsync(ct);

                    var matchedUserIds = matchedByUsername.Concat(matchedByPlayer).Distinct().ToArray();
                    query = query.Where(a => matchedUserIds.Contains(a.UserId));
                }

                if (!string.IsNullOrWhiteSpace(request.EventType))
                {
                    query = query.Where(a => a.EventType == request.EventType);
                }

                // Date range filtering
                if (!string.IsNullOrWhiteSpace(request.From) && DateTime.TryParse(request.From, out var fromDate))
                {
                    query = query.Where(a => a.Timestamp >= fromDate);
                }

                if (!string.IsNullOrWhiteSpace(request.To) && DateTime.TryParse(request.To, out var toDate))
                {
                    query = query.Where(a => a.Timestamp <= toDate);
                }

                // Get total count (scoped)
                var total = await query.CountAsync(ct);

                // Apply ordering and pagination
                var pageEntries = await query
                    .OrderByDescending(a => a.Timestamp)
                    .Skip((pageNumber - 1) * pageSize)
                    .Take(pageSize)
                    .ToArrayAsync(ct);

                // Resolve current display name + full current role set per distinct user (not just the
                // role stamped on the event at the time it happened).
                var userNames = new Dictionary<string, string>();
                var userRoles = new Dictionary<string, string[]>();
                foreach (var subjectUserId in pageEntries.Select(a => a.UserId).Distinct())
                {
                    var identityUser = await _userManager.FindByIdAsync(subjectUserId);
                    userNames[subjectUserId] = identityUser?.UserName ?? subjectUserId;
                    userRoles[subjectUserId] = identityUser is null
                        ? Array.Empty<string>()
                        : (await _userManager.GetRolesAsync(identityUser)).ToArray();
                }

                // Not every event carries clubId/teamId (e.g. a plain page-access event recorded
                // without explicit context). Fall back to the user's own current team/club
                // membership so a Coach's or ClubDirector's team/club still shows on the card.
                var pageUserIds = pageEntries.Select(a => a.UserId).Distinct().ToArray();

                var primaryTeamIdByUser = (await _db.Set<UserTeam>().AsNoTracking()
                        .Where(ut => pageUserIds.Contains(ut.ApplicationUserId))
                        .Select(ut => new { ut.ApplicationUserId, ut.TeamId })
                        .ToListAsync(ct))
                    .GroupBy(x => x.ApplicationUserId)
                    .ToDictionary(g => g.Key, g => g.First().TeamId);

                var primaryClubIdByUser = (await _db.Set<UserClub>().AsNoTracking()
                        .Where(uc => pageUserIds.Contains(uc.ApplicationUserId))
                        .Select(uc => new { uc.ApplicationUserId, uc.ClubId })
                        .ToListAsync(ct))
                    .GroupBy(x => x.ApplicationUserId)
                    .ToDictionary(g => g.Key, g => g.First().ClubId);

                var effectiveTeamIdByEntry = pageEntries.ToDictionary(
                    a => a.Id,
                    a => a.TeamId ?? (primaryTeamIdByUser.TryGetValue(a.UserId, out var t) ? t : null));

                var relevantTeamIds = effectiveTeamIdByEntry.Values.Where(t => t != null).Select(t => t!).Distinct().ToArray();

                var teams = await _db.Set<Team>().AsNoTracking()
                    .Where(t => relevantTeamIds.Contains(t.Id))
                    .ToDictionaryAsync(t => t.Id, t => t, ct);

                var effectiveClubIdByEntry = pageEntries.ToDictionary(
                    a => a.Id,
                    a =>
                    {
                        var teamId = effectiveTeamIdByEntry[a.Id];
                        return a.ClubId
                            ?? (teamId != null && teams.TryGetValue(teamId, out var team) ? team.ClubId : null)
                            ?? (primaryClubIdByUser.TryGetValue(a.UserId, out var c) ? c : null);
                    });

                var relevantClubIds = effectiveClubIdByEntry.Values.Where(c => c != null).Select(c => c!).Distinct().ToArray();

                var clubNames = await _db.Set<Club>().AsNoTracking()
                    .Where(c => relevantClubIds.Contains(c.Id))
                    .ToDictionaryAsync(c => c.Id, c => c.Name, ct);

                var linkedPlayerLinks = await _db.Set<UserTeam>().AsNoTracking()
                    .Include(ut => ut.TeamPlayer)
                        .ThenInclude(tp => tp!.Player)
                    .Where(ut => relevantTeamIds.Contains(ut.TeamId) && ut.LinkedTeamPlayerId != null)
                    .ToListAsync(ct);

                var linkedPlayersByUserAndTeam = linkedPlayerLinks
                    .Where(ut => ut.TeamPlayer?.Player != null)
                    .GroupBy(ut => (ut.ApplicationUserId, ut.TeamId))
                    .ToDictionary(
                        g => g.Key,
                        g => g.First().TeamPlayer!.Player);

                var items = pageEntries
                    .Select(a =>
                    {
                        var teamId = effectiveTeamIdByEntry[a.Id];
                        var clubId = effectiveClubIdByEntry[a.Id];
                        var linkedPlayer = teamId != null && linkedPlayersByUserAndTeam.TryGetValue((a.UserId, teamId), out var player)
                            ? player
                            : null;

                        return new UserActivityLogResponse(
                            a.Id,
                            a.UserId,
                            userNames[a.UserId],
                            a.RoleName,
                            userRoles[a.UserId],
                            clubId,
                            clubId != null && clubNames.TryGetValue(clubId, out var clubName) ? clubName : null,
                            teamId,
                            teamId != null && teams.TryGetValue(teamId, out var team) ? team.Name : null,
                            linkedPlayer != null ? $"{linkedPlayer.Name} {linkedPlayer.LastName}".Trim() : null,
                            linkedPlayer?.Alias,
                            a.Timestamp,
                            a.IpAddress,
                            a.EventType,
                            a.ActionOrPage,
                            a.Result,
                            a.Reason,
                            a.SubjectId
                        );
                    })
                    .ToArray();

                return (items, total);
            }
        }

        public record UserActivityLogResponse(
            string Id,
            string UserId,
            string UserName,
            string RoleName,
            string[] Roles,
            string? ClubId,
            string? ClubName,
            string? TeamId,
            string? TeamName,
            string? LinkedPlayerFullName,
            string? LinkedPlayerAlias,
            DateTime Timestamp,
            string? IpAddress,
            string EventType,
            string ActionOrPage,
            string Result,
            string? Reason,
            string? SubjectId);
    }
}
