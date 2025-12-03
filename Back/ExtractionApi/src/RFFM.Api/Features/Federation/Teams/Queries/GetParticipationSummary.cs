using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.FeatureModules;
using System.Text.RegularExpressions;
using RFFM.Api.Features.Federation.Players.Models;
using RFFM.Api.Features.Federation.Players.Services;
using RFFM.Api.Features.Federation.Teams.Services;

namespace RFFM.Api.Features.Federation.Teams.Queries
{
    public class GetParticipationSummary : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/teams/{teamId}/participation-summary",
                    async (IMediator mediator, CancellationToken cancellationToken, int teamId, int season = 21) =>
                    {
                        var request = new ParticipationQuery(teamId, season);
                        var response = await mediator.Send(request, cancellationToken);
                        return response != null ? Results.Ok(response) : Results.NotFound();
                    })
                .WithName("GetTeamParticipationSummary")
                .WithTags(TeamsConstants.TeamsFeature)
                .Produces<ParticipationCount[]>()
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces(StatusCodes.Status404NotFound);
        }

        public record ParticipationQuery(int TeamId, int SeasonId = 21) : Common.IQuery<ParticipationCount[]>;

        public class PlayerSummary
        {
            public string PlayerId { get; set; } = string.Empty;
            public string Name { get; set; } = string.Empty;
        }

        public class ParticipationCount
        {
            public string CompetitionName { get; set; } = string.Empty;
            public string GroupName { get; set; } = string.Empty;
            public string TeamName { get; set; } = string.Empty;
            public string TeamCode { get; set; } = string.Empty;
            public int TeamPoints { get; set; }
            public int Count { get; set; }

            public List<PlayerSummary> Players { get; set; } = [];
        }

        public class ParticipationRequestHandler(ITeamService teamService, IPlayerService playerService)
            : IRequestHandler<ParticipationQuery, ParticipationCount[]>
        {
            public async ValueTask<ParticipationCount[]> Handle(ParticipationQuery request, CancellationToken cancellationToken)
            {
                var team = await teamService.GetTeamDetailsAsync(request.TeamId.ToString(), cancellationToken);
                if (team == null || !team.Players.Any())
                    return [];

                var selectedTeamCode = team.TeamCode ?? string.Empty;

                // Fetch player details in parallel
                var tasks = team.Players.Select(async p =>
                {
                    string? playerId = null;
                    if (!string.IsNullOrWhiteSpace(p.PlayerCode))
                    {
                        var m = Regex.Match(p.PlayerCode, "(\\d+)");
                        if (m.Success) playerId = m.Value;
                        else playerId = p.PlayerCode;
                    }

                    // fallback: try to find a long number inside the name
                    if (string.IsNullOrWhiteSpace(playerId) && !string.IsNullOrWhiteSpace(p.Name))
                    {
                        var m2 = Regex.Match(p.Name, "(\\d{5,})");
                        if (m2.Success) playerId = m2.Value;
                    }

                    Player? pd = null;
                    if (!string.IsNullOrWhiteSpace(playerId))
                    {
                        try
                        {
                            pd = await playerService.GetPlayerAsync(playerId!, request.SeasonId, cancellationToken);
                        }
                        catch
                        {
                            // ignore per-player errors
                        }
                    }

                    return (teamPlayer: p, playerDetails: pd);
                }).ToArray();

                var resolved = await Task.WhenAll(tasks);

                // Map of participation key to set of playerIds (to avoid double counting)
                var map = new Dictionary<string, (ParticipationCount proto, HashSet<string> players, Dictionary<string, PlayerSummary> playerSummaries)>();

                foreach (var item in resolved)
                {
                    var p = item.teamPlayer;
                    var pd = item.playerDetails;
                    var playerIdUnique = pd?.PlayerId ?? p.PlayerCode ?? p.Name ?? Guid.NewGuid().ToString();
                    var playerName = pd?.Name ?? p.Name ?? string.Empty;

                    var comps = pd?.Competitions ?? new List<CompetitionParticipation>();

                    // If player details don't include competitions, skip
                    foreach (var cp in comps)
                    {
                        var competitionName = cp.CompetitionName ?? string.Empty;
                        var groupName = cp.GroupName ?? string.Empty;
                        var teamName = cp.TeamName ?? string.Empty;
                        var teamCode = cp.TeamCode ?? string.Empty;
                        var teamPoints = cp.TeamPoints;

                        // Skip participation entries that correspond to the selected team
                        if (!string.IsNullOrWhiteSpace(selectedTeamCode) && !string.IsNullOrWhiteSpace(teamCode) && string.Equals(selectedTeamCode, teamCode, StringComparison.OrdinalIgnoreCase))
                            continue;

                        var key = $"{competitionName}||{groupName}||{teamName}||{teamCode}";
                        if (!map.TryGetValue(key, out var entry))
                        {
                            entry = (new ParticipationCount
                            {
                                CompetitionName = competitionName,
                                GroupName = groupName,
                                TeamName = teamName,
                                TeamCode = teamCode,
                                TeamPoints = teamPoints,
                                Count = 0,
                                Players = new List<PlayerSummary>()
                            }, new HashSet<string>(), new Dictionary<string, PlayerSummary>());
                            map[key] = entry;
                        }

                        if (entry.players.Add(playerIdUnique))
                        {
                            var summary = new PlayerSummary { PlayerId = playerIdUnique, Name = playerName };
                            entry.playerSummaries[playerIdUnique] = summary;
                            entry.proto.Count = entry.players.Count;
                        }
                    }
                }

                // Populate Players list from playerSummaries
                foreach (var kv in map.Values)
                {
                    kv.proto.Players = kv.playerSummaries.Values.OrderBy(p => p.Name).ToList();
                }

                var result = map.Values.Select(v => v.proto)
                    .OrderBy(r => r.CompetitionName).ThenBy(r => r.TeamName).ToArray();

                return result;
            }
        }
    }
}
