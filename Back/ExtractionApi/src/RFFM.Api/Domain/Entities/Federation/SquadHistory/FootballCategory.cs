using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using Ardalis.SmartEnum;

namespace RFFM.Api.Domain.Entities.Federation.SquadHistory
{
    /// <summary>
    /// Categorías por año de nacimiento. Con Y = año de inicio de la temporada:
    /// Alevín Y-11..Y-10, Infantil Y-13..Y-12, Cadete Y-15..Y-14, Juvenil Y-18..Y-16, Senior ≤ Y-19.
    /// </summary>
    public sealed class FootballCategory : SmartEnum<FootballCategory>
    {
        public static readonly FootballCategory Alevin = new(nameof(Alevin), 1, "ALEVIN", youngestAge: 10, oldestAge: 11);
        public static readonly FootballCategory Infantil = new(nameof(Infantil), 2, "INFANTIL", youngestAge: 12, oldestAge: 13);
        public static readonly FootballCategory Cadete = new(nameof(Cadete), 3, "CADETE", youngestAge: 14, oldestAge: 15);
        public static readonly FootballCategory Juvenil = new(nameof(Juvenil), 4, "JUVENIL", youngestAge: 16, oldestAge: 18);
        public static readonly FootballCategory Senior = new(nameof(Senior), 5, null, youngestAge: 19, oldestAge: null);

        private static readonly string[] UnsupportedKeywords = ["PREBENJAMIN", "BENJAMIN", "VETERANO"];
        private static readonly Regex SeasonStartRegex = new(@"(19|20)\d{2}", RegexOptions.Compiled);

        private readonly string? _keyword;
        private readonly int _youngestAge;
        private readonly int? _oldestAge;

        private FootballCategory(string name, int value, string? keyword, int youngestAge, int? oldestAge) : base(name, value)
        {
            _keyword = keyword;
            _youngestAge = youngestAge;
            _oldestAge = oldestAge;
        }

        public FootballCategory? Lower => Name switch
        {
            nameof(Infantil) => Alevin,
            nameof(Cadete) => Infantil,
            nameof(Juvenil) => Cadete,
            nameof(Senior) => Juvenil,
            _ => null
        };

        public IReadOnlyList<FootballCategory> CandidateSources => Lower is null ? [this] : [this, Lower];

        public bool IncludesBirthYear(int birthYear, int seasonStartYear)
        {
            var youngestBirthYear = seasonStartYear - _youngestAge;
            var isOldEnough = birthYear <= youngestBirthYear;
            var isYoungEnough = _oldestAge is null || birthYear >= seasonStartYear - _oldestAge.Value;
            return isOldEnough && isYoungEnough;
        }

        public static bool TryDetect(string? text, out FootballCategory? category)
        {
            category = null;
            var normalized = Normalize(text);
            if (normalized.Length == 0) return false;
            if (UnsupportedKeywords.Any(normalized.Contains)) return false;

            category = List
                .Where(c => c._keyword != null)
                .FirstOrDefault(c => normalized.Contains(c._keyword!)) ?? Senior;
            return true;
        }

        public static bool IsFemale(string? text) => Normalize(text).Contains("FEMENINO");

        public static int? SeasonStartYear(string? seasonLabel)
        {
            var match = SeasonStartRegex.Match(seasonLabel ?? string.Empty);
            return match.Success ? int.Parse(match.Value, CultureInfo.InvariantCulture) : null;
        }

        private static string Normalize(string? text)
        {
            if (string.IsNullOrWhiteSpace(text)) return string.Empty;
            var decomposed = text.Trim().ToUpperInvariant().Normalize(NormalizationForm.FormD);
            var withoutMarks = decomposed.Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark);
            return new string(withoutMarks.ToArray()).Normalize(NormalizationForm.FormC);
        }
    }
}
