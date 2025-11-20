using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Competitions.Services;
using RFFM.Api.Features.Teams.Models;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;
using System.Text.RegularExpressions;
using RFFM.Api.Features.Competitions.Models;
using System.Globalization;
using RFFM.Api.Features.Teams.Services;

namespace RFFM.Api.Features.Teams.Queries
{
    public class GetGoalSectors : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/teams/{teamCode}/goal-sectors", async (IMediator mediator, CancellationToken cancellationToken,
                    string teamCode = "13553720", int temporada = 21, int competicion = 25255269, int grupo = 25255283,
                    int tipojuego = 1) =>
                {
                    var request = new Query(teamCode, temporada, competicion, grupo, tipojuego);
                    var response = await mediator.Send(request, cancellationToken);
                    return response != null ? Results.Ok(response) : Results.NotFound();
                })
                .WithName(nameof(GetGoalSectors))
                .WithTags("Teams")
                .Produces<GoalSectorsResponse>()
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest);
        }

        public record Query(string TeamCode, int Temporada, int Competicion, int Grupo, int TipoJuego)
            : Common.IQuery<GoalSectorsResponse>;

        public class Sector
        {
            public int StartMinute { get; set; }
            public int EndMinute { get; set; }
            public int GoalsFor { get; set; }
            public int GoalsAgainst { get; set; }
        }

        public class GoalSectorsResponse
        {
            public string TeamCode { get; set; } = string.Empty;
            public int MatchesProcessed { get; set; }
            public List<Sector> Sectors { get; set; } = new();
            // Additional counts for verification
            public int TotalGoalsFor { get; set; }
            public int TotalGoalsAgainst { get; set; }
            public int SectorGoalsFor { get; set; }
            public int SectorGoalsAgainst { get; set; }
        }

        public class RequestHandler : IRequestHandler<Query, GoalSectorsResponse>
        {
            private readonly ICalendarService _calendarService;
            private readonly IActaService _actaService;

            public RequestHandler(ICalendarService calendarService, IActaService actaService)
            {
                _calendarService = calendarService;
                _actaService = actaService;
            }

            public async ValueTask<GoalSectorsResponse> Handle(Query request, CancellationToken cancellationToken)
            {
                // Adapted to new Calendar model
                var calendar = await _calendarService.GetCalendarAsync(request.Temporada, request.Competicion,
                    request.Grupo, null, request.TipoJuego, cancellationToken);
                if (calendar == null)
                    return new GoalSectorsResponse { TeamCode = request.TeamCode, MatchesProcessed = 0 };

                var rounds = calendar.EffectiveRounds;
                if (rounds == null || !rounds.Any())
                    return new GoalSectorsResponse { TeamCode = request.TeamCode, MatchesProcessed = 0 };

                // Determine current round (latest round whose matches' max date <= today)
                var formats = new[]
                {
                    "dd/MM/yyyy", "dd/MM/yyyy HH:mm", "yyyy-MM-ddTHH:mm:ss", "yyyy-MM-dd", "dd-MM-yyyy",
                    "dd-MM-yyyy HH:mm"
                };
                var culture = CultureInfo.GetCultureInfo("es-ES");
                var today = DateTime.Now.Date;

                int cutoffRoundIndex = -1;
                int lastRoundWithCodActa = -1;
                for (int i = 0; i < rounds.Count; i++)
                {
                    var round = rounds[i];
                    var matchesInRound = round?.EffectiveMatches ?? new List<CalendarMatch>();
                    if (round == null || matchesInRound == null || !matchesInRound.Any())
                        continue;

                    // track last round that contains at least one codacta (useful as fallback)
                    if (matchesInRound.Any(mm => !string.IsNullOrWhiteSpace(mm.CodActa)))
                        lastRoundWithCodActa = i;

                    DateTime? maxDate = null;
                    foreach (var m in matchesInRound)
                    {
                        if (string.IsNullOrWhiteSpace(m.Fecha)) continue;
                        if (DateTime.TryParseExact(m.Fecha.Trim(), formats, culture, DateTimeStyles.AssumeLocal,
                                out var dt) ||
                            DateTime.TryParse(m.Fecha.Trim(), culture, DateTimeStyles.AssumeLocal, out dt) ||
                            DateTime.TryParse(m.Fecha.Trim(), CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal,
                                out dt))
                        {
                            var d = dt.Date;
                            if (!maxDate.HasValue || d > maxDate.Value) maxDate = d;
                        }
                    }

                    if (maxDate.HasValue && maxDate.Value <= today)
                    {
                        cutoffRoundIndex = i; // this round is at or before today
                    }
                }

                if (cutoffRoundIndex < 0)
                {
                    // fallback: if no rounds had parseable dates, use last round that contains codacta entries
                    if (lastRoundWithCodActa >= 0)
                    {
                        cutoffRoundIndex = lastRoundWithCodActa;
                    }
                }

                if (cutoffRoundIndex < 0)
                {
                    // still no rounds to process -> nothing to do
                    return new GoalSectorsResponse { TeamCode = request.TeamCode, MatchesProcessed = 0 };
                }

                // Select only the matches up to the cutoff round, that belong to the requested team
                // and take at most one match per round (the match where the team participates).
                var matches = rounds
                    .Select((r, idx) => new { Round = r, Index = idx })
                    .Where(x => x.Round != null && (x.Round.EffectiveMatches?.Any() ?? false) && x.Index <= cutoffRoundIndex)
                    .SelectMany(x => x.Round!.EffectiveMatches!.Select(m => new { Match = m, RoundIndex = x.Index }))
                    // Only consider matches that have a codacta (we can't parse acta without it)
                    .Where(x => x.Match != null && !string.IsNullOrWhiteSpace(x.Match.CodActa))
                    // Only matches where the requested team participates
                    .Where(x =>
                        string.Equals(x.Match.LocalTeamCode?.Trim(), request.TeamCode?.Trim(), StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(x.Match.AwayTeamCode?.Trim(), request.TeamCode?.Trim(), StringComparison.OrdinalIgnoreCase))
                    // Group by round index and pick the first match per round (one match per jornada)
                    .GroupBy(x => x.RoundIndex)
                    .Select(g => g.First().Match!)
                    // Deduplicate by codacta in case the same acta appears multiple times
                    .GroupBy(m => (m.CodActa ?? string.Empty).Trim(), StringComparer.OrdinalIgnoreCase)
                    .Select(g => g.First())
                    .ToList();

                if (matches == null || matches.Count == 0)
                    return new GoalSectorsResponse { TeamCode = request.TeamCode, MatchesProcessed = 0 };

                // acta service will handle fetching and parsing

                int matchesProcessed = 0;

                int totalGoalsFor = 0;
                int totalGoalsAgainst = 0;

                // We'll collect all parsed goals minutes across processed games to determine sectors dynamically
                var allGoals = new List<(bool IsForTeam, int Minute)>();

                // For now we only deserialize acta JSON for each match and count processed actas.
                foreach (var match in matches)
                {
                    if (match == null) continue;

                    string? cod = match.CodActa;
                    if (string.IsNullOrWhiteSpace(cod))
                        continue;

                    // Use acta service to fetch and parse the game payload
                    try
                    {
                        var game = await _actaService.GetGameFromActaAsync(cod.Trim(), request.Temporada, request.Competicion, request.Grupo, cancellationToken);
                        if (game != null)
                        {
                            matchesProcessed++;

                            bool isLocalTeam = string.Equals(game.LocalTeamCode?.Trim(), request.TeamCode?.Trim(), StringComparison.OrdinalIgnoreCase);
                            bool isAwayTeam = string.Equals(game.AwayTeamCode?.Trim(), request.TeamCode?.Trim(), StringComparison.OrdinalIgnoreCase);

                            var compDesc = (game.CompetitionName ?? string.Empty).ToLowerInvariant();
                            int duration = 90;
                            if (compDesc.Contains("alevin") || compDesc.Contains("alevín")) duration = 60;
                            else if (compDesc.Contains("infantil")) duration = 70;
                            else if (compDesc.Contains("cadete")) duration = 80;

                            if (isLocalTeam)
                            {
                                totalGoalsFor += int.TryParse(game.LocalGoals, out var localGoals) ? localGoals : 0;
                                totalGoalsAgainst += int.TryParse(game.AwayGoals, out var awayGoals) ? awayGoals : 0;
                            }
                            else if (isAwayTeam)
                            {
                                totalGoalsFor += int.TryParse(game.AwayGoals, out var awayGoals) ? awayGoals : 0;
                                totalGoalsAgainst += int.TryParse(game.LocalGoals, out var localGoals) ? localGoals : 0;
                            }

                            if (isLocalTeam)
                            {
                                AddGoalsToList(game.LocalGoalsList, true, duration, allGoals);
                                AddGoalsToList(game.AwayGoalsList, false, duration, allGoals);
                            }
                            else if (isAwayTeam)
                            {
                                AddGoalsToList(game.AwayGoalsList, true, duration, allGoals);
                                AddGoalsToList(game.LocalGoalsList, false, duration, allGoals);
                            }
                        }
                    }
                    catch
                    {
                        // ignore per-acta failures
                    }
                }

                // Build sectors based on max minute observed or default 90
                int maxMinute = 0;
                if (allGoals.Any())
                    maxMinute = allGoals.Max(g => g.Minute);
                else
                    maxMinute = 90; // default to 90 if no goals found

                if (maxMinute < 1) maxMinute = 90; // safety

                int sectorsCount = (int)Math.Ceiling(maxMinute / 10.0);

                // initialize sectors
                var sectorMap = new Dictionary<int, Sector>();
                for (int i = 0; i < sectorsCount; i++)
                {
                    var start = i == 0 ? 0 : i * 10 + 1;
                    var end = (i + 1) * 10;
                    sectorMap[i] = new Sector { StartMinute = start, EndMinute = end, GoalsFor = 0, GoalsAgainst = 0 };
                }

                // accumulate goals into sectors
                foreach (var g in allGoals)
                {
                    var minute = g.Minute;
                    int idx = minute <= 0 ? 0 : (minute - 1) / 10;
                    if (idx < 0) idx = 0;
                    if (idx >= sectorsCount)
                    {
                        // expand sectors if necessary
                        for (int i = sectorsCount; i <= idx; i++)
                        {
                            var start = i == 0 ? 0 : i * 10 + 1;
                            var end = (i + 1) * 10;
                            sectorMap[i] = new Sector { StartMinute = start, EndMinute = end, GoalsFor = 0, GoalsAgainst = 0 };
                        }
                        sectorsCount = idx + 1;
                    }

                    var sector = sectorMap[idx];
                    if (g.IsForTeam)
                        sector.GoalsFor++;
                    else
                        sector.GoalsAgainst++;
                }

                // prepare response sectors ordered
                var responseSectors = sectorMap.OrderBy(kv => kv.Key).Select(kv => kv.Value).ToList();

                // compute sector sums for verification
                var sectorSumFor = responseSectors.Sum(s => s.GoalsFor);
                var sectorSumAgainst = responseSectors.Sum(s => s.GoalsAgainst);

                var response = new GoalSectorsResponse
                {
                    TeamCode = request.TeamCode,
                    MatchesProcessed = matchesProcessed,
                    Sectors = responseSectors
                    ,
                    TotalGoalsFor = totalGoalsFor
                    ,
                    TotalGoalsAgainst = totalGoalsAgainst
                    ,
                    SectorGoalsFor = sectorSumFor
                    ,
                    SectorGoalsAgainst = sectorSumAgainst
                };

                return response;
            }

            // Helper methods moved out of Handle for clarity
            private static bool IsFor(bool goalsAreForTeamFlag)
            {
                return goalsAreForTeamFlag;
            }

            private static int? ParseGoalMinute(string minuteText)
            {
                if (string.IsNullOrWhiteSpace(minuteText)) return null;
                var txt = minuteText.Trim();
                var m = Regex.Match(txt, "(?<base>\\d+)(?:\\s*\\+\\s*(?<extra>\\d+))?");
                if (!m.Success) return null;
                if (!int.TryParse(m.Groups["base"].Value, out var baseMin)) return null;
                var extra = 0;
                if (m.Groups["extra"].Success)
                    int.TryParse(m.Groups["extra"].Value, out extra);
                var minute = baseMin + extra;
                if (minute < 0) return null;
                return minute == 0 ? 0 : minute;
            }

            private static void AddGoalsToList(IEnumerable<Goal>? goals, bool goalsAreForTeam, int duration, List<(bool IsForTeam, int Minute)> allGoals)
            {
                if (goals == null) return;
                foreach (var g in goals)
                {
                    if (g == null) continue;
                    var minute = ParseGoalMinute(g.Minute);
                    int m;
                    if (minute.HasValue)
                    {
                        m = minute.Value;
                        if (m < 0) m = 0;
                        if (m > duration) m = duration;
                    }
                    else
                    {
                        m = duration;
                    }
                    // Handle own goals: tipo_gol == "102" indicates an own-goal, which should be counted
                    // against the team that the goal record belongs to.
                    var isOwnGoal = string.Equals(g.GoalType?.Trim(), "102", StringComparison.OrdinalIgnoreCase);
                    var isFor = IsFor(goalsAreForTeam);
                    if (isOwnGoal)
                    {
                        isFor = !isFor;
                    }
                    allGoals.Add((isFor, m));
                }
            }
         }
     }
 }
