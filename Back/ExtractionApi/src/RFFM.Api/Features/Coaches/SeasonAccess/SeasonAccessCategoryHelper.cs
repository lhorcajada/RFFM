using System;
using System.Text.RegularExpressions;

namespace RFFM.Api.Features.Coaches.SeasonAccess
{
    internal static class SeasonAccessCategoryHelper
    {
        private static readonly string[] GeneralCategories = new[]
        {
            "DEBUTANTES",
            "PREBENJAMINES",
            "BENJAMINES",
            "INFANTILES",
            "CADETES",
            "JUVENILES"
        };

        public static string ExtractGeneralCategory(string? categoryInput)
        {
            if (string.IsNullOrWhiteSpace(categoryInput))
                return string.Empty;

            var normalized = categoryInput.Trim();

            // 1) exact match (case-insensitive)
            foreach (var g in GeneralCategories)
            {
                if (string.Equals(g, normalized, StringComparison.OrdinalIgnoreCase))
                    return g;
            }

            // 2) find any general category as a whole word inside the input
            foreach (var g in GeneralCategories)
            {
                if (Regex.IsMatch(normalized, $"\\b{Regex.Escape(g)}\\b", RegexOptions.IgnoreCase))
                    return g;
            }

            // 3) try last token (e.g. "SEGUNDA INFANTIL" -> "INFANTIL")
            var tokens = normalized.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            var last = tokens.Length > 0 ? tokens[^1] : normalized;
            foreach (var g in GeneralCategories)
            {
                if (string.Equals(g, last, StringComparison.OrdinalIgnoreCase))
                    return g;
                // match singular forms like "INFANTIL" vs "INFANTILES"
                if (g.EndsWith("S") && string.Equals(g.TrimEnd('S'), last, StringComparison.OrdinalIgnoreCase))
                    return g;
            }

            // fallback: return trimmed input
            return normalized;
        }
    }
}
