using System.Text.Json;
using RFFM.Api.Domain.Entities.TeamPlayers;

namespace RFFM.Api.Features.Coaches.Players.Services
{
    /// <summary>
    /// Shared helper to parse MatchParticipation.CardsJson (array of CardEvent
    /// { id, minute, half, cardType, teamPlayerId, playerName, isRivalPlayer, rivalDorsal },
    /// cardType case-insensitive "yellow"|"red") and count cards attributed to a given team
    /// player. Extracted from GetPlayerSeasonCards.CountCards so GetPlayerMatchHistory and
    /// SaveMatchParticipation reuse the same parsing logic instead of duplicating it a third
    /// time (design.md Decisión 2, tasks.md sección 2).
    /// </summary>
    public static class PlayerCardCountService
    {
        /// <summary>
        /// Counts cards of the given type (case-insensitive) attributed to teamPlayerId in the
        /// given CardsJson. Returns 0 for null/empty/malformed JSON.
        /// </summary>
        public static int CountCards(string? cardsJson, string teamPlayerId, string cardType)
        {
            if (string.IsNullOrEmpty(cardsJson)) return 0;

            try
            {
                using var doc = JsonDocument.Parse(cardsJson);
                if (doc.RootElement.ValueKind != JsonValueKind.Array) return 0;

                var count = 0;
                foreach (var card in doc.RootElement.EnumerateArray())
                {
                    var cardTeamPlayerId = card.TryGetProperty("teamPlayerId", out var idProp) ? idProp.GetString() : null;
                    var cardTypeValue = card.TryGetProperty("cardType", out var typeProp) ? typeProp.GetString() : null;

                    if (cardTeamPlayerId == teamPlayerId &&
                        string.Equals(cardTypeValue, cardType, StringComparison.OrdinalIgnoreCase))
                    {
                        count++;
                    }
                }
                return count;
            }
            catch
            {
                return 0;
            }
        }

        /// <summary>True if teamPlayerId has at least one red card in the given CardsJson.</summary>
        public static bool HasRedCard(string? cardsJson, string teamPlayerId)
            => CountCards(cardsJson, teamPlayerId, "red") > 0;

        /// <summary>
        /// Total yellow cards across all given (already filtered to finished, "Partido"-type)
        /// MatchParticipation rows for teamPlayerId, with no time bound (design.md Decisión 2 —
        /// "Histórico total").
        /// </summary>
        public static int CountHistoricalYellowCards(
            IEnumerable<MatchParticipation> matchTypeFinishedParticipations, string teamPlayerId)
            => matchTypeFinishedParticipations.Sum(mp => CountCards(mp.CardsJson, teamPlayerId, "yellow"));

        /// <summary>
        /// Sum of yellow cards for teamPlayerId across the given (participation, eventDate) pairs
        /// whose eventDate is strictly after sinceExclusive (or all of them if sinceExclusive is
        /// null) — design.md Decisión 2, "Cíclico (0→5)". Rows with a null eventDate are excluded
        /// once sinceExclusive is set, since their date can't be compared.
        /// </summary>
        public static int CountCyclicYellowCards(
            IEnumerable<(MatchParticipation Participation, DateTime? EventDate)> matchTypeFinishedParticipations,
            string teamPlayerId,
            DateTime? sinceExclusive)
            => matchTypeFinishedParticipations
                .Where(x => sinceExclusive is null || (x.EventDate.HasValue && x.EventDate.Value > sinceExclusive.Value))
                .Sum(x => CountCards(x.Participation.CardsJson, teamPlayerId, "yellow"));
    }
}
