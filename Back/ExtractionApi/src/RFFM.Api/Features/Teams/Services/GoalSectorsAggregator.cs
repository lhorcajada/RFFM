using Microsoft.Extensions.Logging;
using RFFM.Api.Features.Competitions.Queries.GetCalendar.Responses;
using RFFM.Api.Features.Teams.Models;
using RFFM.Api.Features.Teams.Queries.Responses;

namespace RFFM.Api.Features.Teams.Services
{
    public class GoalSectorsAggregator : IGoalSectorsAggregator
    {
        private readonly IGoalMinuteParser _minuteParser;
        private readonly ISectorFactory _sectorFactory;
        private readonly ILogger<GoalSectorsAggregator> _logger;

        public GoalSectorsAggregator(IGoalMinuteParser minuteParser, ISectorFactory sectorFactory, ILogger<GoalSectorsAggregator> logger)
        {
            _minuteParser = minuteParser;
            _sectorFactory = sectorFactory;
            _logger = logger;
        }

        public async Task<(GoalSectorsResponse team1, GoalSectorsResponse team2)> AggregateAsync(
            string teamCode1,
            string teamCode2,
            int matchTime,
            int sectorsPerHalf,
            List<MatchResponse> matches,
            Func<string, Task<MatchRffm?>> fetchActa,
            CancellationToken cancellationToken)
        {
            var resp1 = new GoalSectorsResponse { TeamCode = teamCode1, Sectors = _sectorFactory.BuildSectors(matchTime, sectorsPerHalf) };
            var resp2 = new GoalSectorsResponse { TeamCode = teamCode2, Sectors = _sectorFactory.BuildSectors(matchTime, sectorsPerHalf) };

            var totalSectors = sectorsPerHalf * 2;
            var halfDuration = matchTime / 2;
            var matchesProcessed = 0;

            // normalize search codes once
            var team1Norm = NormalizeTeamCode(teamCode1);
            var team2Norm = NormalizeTeamCode(teamCode2);

            // Deduplicate matches by MatchRecordCode to avoid processing same acta twice
            var uniqueMatches = matches
                .Where(m => !string.IsNullOrWhiteSpace(m.MatchRecordCode))
                .GroupBy(m => m.MatchRecordCode)
                .Select(g => g.First())
                .ToList();

            foreach (var match in uniqueMatches)
            {
                var acta = await fetchActa(match.MatchRecordCode);
                if (acta == null)
                    continue;

                var localGoals = acta.LocalGoalsList ?? new List<Goal>();
                var awayGoals = acta.AwayGoalsList ?? new List<Goal>();
                var played = false;

                var localCodeRaw = acta.LocalTeamCode ?? string.Empty;
                var awayCodeRaw = acta.AwayTeamCode ?? string.Empty;
                var localCodeNorm = NormalizeTeamCode(localCodeRaw);
                var awayCodeNorm = NormalizeTeamCode(awayCodeRaw);

                // per-match mapping
                var localIsTeam1 = localCodeNorm == team1Norm;
                var localIsTeam2 = localCodeNorm == team2Norm;
                var awayIsTeam1 = awayCodeNorm == team1Norm;
                var awayIsTeam2 = awayCodeNorm == team2Norm;

                _logger.LogDebug("Processing match {Match} local={LocalCode} away={AwayCode} mapping: localIsTeam1={L1} localIsTeam2={L2} awayIsTeam1={A1} awayIsTeam2={A2}",
                    match.MatchRecordCode, localCodeRaw, awayCodeRaw, localIsTeam1, localIsTeam2, awayIsTeam1, awayIsTeam2);

                // Process local goals: scorer = local, opponent = away
                foreach (var g in localGoals)
                {
                    var (main, total) = _minuteParser.Parse(g.Minute);
                    if (total <= 0 || total > matchTime)
                        continue;

                    var extra = total - main;
                    int usedMinute;
                    if (extra > 0)
                    {
                        if (main <= halfDuration)
                            usedMinute = halfDuration; // added time after first half => map to last minute of first half
                        else
                            usedMinute = Math.Min(total, matchTime);
                    }
                    else
                    {
                        usedMinute = Math.Min(total, matchTime);
                    }

                    var sectorIdx = GetSectorIndex(usedMinute, halfDuration, sectorsPerHalf);
                    if (sectorIdx < 0 || sectorIdx >= totalSectors)
                        continue;

                    var updates = new List<string>();

                    if (localIsTeam1)
                    {
                        resp1.Sectors[sectorIdx].GoalsFor++;
                        resp1.TotalGoalsFor++;
                        updates.Add($"{team1Norm}:FOR");
                        played = true;
                    }
                    if (localIsTeam2)
                    {
                        resp2.Sectors[sectorIdx].GoalsFor++;
                        resp2.TotalGoalsFor++;
                        updates.Add($"{team2Norm}:FOR");
                        played = true;
                    }

                    if (awayIsTeam1)
                    {
                        resp1.Sectors[sectorIdx].GoalsAgainst++;
                        resp1.TotalGoalsAgainst++;
                        updates.Add($"{team1Norm}:AGAINST");
                        played = true;
                    }
                    if (awayIsTeam2)
                    {
                        resp2.Sectors[sectorIdx].GoalsAgainst++;
                        resp2.TotalGoalsAgainst++;
                        updates.Add($"{team2Norm}:AGAINST");
                        played = true;
                    }

                    if (updates.Count > 0)
                    {
                        _logger.LogDebug("Match {Match} local goal raw='{RawMinute}' parsed=({Main},{Total}) used={Used} sector={Sector} updates={Updates}",
                            match.MatchRecordCode, g.Minute, main, total, usedMinute, sectorIdx, string.Join(';', updates));
                    }
                }

                // Process away goals: scorer = away, opponent = local
                foreach (var g in awayGoals)
                {
                    var (main, total) = _minuteParser.Parse(g.Minute);
                    if (total <= 0 || total > matchTime)
                        continue;

                    var extra = total - main;
                    int usedMinute;
                    if (extra > 0)
                    {
                        if (main <= halfDuration)
                            usedMinute = halfDuration;
                        else
                            usedMinute = Math.Min(total, matchTime);
                    }
                    else
                    {
                        usedMinute = Math.Min(total, matchTime);
                    }

                    var sectorIdx = GetSectorIndex(usedMinute, halfDuration, sectorsPerHalf);
                    if (sectorIdx < 0 || sectorIdx >= totalSectors)
                        continue;

                    var updates = new List<string>();

                    if (awayIsTeam1)
                    {
                        resp1.Sectors[sectorIdx].GoalsFor++;
                        resp1.TotalGoalsFor++;
                        updates.Add($"{team1Norm}:FOR");
                        played = true;
                    }
                    if (awayIsTeam2)
                    {
                        resp2.Sectors[sectorIdx].GoalsFor++;
                        resp2.TotalGoalsFor++;
                        updates.Add($"{team2Norm}:FOR");
                        played = true;
                    }

                    if (localIsTeam1)
                    {
                        resp1.Sectors[sectorIdx].GoalsAgainst++;
                        resp1.TotalGoalsAgainst++;
                        updates.Add($"{team1Norm}:AGAINST");
                        played = true;
                    }
                    if (localIsTeam2)
                    {
                        resp2.Sectors[sectorIdx].GoalsAgainst++;
                        resp2.TotalGoalsAgainst++;
                        updates.Add($"{team2Norm}:AGAINST");
                        played = true;
                    }

                    if (updates.Count > 0)
                    {
                        _logger.LogDebug("Match {Match} away goal raw='{RawMinute}' parsed=({Main},{Total}) used={Used} sector={Sector} updates={Updates}",
                            match.MatchRecordCode, g.Minute, main, total, usedMinute, sectorIdx, string.Join(';', updates));
                    }
                }

                if (played)
                    matchesProcessed++;
            }

            resp1.MatchesProcessed = matchesProcessed;
            resp2.MatchesProcessed = matchesProcessed;

            _logger.LogInformation("Aggregation finished for {Team1} vs {Team2}: team1 {TF}-{TA}, team2 {TF2}-{TA2}", team1Norm, team2Norm, resp1.TotalGoalsFor, resp1.TotalGoalsAgainst, resp2.TotalGoalsFor, resp2.TotalGoalsAgainst);

            return (resp1, resp2);
        }

        private static string NormalizeTeamCode(string code)
        {
            if (string.IsNullOrWhiteSpace(code))
                return string.Empty;
            var s = code.Trim();
            // remove leading zeros
            s = s.TrimStart('0');
            return s;
        }

        private int GetSectorIndex(int minute, int halfDuration, int sectorsPerHalf)
        {
            if (minute <= 0)
                return -1;

            if (minute <= halfDuration)
            {
                var accumulated = 0;
                var baseLen = halfDuration / sectorsPerHalf;
                var remainder = halfDuration % sectorsPerHalf;
                for (var s = 0; s < sectorsPerHalf; s++)
                {
                    var len = baseLen + (s < remainder ? 1 : 0);
                    var start = accumulated + 1;
                    var end = accumulated + len;
                    if (minute >= start && minute <= end)
                        return s;
                    accumulated += len;
                }
            }
            else
            {
                var minuteInSecond = minute - halfDuration;
                var accumulated = 0;
                var baseLen = halfDuration / sectorsPerHalf;
                var remainder = halfDuration % sectorsPerHalf;
                for (var s = 0; s < sectorsPerHalf; s++)
                {
                    var len = baseLen + (s < remainder ? 1 : 0);
                    var start = accumulated + 1;
                    var end = accumulated + len;
                    if (minuteInSecond >= start && minuteInSecond <= end)
                        return sectorsPerHalf + s;
                    accumulated += len;
                }
            }

            return -1;
        }
    }
}