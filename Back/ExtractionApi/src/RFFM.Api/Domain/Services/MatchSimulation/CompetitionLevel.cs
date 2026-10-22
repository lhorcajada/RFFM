using System.Globalization;
using System.Text;

namespace RFFM.Api.Domain.Services.MatchSimulation
{
    /// <summary>
    /// Nivel de una competición RFFM a partir de su nombre: rango de división + rango de categoría de edad
    /// (una categoría de edad más equivale a una división más). design.md D1.
    /// </summary>
    public static class CompetitionLevel
    {
        // Los nombres largos van antes que los cortos que contienen («PRIMERA DIVISION AUTONOMICA» ⊃ «PRIMERA»).
        private static readonly (string Pattern, int Rank)[] Divisions =
        [
            ("SUPERLIGA", 6),
            ("DIVISION DE HONOR", 5),
            ("PRIMERA DIVISION AUTONOMICA", 4),
            ("PRIMERA AUTONOMICA", 4),
            ("PREFERENTE", 3),
            ("PRIMERA", 2),
            ("SEGUNDA", 1),
            ("TERCERA", 0)
        ];

        private static readonly (string Pattern, int Rank)[] AgeCategories =
        [
            ("PREBENJAMIN", 0),
            ("BENJAMIN", 1),
            ("ALEVIN", 2),
            ("INFANTIL", 3),
            ("CADETE", 4),
            ("JUVENIL", 5),
            ("AFICIONADO", 6),
            ("SENIOR", 6)
        ];

        public static int? Division(string competitionName) => Match(competitionName, Divisions);

        public static int? AgeCategory(string competitionName) => Match(competitionName, AgeCategories);

        /// <returns>null si no se reconoce la división; sin categoría de edad cuenta solo la división.</returns>
        public static int? Level(string competitionName)
        {
            var division = Division(competitionName);
            return division is null ? null : division + (AgeCategory(competitionName) ?? 0);
        }

        private static int? Match(string competitionName, (string Pattern, int Rank)[] ranks)
        {
            var normalized = Normalize(competitionName);
            foreach (var (pattern, rank) in ranks)
                if (normalized.Contains(pattern, StringComparison.Ordinal))
                    return rank;
            return null;
        }

        private static string Normalize(string value)
        {
            var decomposed = (value ?? string.Empty).Normalize(NormalizationForm.FormD);
            var builder = new StringBuilder(decomposed.Length);
            foreach (var c in decomposed)
                if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
                    builder.Append(c);
            return string.Join(' ', builder.ToString().ToUpperInvariant().Split(' ', StringSplitOptions.RemoveEmptyEntries));
        }
    }
}
