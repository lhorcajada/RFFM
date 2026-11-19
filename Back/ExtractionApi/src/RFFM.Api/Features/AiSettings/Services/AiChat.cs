using RFFM.Api.Domain.Entities.AiProviders;

namespace RFFM.Api.Features.AiSettings.Services
{
    public static class AiChatRoles
    {
        public const string System = "system";
        public const string User = "user";
        public const string Assistant = "assistant";
    }

    public record AiChatMessage(string Role, string Content);

    public record AiChatRequest(IReadOnlyList<AiChatMessage> Messages, int? MaxTokens = null, string? ResponseSchema = null);

    public enum AiChatFailure
    {
        NoActiveProvider,
        InvalidBaseUrl,
        InvalidKey,
        Unreachable,
        UnknownModel,
        QuotaExceeded,
        Timeout,
        ProviderError
    }

    public record AiChatResult(string? Content, AiChatFailure? Failure)
    {
        public bool Succeeded => Failure is null;

        public static AiChatResult Success(string content) => new(content, null);

        public static AiChatResult Failed(AiChatFailure failure) => new(null, failure);
    }

    /// <summary>Provider call settings. A class (not a record) so the API key never shows up in ToString output.</summary>
    public sealed class AiProviderCredentials
    {
        public AiProviderCredentials(AiProviderType type, string baseUrl, string apiKey, string model)
        {
            Type = type;
            BaseUrl = baseUrl;
            ApiKey = apiKey;
            Model = model;
        }

        public AiProviderType Type { get; }
        public string BaseUrl { get; }
        public string ApiKey { get; }
        public string Model { get; }
    }

    /// <summary>
    /// Single entry point for AI features: callers send messages and never know which provider answers.
    /// </summary>
    public interface IAiChatCompletionService
    {
        /// <summary>Completes a chat with the user's active provider.</summary>
        Task<AiChatResult> CompleteAsync(string userId, AiChatRequest request, CancellationToken cancellationToken);

        /// <summary>Completes a chat with explicit credentials (used by the connection test).</summary>
        Task<AiChatResult> CompleteAsync(AiProviderCredentials credentials, AiChatRequest request, CancellationToken cancellationToken);
    }

    public interface IAiChatAdapter
    {
        AiProviderType Type { get; }

        bool SupportsForcedJsonSchema { get; }

        Task<AiChatResult> CompleteAsync(AiProviderCredentials credentials, AiChatRequest request, CancellationToken cancellationToken);
    }

    public static class AiChatFailureMessages
    {
        public static string For(AiChatFailure failure) => failure switch
        {
            AiChatFailure.NoActiveProvider => "No tienes ningún proveedor de IA activo.",
            AiChatFailure.InvalidBaseUrl => "La URL base debe ser https y no puede apuntar a una dirección privada, local o de enlace local.",
            AiChatFailure.InvalidKey => "La clave de API no es válida.",
            AiChatFailure.Unreachable => "No se pudo contactar con la URL indicada.",
            AiChatFailure.UnknownModel => "El modelo indicado no existe en el proveedor.",
            AiChatFailure.QuotaExceeded => "Se ha superado la cuota o el límite de peticiones del proveedor.",
            AiChatFailure.Timeout => "El proveedor tardó demasiado en responder.",
            _ => "El proveedor devolvió una respuesta inesperada."
        };
    }
}
