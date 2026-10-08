using System.Text.Json;

namespace RFFM.Api.Features.Coaches.MatchReports
{
    public record LiveMatchReport(
        string? FormationName,
        int? MatchDurationMinutes,
        List<ReportPlayer> Starters,
        List<ReportPlayer> Bench,
        List<ReportGoal> Goals,
        List<ReportCard> Cards,
        List<ReportSubstitutionWindow> SubstitutionWindows);

    public record ReportPlayer(string TeamPlayerId, string Name, int? Dorsal, string? PhotoUrl, int? SlotIndex, int MinutesPlayed);

    public record ReportGoal(int Minute, string? ScorerName, int? ScorerDorsal, bool IsOwnTeam, int ScoreLocal, int ScoreVisitor);

    public record ReportCard(int Minute, int Half, string CardType, string? PlayerName, int? RivalDorsal, bool IsRivalPlayer);

    public record ReportSubstitutionWindow(int WindowIndex, bool IsHalftime, int Minute, int Half, List<ReportSwap> Swaps);

    public record ReportSwap(string InPlayerName, string? OutPlayerName);

    /// <summary>
    /// Maps the JSON blobs saved by the live match screen into the match report, resolving
    /// player names so web and mobile render the same data without parsing it twice.
    /// </summary>
    public static class LiveMatchReportBuilder
    {
        private const string UnknownPlayerName = "Jugador";

        public record PlayerInfo(string TeamPlayerId, string Name, int? Dorsal, string? PhotoUrl);

        public record ParticipationInfo(string TeamPlayerId, int MinutesPlayed, bool IsStarter);

        public record StartingLineup(string? FormationName, IReadOnlyDictionary<string, int> SlotByPlayer);

        private record GoalJson(int Minute, string? ScorerId, string? ScorerName, int? ScorerDorsal, bool IsOwnTeam, ScoreJson? ScoreAtMoment);

        private record ScoreJson(int Local, int Visitor);

        private record CardJson(int Minute, int Half, string? CardType, string? TeamPlayerId, string? PlayerName, bool IsRivalPlayer, int? RivalDorsal);

        private record WindowJson(int WindowIndex, int Minute, int Half, bool? IsHalftime, List<SwapJson>? Swaps);

        private record SwapJson(string? InPlayerId, string? OutPlayerId);

        private record StartingLineupJson(string? FormationName, Dictionary<string, string?>? Slots);

        public static LiveMatchReport Build(
            IReadOnlyDictionary<string, PlayerInfo> players,
            IReadOnlyList<ParticipationInfo> participations,
            IReadOnlyCollection<string> convocatedTeamPlayerIds,
            StartingLineup? lineup,
            string? goalsJson,
            string? cardsJson,
            string? substitutionWindowsJson,
            int? matchDurationMinutes)
        {
            var minutesByPlayer = participations.ToDictionary(p => p.TeamPlayerId, p => p.MinutesPlayed);
            var starterIds = participations.Where(p => p.IsStarter).Select(p => p.TeamPlayerId).ToHashSet();

            ReportPlayer ToReportPlayer(string teamPlayerId, int? slotIndex)
            {
                players.TryGetValue(teamPlayerId, out var info);
                return new ReportPlayer(
                    teamPlayerId,
                    info?.Name ?? UnknownPlayerName,
                    info?.Dorsal,
                    info?.PhotoUrl,
                    slotIndex,
                    minutesByPlayer.GetValueOrDefault(teamPlayerId));
            }

            var starters = starterIds
                .Select(id => ToReportPlayer(id, lineup != null && lineup.SlotByPlayer.TryGetValue(id, out var slot) ? slot : null))
                .OrderBy(p => p.SlotIndex ?? int.MaxValue)
                .ThenBy(p => p.Name)
                .ToList();

            var bench = convocatedTeamPlayerIds
                .Concat(participations.Where(p => !p.IsStarter).Select(p => p.TeamPlayerId))
                .Where(id => !starterIds.Contains(id))
                .Distinct()
                .Select(id => ToReportPlayer(id, null))
                .OrderByDescending(p => p.MinutesPlayed)
                .ThenBy(p => p.Name)
                .ToList();

            string? NameOf(string? teamPlayerId, string? fallback)
                => teamPlayerId != null && players.TryGetValue(teamPlayerId, out var info) ? info.Name : fallback;

            var goals = ParseList<GoalJson>(goalsJson)
                .OrderBy(g => g.Minute)
                .Select(g => new ReportGoal(
                    g.Minute,
                    NameOf(g.ScorerId, g.ScorerName),
                    g.ScorerId != null && players.TryGetValue(g.ScorerId, out var scorer) ? scorer.Dorsal : g.ScorerDorsal,
                    g.IsOwnTeam,
                    g.ScoreAtMoment?.Local ?? 0,
                    g.ScoreAtMoment?.Visitor ?? 0))
                .ToList();

            var cards = ParseList<CardJson>(cardsJson)
                .OrderBy(c => c.Minute)
                .Select(c => new ReportCard(
                    c.Minute,
                    c.Half,
                    c.CardType ?? "yellow",
                    c.IsRivalPlayer ? null : NameOf(c.TeamPlayerId, c.PlayerName),
                    c.RivalDorsal,
                    c.IsRivalPlayer))
                .ToList();

            var windows = ParseList<WindowJson>(substitutionWindowsJson)
                .OrderBy(w => w.Minute)
                .ThenBy(w => w.IsHalftime == true ? 0 : 1)
                .Select(w => new ReportSubstitutionWindow(
                    w.WindowIndex,
                    w.IsHalftime == true,
                    w.Minute,
                    w.Half,
                    (w.Swaps ?? [])
                        .Where(s => s.InPlayerId != null)
                        .Select(s => new ReportSwap(NameOf(s.InPlayerId, UnknownPlayerName)!, s.OutPlayerId == null ? null : NameOf(s.OutPlayerId, UnknownPlayerName)))
                        .ToList()))
                .ToList();

            return new LiveMatchReport(lineup?.FormationName, matchDurationMinutes, starters, bench, goals, cards, windows);
        }

        public static StartingLineup? ParseStartingLineup(string? json)
        {
            if (string.IsNullOrWhiteSpace(json)) return null;
            try
            {
                var parsed = JsonSerializer.Deserialize<StartingLineupJson>(json, JsonSerializerOptions.Web);
                if (parsed is null) return null;
                var slots = (parsed.Slots ?? new Dictionary<string, string?>())
                    .Where(kv => kv.Value != null && int.TryParse(kv.Key, out _))
                    .GroupBy(kv => kv.Value!)
                    .ToDictionary(g => g.Key, g => int.Parse(g.First().Key));
                return new StartingLineup(parsed.FormationName, slots);
            }
            catch (JsonException)
            {
                return null;
            }
        }

        private static List<T> ParseList<T>(string? json)
        {
            if (string.IsNullOrWhiteSpace(json)) return [];
            try
            {
                return JsonSerializer.Deserialize<List<T>>(json, JsonSerializerOptions.Web) ?? [];
            }
            catch (JsonException)
            {
                return [];
            }
        }
    }
}
