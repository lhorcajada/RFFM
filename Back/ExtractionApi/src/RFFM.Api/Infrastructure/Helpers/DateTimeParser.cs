using System.Globalization;

namespace RFFM.Api.Infrastructure.Helpers
{
    /// <summary>
    /// Small helper to robustly parse dates from external sources (RFFM API, pages, etc.).
    /// Provides TryParseDate and ParseOrMinValue to avoid throwing exceptions when formats are unexpected.
    /// </summary>
    public static class DateTimeParser
    {
        private static readonly string[] CommonFormats = new[]
        {
            "dd-MM-yyyy",
            "d-M-yyyy",
            "dd/MM/yyyy",
            "d/M/yyyy",
            "yyyy-MM-dd",
            "yyyy-M-d",
        };

        public static bool TryParseDate(string? input, out DateTime result)
        {
            result = DateTime.MinValue;
            if (string.IsNullOrWhiteSpace(input))
                return false;

            var s = input.Trim();

            // Try exact common formats using invariant culture first
            if (DateTime.TryParseExact(s, CommonFormats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed))
            {
                result = parsed;
                return true;
            }

            // Try Spanish culture (common for the source data)
            if (DateTime.TryParse(s, new CultureInfo("es-ES"), DateTimeStyles.None, out parsed))
            {
                result = parsed;
                return true;
            }

            // Fallback to invariant parse
            if (DateTime.TryParse(s, CultureInfo.InvariantCulture, DateTimeStyles.None, out parsed))
            {
                result = parsed;
                return true;
            }

            return false;
        }

        /// <summary>
        /// Parse date or return DateTime.MinValue on failure.
        /// </summary>
        public static DateTime ParseOrMinValue(string? input)
        {
            return TryParseDate(input, out var d) ? d : DateTime.MinValue;
        }
    }
}
