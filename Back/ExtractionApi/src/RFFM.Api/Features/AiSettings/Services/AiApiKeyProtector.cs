using Microsoft.AspNetCore.DataProtection;
using RFFM.Api.Domain.Entities.AiProviders;

namespace RFFM.Api.Features.AiSettings.Services
{
    public interface IAiApiKeyProtector
    {
        string Protect(string apiKey);

        /// <exception cref="System.Security.Cryptography.CryptographicException">The stored key can no longer be decrypted.</exception>
        string Unprotect(string protectedApiKey);
    }

    public sealed class AiApiKeyProtector : IAiApiKeyProtector
    {
        private readonly IDataProtector _protector;

        public AiApiKeyProtector(IDataProtectionProvider provider)
        {
            _protector = provider.CreateProtector("RFFM.AiProviders.ApiKey");
        }

        public string Protect(string apiKey) => _protector.Protect(apiKey);

        public string Unprotect(string protectedApiKey) => _protector.Unprotect(protectedApiKey);
    }

    public static class AiApiKeyMask
    {
        public static string Tail(string apiKey) =>
            apiKey.Length <= AiProviderSetting.Rules.ApiKeyTailLength
                ? apiKey
                : apiKey[^AiProviderSetting.Rules.ApiKeyTailLength..];

        public static string Mask(string tail) => $"****{tail}";
    }
}
