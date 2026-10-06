using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using RFFM.Api.FeatureModules;
using System.Text.RegularExpressions;
using RFFM.Api.Features.Federation.Players.Services;
using RFFM.Api.Features.Federation.Seasons.Services;
using RFFM.Api.Features.Federation.Teams.Services;
using RFFM.Api.Infrastructure.Options;

namespace RFFM.Api.Features.Federation.Teams.Queries
{
    public class GetParticipationSummary : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/teams/{teamId}/participation-summary",
                    async (IMediator mediator, CancellationToken cancellationToken, string teamId, int season = 21) =>
                    {
                        var request = new ParticipationQueryApp(teamId, season);
                        var response = await mediator.Send(request, cancellationToken);
                        return response != null ? Results.Ok(response) : Results.NotFound();
                    })
                .WithName("GetTeamParticipationSummary")
                .WithTags(TeamsConstants.TeamsFeature)
                .Produces<ParticipationCount[]>()
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces(StatusCodes.Status404NotFound);
        }

        public record ParticipationQueryApp(string TeamId, int SeasonId = 21) : Common.IQueryApp<ParticipationCount[]>;

        public class PlayerSummary
        {
            public string PlayerId { get; set; } = string.Empty;
            public string Name { get; set; } = string.Empty;
        }

        public class ParticipationCount
        {
            public int SeasonId { get; set; }
            public string SeasonName { get; set; } = string.Empty;
            public string CompetitionName { get; set; } = string.Empty;
            public string GroupName { get; set; } = string.Empty;
            public string TeamName { get; set; } = string.Empty;
            public string TeamCode { get; set; } = string.Empty;
            public int TeamPoints { get; set; }
            public int Count { get; set; }

            public List<PlayerSummary> Players { get; set; } = [];
        }

        public class ParticipationRequestHandler(
            ITeamService teamService,
            IPlayerService playerService,
            IOptions<RffmOptions> rffmOptions,
            IMemoryCache cache)
            : IRequestHandler<ParticipationQueryApp, ParticipationCount[]>
        {
            public async ValueTask<ParticipationCount[]> Handle(ParticipationQueryApp request, CancellationToken cancellationToken)
            {
                var team = await teamService.GetTeamDetailsAsync(request.TeamId.ToString(), cancellationToken);
                if (team == null || !team.Players.Any())
                    return [];

                var selectedTeamCode = team.TeamCode ?? string.Empty;
                var seasons = new[] { request.SeasonId, RffmSeasons.Previous(rffmOptions.Value, request.SeasonId) }
                    .Where(s => s.HasValue)
                    .Select(s => s!.Value)
                    .ToArray();

                var tasks = team.Players
                    .SelectMany(p => seasons.Select(async season =>
                    {
                        var playerId = ResolvePlayerId(p.PlayerCode, p.Name);
                        var pd = string.IsNullOrWhiteSpace(playerId)
                            ? null
                            : await cache.GetPlayerSheetOrDefaultAsync(playerService, playerId, season, cancellationToken);
                        return (teamPlayer: p, season, playerDetails: pd);
                    }))
                    .ToArray();

                var resolved = await Task.WhenAll(tasks);

                // Map of participation key to set of playerIds (to avoid double counting)
                var map = new Dictionary<string, (ParticipationCount proto, Dictionary<string, PlayerSummary> playerSummaries)>();

                foreach (var (p, season, pd) in resolved)
                {
                    var playerIdUnique = pd?.PlayerId ?? p.PlayerCode ?? p.Name ?? Guid.NewGuid().ToString();
                    var playerName = pd?.Name ?? p.Name ?? string.Empty;

                    foreach (var cp in pd?.Competitions ?? [])
                    {
                        var competitionName = cp.CompetitionName ?? string.Empty;
                        var groupName = cp.GroupName ?? string.Empty;
                        var teamName = cp.TeamName ?? string.Empty;
                        var teamCode = cp.TeamCode ?? string.Empty;

                        var isSelectedTeam = !string.IsNullOrWhiteSpace(selectedTeamCode)
                                             && string.Equals(selectedTeamCode, teamCode, StringComparison.OrdinalIgnoreCase);
                        if (isSelectedTeam)
                            continue;

                        var key = $"{season}||{competitionName}||{groupName}||{teamName}||{teamCode}";
                        if (!map.TryGetValue(key, out var entry))
                        {
                            entry = (new ParticipationCount
                            {
                                SeasonId = season,
                                SeasonName = RffmSeasons.Label(rffmOptions.Value, season),
                                CompetitionName = competitionName,
                                GroupName = groupName,
                                TeamName = teamName,
                                TeamCode = teamCode,
                                TeamPoints = cp.TeamPoints
                            }, new Dictionary<string, PlayerSummary>());
                            map[key] = entry;
                        }

                        if (entry.playerSummaries.TryAdd(playerIdUnique, new PlayerSummary { PlayerId = playerIdUnique, Name = playerName }))
                            entry.proto.Count = entry.playerSummaries.Count;
                    }
                }

                foreach (var (proto, playerSummaries) in map.Values)
                    proto.Players = playerSummaries.Values.OrderBy(p => p.Name).ToList();

                return map.Values.Select(v => v.proto)
                    .OrderByDescending(r => r.SeasonId)
                    .ThenBy(r => r.CompetitionName)
                    .ThenBy(r => r.TeamName)
                    .ToArray();
            }

            private static string? ResolvePlayerId(string? playerCode, string? name)
            {
                if (!string.IsNullOrWhiteSpace(playerCode))
                {
                    var m = Regex.Match(playerCode, "(\\d+)");
                    return m.Success ? m.Value : playerCode;
                }

                // fallback: try to find a long number inside the name
                if (!string.IsNullOrWhiteSpace(name))
                {
                    var m2 = Regex.Match(name, "(\\d{5,})");
                    if (m2.Success) return m2.Value;
                }

                return null;
            }
        }
    }
}
