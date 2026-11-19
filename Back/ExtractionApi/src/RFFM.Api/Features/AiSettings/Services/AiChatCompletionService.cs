using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.AiSettings.Services
{
    public sealed class AiChatCompletionService : IAiChatCompletionService
    {
        private readonly AppDbContext _db;
        private readonly IAiApiKeyProtector _protector;
        private readonly IAiBaseUrlGuard _urlGuard;
        private readonly IReadOnlyCollection<IAiChatAdapter> _adapters;

        public AiChatCompletionService(
            AppDbContext db,
            IAiApiKeyProtector protector,
            IAiBaseUrlGuard urlGuard,
            IEnumerable<IAiChatAdapter> adapters)
        {
            _db = db;
            _protector = protector;
            _urlGuard = urlGuard;
            _adapters = adapters.ToArray();
        }

        public async Task<AiChatResult> CompleteAsync(string userId, AiChatRequest request, CancellationToken cancellationToken)
        {
            var provider = await _db.AiProviderSettings
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.UserId == userId && p.IsActive, cancellationToken);

            if (provider is null)
                return AiChatResult.Failed(AiChatFailure.NoActiveProvider);

            string apiKey;
            try
            {
                apiKey = _protector.Unprotect(provider.EncryptedApiKey);
            }
            catch (CryptographicException)
            {
                return AiChatResult.Failed(AiChatFailure.InvalidKey);
            }

            var credentials = new AiProviderCredentials(provider.Type, provider.BaseUrl, apiKey, provider.Model);
            return await CompleteAsync(credentials, request, cancellationToken);
        }

        public async Task<AiChatResult> CompleteAsync(
            AiProviderCredentials credentials, AiChatRequest request, CancellationToken cancellationToken)
        {
            var verdict = await _urlGuard.CheckAsync(credentials.BaseUrl, cancellationToken);
            if (verdict == AiBaseUrlVerdict.Unresolvable)
                return AiChatResult.Failed(AiChatFailure.Unreachable);
            if (verdict != AiBaseUrlVerdict.Allowed)
                return AiChatResult.Failed(AiChatFailure.InvalidBaseUrl);

            var adapter = _adapters.First(a => a.Type == credentials.Type);
            return await adapter.CompleteAsync(credentials, request, cancellationToken);
        }
    }
}
