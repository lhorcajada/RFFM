using System.Text.Json;
using RFFM.Api.Domain.Entities.Federation.Results;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    /// <summary>
    /// Regresión con datos reales: resultados de las 30 jornadas del grupo 24037744 (temporada 2025-2026,
    /// con varios triples empates) y la clasificación oficial de la RFFM tras cada jornada.
    /// </summary>
    public class RffmStandingsCalculatorRealDataTests
    {
        private sealed record Fixture(
            List<FixtureTeam> Teams,
            List<JsonElement[]> Matches,
            Dictionary<string, List<string>> Official,
            Dictionary<string, Dictionary<string, int>> Sanctions);

        private sealed record FixtureTeam(string Code, string Name);

        private static readonly Fixture Data = JsonSerializer.Deserialize<Fixture>(
            File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Fixtures", "Rffm", "standings_group_24037744_season_21.json")),
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true })!;

        private static int? Goals(JsonElement value) => value.ValueKind == JsonValueKind.Number ? value.GetInt32() : null;

        public static IEnumerable<object[]> Rounds() => Data.Official.Keys.Select(r => new object[] { int.Parse(r) });

        [Theory]
        [MemberData(nameof(Rounds))]
        public void La_clasificacion_calculada_coincide_con_la_oficial(int round)
        {
            var calendar = Data.Matches
                .Select(m => new StandingsMatch(m[0].GetInt32(), m[1].GetString()!, m[2].GetString()!, Goals(m[3]), Goals(m[4])))
                .ToList();
            var teams = Data.Teams.Select(t => new StandingsTeam(t.Code, t.Name, string.Empty));

            var rows = RffmStandingsCalculator.Calculate(teams, calendar, round, RffmPointsSystem.Default,
                Data.Sanctions[round.ToString()]);

            Assert.Equal(Data.Official[round.ToString()], rows.Select(r => r.TeamCode));
        }
    }
}
