using System.Text.Json;
using System.Text.RegularExpressions;
using RFFM.Api.Features.Federation.Teams.Models;

namespace RFFM.Api.Features.Federation.Teams.Services
{
    public static class ActaParser
    {
        private static readonly Regex NextDataRegex = new(
            @"<script[^>]*\bid\s*=\s*['""']__NEXT_DATA__['""'][^>]*>(.*?)</script>",
            RegexOptions.Singleline | RegexOptions.IgnoreCase | RegexOptions.Compiled);

        private static readonly JsonSerializerOptions SerializerOptions = new() { PropertyNameCaseInsensitive = true };

        public static MatchRffm? Parse(string html)
        {
            if (string.IsNullOrWhiteSpace(html)) return null;

            var actaJsonElement = ExtractFromNextData(html) ?? ExtractFromRawJson(html);
            if (!actaJsonElement.HasValue) return null;

            try
            {
                return JsonSerializer.Deserialize<MatchRffm>(actaJsonElement.Value.GetRawText(), SerializerOptions);
            }
            catch (JsonException)
            {
                return null;
            }
        }

        private static JsonElement? ExtractFromNextData(string html)
        {
            var jsonText = FindNextDataJson(html);
            if (string.IsNullOrWhiteSpace(jsonText) || !LooksLikeJson(jsonText)) return null;

            try
            {
                using var doc = JsonDocument.Parse(jsonText);
                if (!doc.RootElement.TryGetProperty("props", out var propsElem) ||
                    !propsElem.TryGetProperty("pageProps", out var pagePropsElem))
                    return null;

                if (pagePropsElem.TryGetProperty("acta", out var actaElem)) return actaElem.Clone();
                if (pagePropsElem.TryGetProperty("acta_json", out var actaElem2)) return actaElem2.Clone();
                if (pagePropsElem.TryGetProperty("game", out var gameElem)) return gameElem.Clone();
                return null;
            }
            catch (JsonException)
            {
                return null;
            }
        }

        private static string? FindNextDataJson(string html)
        {
            var match = NextDataRegex.Match(html);
            if (match.Success) return match.Groups[1].Value.Trim();

            var pos = html.IndexOf("__NEXT_DATA__", StringComparison.OrdinalIgnoreCase);
            if (pos < 0) return null;
            var scriptOpen = html.LastIndexOf("<script", pos, StringComparison.OrdinalIgnoreCase);
            if (scriptOpen < 0) return null;
            var startTagEnd = html.IndexOf('>', scriptOpen);
            if (startTagEnd < 0) return null;
            var scriptClose = html.IndexOf("</script>", startTagEnd, StringComparison.OrdinalIgnoreCase);
            if (scriptClose <= startTagEnd) return null;
            return html.Substring(startTagEnd + 1, scriptClose - startTagEnd - 1).Trim();
        }

        private static JsonElement? ExtractFromRawJson(string html)
        {
            if (!LooksLikeJson(html)) return null;

            try
            {
                using var doc = JsonDocument.Parse(html);
                var root = doc.RootElement;
                if (root.ValueKind != JsonValueKind.Object) return root.Clone();
                if (root.TryGetProperty("acta", out var acta)) return acta.Clone();
                if (root.TryGetProperty("acta_json", out var actaJson)) return actaJson.Clone();
                if (root.TryGetProperty("game", out var game)) return game.Clone();
                return root.Clone();
            }
            catch (JsonException)
            {
                return null;
            }
        }

        private static bool LooksLikeJson(string text)
        {
            var trimmed = text.TrimStart();
            return trimmed.StartsWith('{') || trimmed.StartsWith('[');
        }
    }
}
