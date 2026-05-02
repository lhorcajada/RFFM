using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Caching.Memory;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Federation.Clubs;
using RFFM.Api.Features.Federation.Competitions.Services;
using RFFM.Api.Features.Federation.Players.Services;
using RFFM.Api.Features.Federation.Teams.Services;

namespace RFFM.Api.Features.Federation.Clubs.Queries
{
    /// <summary>
    /// Resolves the competition group for a team using two complementary strategies:
    ///
    /// Strategy A (primary) — Competition classification scan:
    ///   If competitionId is supplied, fetch all groups for that competition and check
    ///   each group's classification until the team code is found.  This does NOT rely
    ///   on fichaequipo having a player roster.
    ///
    /// Strategy B (fallback) — Player ficha:
    ///   Fetch fichaequipo to get a player code, then read that player's
    ///   competiciones_participa and pick the entry matching the team.
    ///   (A player can be in multiple competitions, but their ficha is always in the
    ///   lowest category.)
    /// </summary>
    public class FederationResolveTeamGroup : IFeatureModule
    {
        private const int DefaultSeasonId = 21; // 2025-2026

        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/clubs/{clubCode}/teams/{teamCode}/resolve-group",
                    async (
                        string clubCode,
                        string teamCode,
                        int? competitionId,
                        ITeamService teamService,
                        IPlayerService playerService,
                        ICompetitionService competitionService,
                        IMemoryCache cache,
                        CancellationToken cancellationToken) =>
                    {
                        var normalizedTeamCode = (teamCode ?? string.Empty).Trim();
                        if (string.IsNullOrWhiteSpace(normalizedTeamCode))
                            return Results.BadRequest("teamCode es obligatorio");

                        var cacheKey = $"team_{normalizedTeamCode}_resolve_group_{competitionId}";
                        var result = await cache.GetOrCreateAsync(cacheKey, async entry =>
                        {
                            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10);
                            return await ResolveGroupAsync(
                                normalizedTeamCode,
                                competitionId,
                                teamService,
                                playerService,
                                competitionService,
                                cancellationToken);
                        });

                        return result is null
                            ? Results.NotFound("No se pudo resolver el grupo del equipo.")
                            : Results.Ok(result);
                    })
                .RequireAuthorization()
                .WithName(nameof(FederationResolveTeamGroup))
                .WithTags(ClubsConstants.ClubsFeature)
                .Produces<TeamGroupResponse>()
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces(StatusCodes.Status404NotFound);
        }

        // ── Strategy A ──────────────────────────────────────────────────────────
        // Iterate every group of the competition and look for the team in the
        // standings. Does not require fichaequipo to expose the player roster.
        private static async Task<TeamGroupResponse?> ResolveViaClassificationAsync(
            string teamCode,
            int competitionId,
            ICompetitionService competitionService,
            CancellationToken cancellationToken)
        {
            var groups = await competitionService.GetGroupsAsync(
                competitionId.ToString(), cancellationToken);

            if (groups is null || groups.Length == 0)
                return null;

            // Fetch each group's classification in parallel (there are rarely >10 groups)
            var tasks = groups.Select(async g =>
            {
                try
                {
                    var classification = await competitionService
                        .GetClassification(g.Id, cancellationToken);

                    var found = (classification?.Teams ?? [])
                        .Any(t => string.Equals(
                            t.TeamId?.Trim(),
                            teamCode,
                            StringComparison.OrdinalIgnoreCase));

                    return found ? g : null;
                }
                catch
                {
                    return null;
                }
            }).ToArray();

            var results = await Task.WhenAll(tasks);
            var matchedGroup = results.FirstOrDefault(g => g is not null);

            if (matchedGroup is null)
                return null;

            // Retrieve competition name from the competition list
            var competitions = await competitionService.GetCompetitionsAsync(cancellationToken);
            var comp = competitions.FirstOrDefault(c => c.CompetitionId == competitionId);

            return new TeamGroupResponse(
                TeamCode: teamCode,
                TeamName: string.Empty,       // filled in by the caller if needed
                GroupCode: matchedGroup.Id.ToString(),
                GroupName: matchedGroup.Name,
                CompetitionCode: competitionId.ToString(),
                CompetitionName: comp?.Name ?? string.Empty);
        }

        // ── Strategy B ──────────────────────────────────────────────────────────
        // fichaequipo → first player → fichajugador → codgrupo.
        // If fichaequipo has no players, falls through to Strategy C.
        private static async Task<TeamGroupResponse?> ResolveViaPlayerAsync(
            string teamCode,
            int? competitionId,
            ITeamService teamService,
            IPlayerService playerService,
            ICompetitionService competitionService,
            CancellationToken cancellationToken)
        {
            var team = await teamService.GetTeamDetailsAsync(teamCode, cancellationToken);
            var teamName = team?.TeamName ?? string.Empty;

            var firstPlayerCode = (team?.Players ?? [])
                .Select(p => p.PlayerCode?.Trim())
                .FirstOrDefault(c => !string.IsNullOrWhiteSpace(c));

            // Strategy C: fichaequipo has no players → search competition scorers
            if (string.IsNullOrWhiteSpace(firstPlayerCode) && competitionId.HasValue && competitionId.Value > 0)
            {
                firstPlayerCode = await FindPlayerViaScorersAsync(
                    teamCode, competitionId.Value, competitionService, cancellationToken);
            }

            if (string.IsNullOrWhiteSpace(firstPlayerCode))
                return null;

            // Call fichajugador to get competiciones_participa → codgrupo
            var player = await playerService.GetPlayerAsync(
                firstPlayerCode, DefaultSeasonId, cancellationToken);

            if (player is null || player.Competitions.Count == 0)
                return null;

            // Match by TeamCode; fall back to first entry
            var comp = player.Competitions
                .FirstOrDefault(c => string.Equals(
                    c.TeamCode, teamCode, StringComparison.OrdinalIgnoreCase))
                ?? player.Competitions[0];

            if (string.IsNullOrWhiteSpace(comp.GroupCode))
                return null;

            return new TeamGroupResponse(
                TeamCode: teamCode,
                TeamName: teamName,
                GroupCode: comp.GroupCode,
                GroupName: comp.GroupName,
                CompetitionCode: comp.CompetitionCode,
                CompetitionName: comp.CompetitionName);
        }

        // ── Strategy C helper ────────────────────────────────────────────────────
        // Scan all groups of the competition via /api/scorers and find a player
        // belonging to teamCode. Returns the first matching player code, or null.
        private static async Task<string?> FindPlayerViaScorersAsync(
            string teamCode,
            int competitionId,
            ICompetitionService competitionService,
            CancellationToken cancellationToken)
        {
            var groups = await competitionService.GetGroupsAsync(
                competitionId.ToString(), cancellationToken);

            if (groups is null || groups.Length == 0)
                return null;

            foreach (var group in groups)
            {
                try
                {
                    var scorers = await competitionService.GetScoresAsync(
                        competitionId.ToString(), group.Id.ToString(), cancellationToken);

                    var playerCode = (scorers ?? [])
                        .Where(s => string.Equals(
                            s.TeamId?.Trim(), teamCode, StringComparison.OrdinalIgnoreCase))
                        .Select(s => s.PlayerId?.Trim())
                        .FirstOrDefault(c => !string.IsNullOrWhiteSpace(c));

                    if (!string.IsNullOrWhiteSpace(playerCode))
                        return playerCode;
                }
                catch
                {
                    // ignore per-group errors and continue
                }
            }

            return null;
        }

        // ── Orchestrator ────────────────────────────────────────────────────────
        private static async Task<TeamGroupResponse?> ResolveGroupAsync(
            string teamCode,
            int? competitionId,
            ITeamService teamService,
            IPlayerService playerService,
            ICompetitionService competitionService,
            CancellationToken cancellationToken)
        {
            // Strategy A: classification scan (fast, no player needed)
            if (competitionId.HasValue && competitionId.Value > 0)
            {
                var resultA = await ResolveViaClassificationAsync(
                    teamCode, competitionId.Value, competitionService, cancellationToken);

                if (resultA is not null)
                    return resultA;
            }

            // Strategy B/C: fichajugador path
            // B uses fichaequipo players; C falls back to competition scorers
            return await ResolveViaPlayerAsync(
                teamCode, competitionId, teamService, playerService, competitionService, cancellationToken);
        }

        public record TeamGroupResponse(
            string TeamCode,
            string TeamName,
            string GroupCode,
            string GroupName,
            string CompetitionCode,
            string CompetitionName);
    }
}
