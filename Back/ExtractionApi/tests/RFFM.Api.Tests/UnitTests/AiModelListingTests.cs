#nullable enable
using System.Net;
using System.Text;
using RFFM.Api.Domain.Entities.AiProviders;
using RFFM.Api.Features.AiSettings;
using RFFM.Api.Features.AiSettings.Services;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class AiModelListingTests
    {
        private const string SecretKey = "sk-test-secret-1234";

        private sealed class StubHandler : HttpMessageHandler
        {
            private readonly HttpStatusCode _status;
            private readonly string _body;

            public StubHandler(HttpStatusCode status, string body)
            {
                _status = status;
                _body = body;
            }

            public HttpRequestMessage? LastRequest { get; private set; }

            protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            {
                LastRequest = request;
                return Task.FromResult(new HttpResponseMessage(_status) { Content = new StringContent(_body, Encoding.UTF8, "application/json") });
            }
        }

        private static AiProviderCredentials Credentials(AiProviderType type, string baseUrl) => new(type, baseUrl, SecretKey, string.Empty);

        [Fact]
        public async Task OpenAiCompatible_ListsModelIdsWithGetAndBearerKey()
        {
            var handler = new StubHandler(HttpStatusCode.OK, """{"data":[{"id":"models/gemini-2.5-flash"},{"id":"models/gemini-2.5-pro"}]}""");
            var adapter = new OpenAiCompatibleChatAdapter(new HttpClient(handler));

            var result = await adapter.ListModelsAsync(
                Credentials(AiProviderType.OpenAiCompatible, "https://generativelanguage.googleapis.com/v1beta/openai/"), CancellationToken.None);

            Assert.Equal(HttpMethod.Get, handler.LastRequest!.Method);
            Assert.Equal("https://generativelanguage.googleapis.com/v1beta/openai/models", handler.LastRequest.RequestUri!.ToString());
            Assert.Equal(SecretKey, handler.LastRequest.Headers.Authorization!.Parameter);
            Assert.Equal(["models/gemini-2.5-flash", "models/gemini-2.5-pro"], result.Models);
        }

        [Fact]
        public async Task Claude_ListsModelIdsFromV1ModelsWithApiKeyHeader()
        {
            var handler = new StubHandler(HttpStatusCode.OK, """{"data":[{"id":"claude-sonnet-4-5","display_name":"Claude Sonnet 4.5"}]}""");
            var adapter = new ClaudeChatAdapter(new HttpClient(handler));

            var result = await adapter.ListModelsAsync(Credentials(AiProviderType.Claude, "https://api.anthropic.com"), CancellationToken.None);

            Assert.Equal("https://api.anthropic.com/v1/models", handler.LastRequest!.RequestUri!.ToString());
            Assert.Equal(SecretKey, handler.LastRequest.Headers.GetValues("x-api-key").Single());
            Assert.Equal(["claude-sonnet-4-5"], result.Models);
        }

        [Theory]
        [InlineData(HttpStatusCode.Unauthorized, AiChatFailure.InvalidKey)]
        [InlineData(HttpStatusCode.TooManyRequests, AiChatFailure.QuotaExceeded)]
        [InlineData(HttpStatusCode.InternalServerError, AiChatFailure.ProviderError)]
        public async Task ListModels_ClassifiesProviderFailures(HttpStatusCode status, AiChatFailure expected)
        {
            var adapter = new OpenAiCompatibleChatAdapter(new HttpClient(new StubHandler(status, """{"error":{"message":"nope"}}""")));

            var result = await adapter.ListModelsAsync(Credentials(AiProviderType.OpenAiCompatible, "https://api.openai.com/v1"), CancellationToken.None);

            Assert.Equal(expected, result.Failure);
            Assert.Null(result.Models);
        }

        [Fact]
        public async Task ListModels_WithUnexpectedBody_FailsAsProviderError()
        {
            var adapter = new OpenAiCompatibleChatAdapter(new HttpClient(new StubHandler(HttpStatusCode.OK, "<html>no</html>")));

            var result = await adapter.ListModelsAsync(Credentials(AiProviderType.OpenAiCompatible, "https://api.openai.com/v1"), CancellationToken.None);

            Assert.Equal(AiChatFailure.ProviderError, result.Failure);
        }

        [Fact]
        public void Select_ForGemini_KeepsOnlyFlashChatModelsWithoutPrefix()
        {
            var ids = new[]
            {
                "models/gemini-2.5-pro", "models/gemini-2.5-flash", "models/gemini-2.0-flash-lite",
                "models/text-embedding-004", "models/gemini-2.5-flash-preview-tts", "models/gemini-2.5-flash", "models/imagen-3.0-generate-002"
            };

            var selected = AiModelCatalog.Select(AiProviderTemplates.Gemini, ids);

            Assert.Equal(["gemini-2.0-flash-lite", "gemini-2.5-flash"], selected);
        }

        [Fact]
        public void Select_ForOtherTemplates_RemovesNonChatModelsAndSorts()
        {
            var ids = new[] { "text-embedding-3-small", "gpt-4o-mini", "whisper-1", "dall-e-3", "gpt-4o", "omni-moderation-latest" };

            var selected = AiModelCatalog.Select(AiProviderTemplates.OpenAi, ids);

            Assert.Equal(["gpt-4o", "gpt-4o-mini"], selected);
        }

        [Fact]
        public void ListModelsValidator_RequiresKeyOnlyWithoutStoredProvider()
        {
            var validator = new ListAiProviderModels.Validator();

            var withoutKey = validator.Validate(new ListAiProviderModels.ListAiProviderModelsCommand(null, AiProviderTemplates.Gemini, "https://x.test/v1", null));
            var storedKey = validator.Validate(new ListAiProviderModels.ListAiProviderModelsCommand("abc", AiProviderTemplates.Gemini, "https://x.test/v1", null));

            Assert.False(withoutKey.IsValid);
            Assert.True(storedKey.IsValid);
        }
    }
}
