using System.Globalization;
using System.Text.Json;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using RFFM.Api.Common;
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.RivalStats;
using RFFM.Api.Features.Federation.Teams.Models;
using RFFM.Api.Infrastructure.Options;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.LeagueScorers
{
    public class GetLeagueScorers : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet(
                    "/api/teams/{teamId}/league-scorers",
                    async (string teamId, int? round, IMediator mediator, CancellationToken cancellationToken) =>
                        Results.Ok(await mediator.Send(new LeagueScorersQuery { TeamId = teamId, Round = round }, cancellationToken)))
                .WithName(nameof(GetLeagueScorers))
                .WithTags("LeagueScorers")
                .Produces<LeagueScorersResponse>()
                .Produces(StatusCodes.Status403Forbidden)
                .Produces(StatusCodes.Status409Conflict);
        }

        public record LeagueScorersQuery : IQueryApp<LeagueScorersResponse>, IRequireFeaturePermission, IRequireTeamMembership
        {
            public string TeamId { get; set; } = null!;
            public int? Round { get; set; }

            public string FeatureRoute => CoachFeatureRoutes.Convocations;
            public string RequiredPermission => "Read";
        }

        public class Handler(AppDbContext appDb, FederationDbContext db, IOptions<RffmOptions> rffmOptions)
            : IRequestHandler<LeagueScorersQuery, LeagueScorersResponse>
        {
            public async ValueTask<LeagueScorersResponse> Handle(LeagueScorersQuery request, CancellationToken cancellationToken)
            {
                var league = await RivalStatsLeague.ResolveAsync(appDb, request.TeamId, rffmOptions.Value, cancellationToken);

                var matches = await db.RffmRounds.AsNoTracking()
                    .Where(r => r.GroupCode == league.GroupCode)
                    .SelectMany(r => r.Matches.Select(m => new LeagueScorersBuilder.MatchInput(
                        r.Number, m.RecordCode, m.RecordClosed == "1", m.Date, m.Time,
                        m.LocalTeamName, m.VisitorTeamName, m.LocalTeamCode, m.VisitorTeamCode,
                        m.LocalGoals, m.VisitorGoals)))
                    .ToListAsync(cancellationToken);

                var round = LeagueScorersBuilder.ResolveRound(matches, request.Round);
                var closedCodes = matches.Where(m => m.IsFinal && m.Round <= round).Select(m => m.RecordCode).Distinct().ToList();

                var payloads = await db.RffmMatchRecords.AsNoTracking()
                    .Where(r => closedCodes.Contains(r.RecordCode))
                    .Select(r => new { r.RecordCode, r.PayloadJson })
                    .ToListAsync(cancellationToken);

                var actas = new Dictionary<string, MatchRffm>();
                foreach (var payload in payloads)
                {
                    var acta = JsonSerializer.Deserialize<MatchRffm>(payload.PayloadJson);
                    if (acta != null) actas[payload.RecordCode] = acta;
                }

                return LeagueScorersBuilder.Build(matches, actas, round, league.OwnTeamCode);
            }
        }
    }

    public record LeagueGoal(string Minute, string Player, string Team, string Type, int? SeasonGoals);

    public record LeagueMatch(string RecordCode, string Date, string Time, string Home, string Away,
        string HomeGoals, string AwayGoals, bool IsOwnTeam, bool PendingActa, IReadOnlyList<LeagueGoal> Goals);

    public record LeagueScorer(int Rank, string Player, string Team, int Goals);

    public record LeagueScorersResponse(IReadOnlyList<int> Rounds, int Round, IReadOnlyList<LeagueMatch> Matches,
        IReadOnlyList<LeagueScorer> Scorers);

    /// <summary>Agrega goles y ranking a partir de actas ya guardadas; sin acceso a BD ni a la RFFM.</summary>
    public static class LeagueScorersBuilder
    {
        private const string PenaltyCode = "101";
        private const string OwnGoalCode = "102";
        private const int RankingSize = 20;

        public record MatchInput(int Round, string RecordCode, bool IsFinal, string Date, string Time, string Home, string Away,
            string HomeCode, string AwayCode, string HomeGoals, string AwayGoals);

        public static int ResolveRound(IReadOnlyList<MatchInput> matches, int? requested)
        {
            if (requested.HasValue && matches.Any(m => m.Round == requested.Value))
                return requested.Value;
            var closedRounds = matches.Where(m => m.IsFinal).Select(m => m.Round).ToList();
            if (closedRounds.Count > 0) return closedRounds.Max();
            return matches.Count > 0 ? matches.Min(m => m.Round) : 0;
        }

        public static LeagueScorersResponse Build(IReadOnlyList<MatchInput> matches, IReadOnlyDictionary<string, MatchRffm> actas,
            int? requestedRound, string? ownTeamCode)
        {
            var round = ResolveRound(matches, requestedRound);
            var rounds = matches.Select(m => m.Round).Distinct().Order().ToList();

            var totals = SeasonTotals(matches, actas, round);

            var roundMatches = matches.Where(m => m.Round == round).Select(m =>
            {
                actas.TryGetValue(m.RecordCode, out var acta);
                var pending = m.IsFinal && acta == null;
                var goals = acta == null ? [] : GoalsOf(m, acta, totals);
                var isOwn = !string.IsNullOrWhiteSpace(ownTeamCode)
                            && (Same(m.HomeCode, ownTeamCode) || Same(m.AwayCode, ownTeamCode));
                return new LeagueMatch(m.RecordCode, m.Date, m.Time, m.Home, m.Away, m.HomeGoals, m.AwayGoals, isOwn, pending, goals);
            }).ToList();

            return new LeagueScorersResponse(rounds, round, roundMatches, Rank(totals));
        }

        private sealed record PlayerTotal(string Player, string Team, int Goals);

        /// <summary>Goles de cada jugador (sin propias) en las actas guardadas hasta la jornada indicada.</summary>
        private static Dictionary<string, PlayerTotal> SeasonTotals(IReadOnlyList<MatchInput> matches,
            IReadOnlyDictionary<string, MatchRffm> actas, int round)
        {
            var totals = new Dictionary<string, PlayerTotal>();
            foreach (var match in matches.Where(m => m.Round <= round && actas.ContainsKey(m.RecordCode)))
            {
                var acta = actas[match.RecordCode];
                Count(totals, acta.LocalGoalsList, match.Home);
                Count(totals, acta.AwayGoalsList, match.Away);
            }

            return totals;
        }

        private static void Count(Dictionary<string, PlayerTotal> totals, List<Goal>? goals, string team)
        {
            foreach (var goal in goals ?? [])
            {
                if (IsOwnGoal(goal)) continue;
                var key = ScorerKey(goal, team);
                totals[key] = totals.TryGetValue(key, out var current)
                    ? current with { Goals = current.Goals + 1 }
                    : new PlayerTotal(goal.PlayerName?.Trim() ?? string.Empty, team, 1);
            }
        }

        private static List<LeagueGoal> GoalsOf(MatchInput match, MatchRffm acta, IReadOnlyDictionary<string, PlayerTotal> totals) =>
            (acta.LocalGoalsList ?? []).Select(g => (Goal: g, Team: match.Home))
                .Concat((acta.AwayGoalsList ?? []).Select(g => (Goal: g, Team: match.Away)))
                .OrderBy(x => MinuteKey(x.Goal.Minute))
                .Select(x => new LeagueGoal(x.Goal.Minute?.Trim() ?? string.Empty, x.Goal.PlayerName?.Trim() ?? string.Empty,
                    x.Team, TypeOf(x.Goal.GoalType),
                    IsOwnGoal(x.Goal) ? null : totals.GetValueOrDefault(ScorerKey(x.Goal, x.Team))?.Goals))
                .ToList();

        private static List<LeagueScorer> Rank(IReadOnlyDictionary<string, PlayerTotal> totals) =>
            totals.Values
                .OrderByDescending(t => t.Goals)
                .ThenBy(t => t.Player, StringComparer.OrdinalIgnoreCase)
                .Take(RankingSize)
                .Select((t, i) => new LeagueScorer(i + 1, t.Player, t.Team, t.Goals))
                .ToList();

        private static bool IsOwnGoal(Goal goal) => goal.GoalType?.Trim() == OwnGoalCode;

        private static string ScorerKey(Goal goal, string team)
        {
            var code = goal.PlayerCode?.Trim();
            return string.IsNullOrEmpty(code)
                ? $"n:{(goal.PlayerName?.Trim() ?? string.Empty).ToLowerInvariant()}|{team.Trim().ToLowerInvariant()}"
                : $"c:{code.ToLowerInvariant()}";
        }

        private static string TypeOf(string? goalType) => goalType?.Trim() switch
        {
            OwnGoalCode => "ownGoal",
            PenaltyCode => "penalty",
            _ => "normal"
        };

        /// <summary>«90+2'» → 90·1000+2; un minuto vacío o ilegible queda al final.</summary>
        private static int MinuteKey(string? minute)
        {
            var clean = (minute ?? string.Empty).Replace("'", string.Empty).Trim();
            if (clean.Length == 0) return int.MaxValue;
            var parts = clean.Split('+', 2);
            if (!int.TryParse(parts[0], NumberStyles.Integer, CultureInfo.InvariantCulture, out var main)) return int.MaxValue;
            var extra = parts.Length > 1 && int.TryParse(parts[1], NumberStyles.Integer, CultureInfo.InvariantCulture, out var e) ? e : 0;
            return main * 1000 + extra;
        }

        private static bool Same(string? a, string? b) =>
            !string.IsNullOrWhiteSpace(a) && string.Equals(a.Trim(), b?.Trim(), StringComparison.OrdinalIgnoreCase);
    }
}
