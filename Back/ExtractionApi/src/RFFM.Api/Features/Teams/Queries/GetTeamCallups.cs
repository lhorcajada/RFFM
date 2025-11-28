using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Caching.Memory;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Teams.Services;
using RFFM.Api.Features.Competitions.Services;
using RFFM.Api.Features.Teams.Models;
using RFFM.Api.Features.Competitions.Queries.GetCalendar.Responses;

namespace RFFM.Api.Features.Teams.Queries
{
    public class GetTeamCallups : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/teams/{teamId}/callups", async (IMediator mediator, CancellationToken cancellationToken, int teamId = 13553720, string seasonId = "21", int competitionId = 25255269, int groupId = 25255283) =>
            {
                // seasonId, competitionId and groupId are required as per request
                if (string.IsNullOrWhiteSpace(seasonId)) return Results.BadRequest("seasonId is required");

                var request = new Query(teamId, seasonId, competitionId, groupId);
                var response = await mediator.Send(request, cancellationToken);
                return Results.Ok(response);
            })
            .WithName(nameof(GetTeamCallups))
            .WithTags("Teams")
            .Produces<List<PlayerCallupsResponse>>()
            .Produces<ProblemDetails>(StatusCodes.Status400BadRequest);
        }

        public record Query(int TeamId, string SeasonId, int CompetitionId, int GroupId) : Common.IQuery<List<PlayerCallupsResponse>>;

        public class RequestHandler(
            ICalendarService calendarService,
            IActaService actaService,
            ITeamService teamService,
            IMatchDayService matchDayService,
            IMemoryCache cache)
            : IRequestHandler<Query, List<PlayerCallupsResponse>>
        {
            public async ValueTask<List<PlayerCallupsResponse>> Handle(Query request, CancellationToken cancellationToken)
            {
                // Load calendar for competition/group
                var calendar = await calendarService.GetCalendarAsync(request.CompetitionId, request.GroupId, cancellationToken);

                var matchDays = calendar?.MatchDays ?? new List<CalendarMatchDayResponse>();

                // Determine current/active match day number (limit to this)
                int maxMatchDayNumber = 0;
                var now = DateTime.Now;
                var dow = now.DayOfWeek;
                // Show the active jornada only if it's Sunday or Saturday from 09:00 onward
                var showActiveAllowed = dow == DayOfWeek.Sunday || (dow == DayOfWeek.Saturday && now.TimeOfDay >= TimeSpan.FromHours(9));

                try
                {
                    var active = await matchDayService.GetActiveMatchDay(request.GroupId, cancellationToken);
                    if (active != null)
                    {
                        var activeNum = active.MatchDayNumber;
                        if (activeNum > 0)
                        {
                            if (showActiveAllowed)
                                maxMatchDayNumber = activeNum;
                            else
                                maxMatchDayNumber = Math.Max(0, activeNum - 1);
                        }
                    }
                }
                catch
                {
                    // ignore and fallback to calendar dates
                }

                if (maxMatchDayNumber <= 0)
                {
                    // Fallback: compute from calendar entries using Date <= today
                    try
                    {
                        var today = now.Date;
                        var byDate = matchDays
                            .Where(md => md.Date != DateTime.MinValue && md.Date.Date <= today)
                            .Where(md =>
                            {
                                // If today is Saturday before 09:00, do not include jornadas whose date == today
                                if (dow == DayOfWeek.Saturday && now.TimeOfDay < TimeSpan.FromHours(9))
                                {
                                    if (md.Date.Date == today) return false;
                                }
                                return true;
                            })
                            .Select(md => md.MatchDayNumber)
                            .ToList();
                        if (byDate.Any()) maxMatchDayNumber = byDate.Max();
                    }
                    catch
                    {
                        // ignore
                    }
                }

                // If we computed a maxMatchDayNumber > 0 then only keep matchDays up to that jornada
                if (maxMatchDayNumber > 0)
                {
                    matchDays = matchDays.Where(md => md.MatchDayNumber <= maxMatchDayNumber).ToList();
                }

                // Load team roster to include players even if not called
                TeamRffm team = new TeamRffm();
                try
                {
                    team = await teamService.GetTeamDetailsAsync(request.TeamId.ToString(), cancellationToken);
                }
                catch
                {
                    // ignore, we will still build from actas
                }

                // Build initial player map from team roster
                var playersMap = new Dictionary<string, PlayerCallupsResponse>(StringComparer.OrdinalIgnoreCase);
                if (team?.Players != null)
                {
                    foreach (var p in team.Players)
                    {
                        var key = (p.PlayerCode ?? string.Empty).Trim();
                        if (string.IsNullOrEmpty(key)) continue;
                        if (!playersMap.ContainsKey(key))
                        {
                            playersMap[key] = new PlayerCallupsResponse
                            {
                                PlayerId = key,
                                PlayerName = p.Name ?? string.Empty,
                                Callups = new List<CallupEntry>()
                            };
                        }
                    }
                }

                // Collect matches for this team
                var teamMatches = new List<(CalendarMatchDayResponse MatchDay, MatchResponse Match, bool IsHome)>();
                foreach (var md in matchDays)
                {
                    if (md?.Matches == null) continue;
                    foreach (var m in md.Matches)
                    {
                        if (string.Equals(m.LocalTeamCode, request.TeamId.ToString(), StringComparison.OrdinalIgnoreCase))
                        {
                            teamMatches.Add((md, m, true));
                        }
                        else if (string.Equals(m.VisitorTeamCode, request.TeamId.ToString(), StringComparison.OrdinalIgnoreCase))
                        {
                            teamMatches.Add((md, m, false));
                        }
                    }
                }

                // Limit concurrent acta fetches
                var semaphore = new System.Threading.SemaphoreSlim(6);
                var tasks = new List<Task>();

                foreach (var (md, match, isHome) in teamMatches)
                {
                    await semaphore.WaitAsync(cancellationToken);
                    var t = Task.Run(async () =>
                    {
                        try
                        {
                            MatchRffm? acta = null;
                            if (!string.IsNullOrWhiteSpace(match.MatchRecordCode))
                            {
                                try
                                {
                                    var code = match.MatchRecordCode!;
                                    var cacheKey = $"acta_{code}_s{request.SeasonId}_c{request.CompetitionId}_g{request.GroupId}";
                                    acta = await cache.GetOrCreateAsync(cacheKey, async entry =>
                                    {
                                        // cache actas for 30 minutes
                                        entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(30);
                                        if (int.TryParse(request.SeasonId, out var temporada))
                                        {
                                            return await actaService.GetMatchFromActaAsync(code, temporada, request.CompetitionId, request.GroupId, cancellationToken);
                                        }

                                        return await actaService.GetMatchFromActaAsync(code, 0, request.CompetitionId, request.GroupId, cancellationToken);
                                    });
                                }
                                catch
                                {
                                    acta = null;
                                }
                            }

                            // Determine opponent label
                            var opponent = isHome ? match.VisitorTeamName : match.LocalTeamName;

                            // Build lookup of players present in acta for this side
                            var present = new Dictionary<string, LineupPlayer>(StringComparer.OrdinalIgnoreCase);
                            if (acta != null)
                            {
                                var lineup = isHome ? acta.LocalPlayers : acta.AwayPlayers;
                                if (lineup != null)
                                {
                                    foreach (var lp in lineup)
                                    {
                                        var code = (lp.PlayerCode ?? string.Empty).Trim();
                                        if (string.IsNullOrEmpty(code)) continue;
                                        if (!present.ContainsKey(code)) present[code] = lp;

                                        // ensure player exists in playersMap
                                        if (!playersMap.ContainsKey(code))
                                        {
                                            playersMap[code] = new PlayerCallupsResponse
                                            {
                                                PlayerId = code,
                                                PlayerName = lp.PlayerName ?? string.Empty,
                                                Callups = new List<CallupEntry>()
                                            };
                                        }
                                    }
                                }
                            }

                            // For players known in roster, and also any present players, create callup entry per player
                            var allPlayerKeys = new HashSet<string>(playersMap.Keys, StringComparer.OrdinalIgnoreCase);
                            foreach (var pk in present.Keys) allPlayerKeys.Add(pk);

                            foreach (var pk in allPlayerKeys)
                            {
                                var called = present.ContainsKey(pk);
                                var starter = false;
                                var substitute = false;
                                if (called)
                                {
                                    var lp = present[pk];
                                    starter = IsTruthy(lp.Starter);
                                    substitute = IsTruthy(lp.Substitute);
                                }

                                var entry = new CallupEntry
                                {
                                    MatchDayNumber = md.MatchDayNumber,
                                    Opponent = opponent ?? string.Empty,
                                    Called = called,
                                    Starter = starter,
                                    Substitute = substitute,
                                    Home = isHome,
                                    Date = match.Date
                                };

                                // ensure player exists
                                if (!playersMap.TryGetValue(pk, out var pr))
                                {
                                    pr = new PlayerCallupsResponse { PlayerId = pk, PlayerName = string.Empty, Callups = new List<CallupEntry>() };
                                    playersMap[pk] = pr;
                                }
                                pr.Callups.Add(entry);
                            }

                            // Also handle case where roster players have no codigo (empty key) - skip
                        }
                        finally
                        {
                            semaphore.Release();
                        }
                    }, cancellationToken);
                    tasks.Add(t);
                }

                await Task.WhenAll(tasks);

                // Build final list ordered by player name
                var result = playersMap.Values
                    .Select(p =>
                    {
                        // sort callups by matchday
                        p.Callups = p.Callups.OrderBy(c => c.MatchDayNumber).ToList();
                        return p;
                    })
                    .OrderBy(p => p.PlayerName)
                    .ToList();

                return result;
            }

            private static bool IsTruthy(string? s)
            {
                if (string.IsNullOrWhiteSpace(s)) return false;
                var v = s.Trim().ToLowerInvariant();
                if (v == "1" || v == "true" || v == "si" || v == "s" || v == "titular" || v == "t") return true;
                return false;
            }
        }

        // Response DTOs
        public class PlayerCallupsResponse
        {
            public string PlayerId { get; set; } = string.Empty;
            public string PlayerName { get; set; } = string.Empty;
            public List<CallupEntry> Callups { get; set; } = new();
        }

        public class CallupEntry
        {
            public int MatchDayNumber { get; set; }
            public string Opponent { get; set; } = string.Empty;
            public bool Called { get; set; }
            public bool Starter { get; set; }
            public bool Substitute { get; set; }
            public bool Home { get; set; }
            public DateTime Date { get; set; }
        }
    }
}
