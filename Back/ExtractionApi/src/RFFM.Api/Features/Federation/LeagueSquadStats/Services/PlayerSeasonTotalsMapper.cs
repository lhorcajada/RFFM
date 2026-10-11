using System.Text.Json;
using RFFM.Api.Domain.Entities.Federation.LeagueSquadStats;
using RFFM.Api.Features.Federation.Players.Models;

namespace RFFM.Api.Features.Federation.LeagueSquadStats.Services
{
    public record PlayerSeasonParticipation(string CompetitionName, string GroupName, string TeamCode, string TeamName,
        int TeamPoints, int TeamPosition);

    /// <summary>Convierte la ficha RFFM de un jugador en los totales que se persisten por temporada.</summary>
    public static class PlayerSeasonTotalsMapper
    {
        public static PlayerSeasonTotals From(Player sheet)
        {
            var participations = sheet.Competitions
                .Select(c => new PlayerSeasonParticipation(c.CompetitionName, c.GroupName, c.TeamCode, c.TeamName, c.TeamPoints, c.TeamPosition))
                .ToList();
            var stats = SeasonStats.From(sheet);
            var hasActivity = participations.Count > 0 || stats.Called > 0;

            return new PlayerSeasonTotals(
                sheet.Name,
                sheet.BirthYear > 0 ? sheet.BirthYear : null,
                sheet.Position,
                stats.Called, stats.Starter, stats.Substitute, stats.Played, stats.Goals,
                stats.Yellow, stats.Red, stats.DoubleYellow,
                JsonSerializer.Serialize(participations),
                hasActivity);
        }

        public static IReadOnlyList<PlayerSeasonParticipation> ReadParticipations(string? json)
        {
            if (string.IsNullOrWhiteSpace(json)) return [];

            try
            {
                return JsonSerializer.Deserialize<List<PlayerSeasonParticipation>>(json) ?? [];
            }
            catch (JsonException)
            {
                return [];
            }
        }
    }
}
