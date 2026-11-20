using RFFM.Api.Domain.Entities.AiProviders;

namespace RFFM.Api.Features.AiSettings.Services
{
    /// <summary>Chooses which of the models a provider reports are offered to the user for chat.</summary>
    public static class AiModelCatalog
    {
        private const string ModelPrefix = "models/";

        private static readonly string[] NonChatMarkers =
        [
            "embed", "tts", "image", "imagen", "whisper", "dall-e", "moderation", "audio", "transcribe", "realtime", "live"
        ];

        /// <summary>
        /// Drops embedding, image, audio and moderation models. For Gemini only the flash family is kept,
        /// the one available on its free tier; any other model can still be typed by hand.
        /// </summary>
        public static IReadOnlyList<string> Select(string template, IEnumerable<string> ids)
        {
            var models = ids
                .Select(id => id.StartsWith(ModelPrefix, StringComparison.OrdinalIgnoreCase) ? id[ModelPrefix.Length..] : id)
                .Where(id => !NonChatMarkers.Any(marker => id.Contains(marker, StringComparison.OrdinalIgnoreCase)));

            if (template == AiProviderTemplates.Gemini)
                models = models.Where(id => id.Contains("flash", StringComparison.OrdinalIgnoreCase));

            return models.Distinct(StringComparer.Ordinal).OrderBy(id => id, StringComparer.Ordinal).ToList();
        }
    }

    public sealed class AiModelCatalogService : IAiModelCatalogService
    {
        private readonly IAiBaseUrlGuard _urlGuard;
        private readonly IReadOnlyCollection<IAiChatAdapter> _adapters;

        public AiModelCatalogService(IAiBaseUrlGuard urlGuard, IEnumerable<IAiChatAdapter> adapters)
        {
            _urlGuard = urlGuard;
            _adapters = adapters.ToArray();
        }

        public async Task<AiModelListResult> ListAsync(string template, AiProviderCredentials credentials, CancellationToken cancellationToken)
        {
            var verdict = await _urlGuard.CheckAsync(credentials.BaseUrl, cancellationToken);
            if (verdict == AiBaseUrlVerdict.Unresolvable)
                return AiModelListResult.Failed(AiChatFailure.Unreachable);
            if (verdict != AiBaseUrlVerdict.Allowed)
                return AiModelListResult.Failed(AiChatFailure.InvalidBaseUrl);

            var adapter = _adapters.First(a => a.Type == credentials.Type);
            var result = await adapter.ListModelsAsync(credentials, cancellationToken);

            return result.Models is null
                ? result
                : AiModelListResult.Success(AiModelCatalog.Select(template, result.Models));
        }
    }
}
