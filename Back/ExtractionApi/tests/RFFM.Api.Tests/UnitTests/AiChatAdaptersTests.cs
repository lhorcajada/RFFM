#nullable enable
using System.Net;
using System.Text;
using System.Text.Json;
using RFFM.Api.Domain.Entities.AiProviders;
using RFFM.Api.Features.AiSettings.Services;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class AiChatAdaptersTests
    {
        private const string SecretKey = "sk-test-secret-1234";

        private sealed class StubHandler : HttpMessageHandler
        {
            private readonly Func<HttpRequestMessage, Task<HttpResponseMessage>> _respond;

            public StubHandler(Func<HttpRequestMessage, Task<HttpResponseMessage>> respond) => _respond = respond;

            public HttpRequestMessage? LastRequest { get; private set; }
            public string? LastBody { get; private set; }

            protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            {
                LastRequest = request;
                LastBody = request.Content is null ? null : await request.Content.ReadAsStringAsync(cancellationToken);
                return await _respond(request);
            }
        }

        private static StubHandler Responding(HttpStatusCode status, string body) =>
            new(_ => Task.FromResult(new HttpResponseMessage(status)
            {
                Content = new StringContent(body, Encoding.UTF8, "application/json")
            }));

        private static AiChatRequest SampleRequest(int? maxTokens = null) => new(
            [new AiChatMessage(AiChatRoles.System, "Eres un asistente."), new AiChatMessage(AiChatRoles.User, "Hola")],
            maxTokens);

        private static AiProviderCredentials OpenAiCredentials(string baseUrl = "https://api.openai.com/v1") =>
            new(AiProviderType.OpenAiCompatible, baseUrl, SecretKey, "gpt-4o-mini");

        private static AiProviderCredentials ClaudeCredentials(string baseUrl = "https://api.anthropic.com") =>
            new(AiProviderType.Claude, baseUrl, SecretKey, "claude-sonnet-4-5");

        [Fact]
        public async Task OpenAiCompatible_SendsBearerKeyAndChatCompletionsBody()
        {
            var handler = Responding(HttpStatusCode.OK, """{"choices":[{"message":{"role":"assistant","content":"OK"}}]}""");
            var adapter = new OpenAiCompatibleChatAdapter(new HttpClient(handler));

            var result = await adapter.CompleteAsync(OpenAiCredentials("https://api.openai.com/v1/"), SampleRequest(), CancellationToken.None);

            Assert.Equal("https://api.openai.com/v1/chat/completions", handler.LastRequest!.RequestUri!.ToString());
            Assert.Equal("Bearer", handler.LastRequest.Headers.Authorization!.Scheme);
            Assert.Equal(SecretKey, handler.LastRequest.Headers.Authorization.Parameter);
            using var body = JsonDocument.Parse(handler.LastBody!);
            Assert.Equal("gpt-4o-mini", body.RootElement.GetProperty("model").GetString());
            Assert.Equal(2, body.RootElement.GetProperty("messages").GetArrayLength());
            Assert.False(body.RootElement.TryGetProperty("max_tokens", out _));
            Assert.True(result.Succeeded);
            Assert.Equal("OK", result.Content);
        }

        [Fact]
        public async Task OpenAiCompatible_WithMaxTokens_SendsThem()
        {
            var handler = Responding(HttpStatusCode.OK, """{"choices":[{"message":{"content":"OK"}}]}""");
            var adapter = new OpenAiCompatibleChatAdapter(new HttpClient(handler));

            await adapter.CompleteAsync(OpenAiCredentials(), SampleRequest(maxTokens: 50), CancellationToken.None);

            using var body = JsonDocument.Parse(handler.LastBody!);
            Assert.Equal(50, body.RootElement.GetProperty("max_tokens").GetInt32());
        }

        [Theory]
        [InlineData("""{"choices":[]}""")]
        [InlineData("""{"unexpected":true}""")]
        [InlineData("not json")]
        [InlineData("[]")]
        public async Task OpenAiCompatible_UnexpectedSuccessBody_IsAProviderError(string body)
        {
            var adapter = new OpenAiCompatibleChatAdapter(new HttpClient(Responding(HttpStatusCode.OK, body)));

            var result = await adapter.CompleteAsync(OpenAiCredentials(), SampleRequest(), CancellationToken.None);

            Assert.Equal(AiChatFailure.ProviderError, result.Failure);
        }

        [Theory]
        [InlineData(HttpStatusCode.Unauthorized, "{}", AiChatFailure.InvalidKey)]
        [InlineData(HttpStatusCode.Forbidden, "{}", AiChatFailure.InvalidKey)]
        [InlineData(HttpStatusCode.BadRequest, """{"error":{"message":"API key not valid. Please pass a valid API key."}}""", AiChatFailure.InvalidKey)]
        [InlineData(HttpStatusCode.TooManyRequests, """{"error":{"code":"insufficient_quota"}}""", AiChatFailure.QuotaExceeded)]
        [InlineData(HttpStatusCode.NotFound, """{"error":{"code":"model_not_found"}}""", AiChatFailure.UnknownModel)]
        [InlineData(HttpStatusCode.NotFound, "<html>Not Found</html>", AiChatFailure.Unreachable)]
        [InlineData(HttpStatusCode.BadRequest, """{"error":{"message":"The model `x` does not exist"}}""", AiChatFailure.UnknownModel)]
        [InlineData(HttpStatusCode.GatewayTimeout, "{}", AiChatFailure.Timeout)]
        [InlineData(HttpStatusCode.MovedPermanently, "", AiChatFailure.Unreachable)]
        [InlineData(HttpStatusCode.InternalServerError, "{}", AiChatFailure.ProviderError)]
        public async Task ErrorStatus_IsClassified(HttpStatusCode status, string body, AiChatFailure expected)
        {
            var adapter = new OpenAiCompatibleChatAdapter(new HttpClient(Responding(status, body)));

            var result = await adapter.CompleteAsync(OpenAiCredentials(), SampleRequest(), CancellationToken.None);

            Assert.False(result.Succeeded);
            Assert.Equal(expected, result.Failure);
            Assert.Null(result.Content);
        }

        [Fact]
        public async Task ProviderBodyEchoingTheKey_NeverReachesTheResult()
        {
            var body = "{\"error\":{\"message\":\"Incorrect API key provided: " + SecretKey + "\"}}";
            var adapter = new OpenAiCompatibleChatAdapter(new HttpClient(Responding(HttpStatusCode.Unauthorized, body)));

            var result = await adapter.CompleteAsync(OpenAiCredentials(), SampleRequest(), CancellationToken.None);

            Assert.DoesNotContain(SecretKey, result.ToString());
            Assert.DoesNotContain(SecretKey, AiChatFailureMessages.For(result.Failure!.Value));
        }

        [Fact]
        public async Task ConnectionFailure_IsUnreachable()
        {
            var handler = new StubHandler(_ => throw new HttpRequestException("connection refused"));
            var adapter = new OpenAiCompatibleChatAdapter(new HttpClient(handler));

            var result = await adapter.CompleteAsync(OpenAiCredentials(), SampleRequest(), CancellationToken.None);

            Assert.Equal(AiChatFailure.Unreachable, result.Failure);
        }

        [Fact]
        public async Task ClientTimeout_IsTimeout()
        {
            var handler = new StubHandler(async _ =>
            {
                await Task.Delay(TimeSpan.FromSeconds(10));
                return new HttpResponseMessage(HttpStatusCode.OK);
            });
            var adapter = new OpenAiCompatibleChatAdapter(new HttpClient(handler) { Timeout = TimeSpan.FromMilliseconds(50) });

            var result = await adapter.CompleteAsync(OpenAiCredentials(), SampleRequest(), CancellationToken.None);

            Assert.Equal(AiChatFailure.Timeout, result.Failure);
        }

        [Fact]
        public async Task CallerCancellation_IsNotSwallowed()
        {
            using var cancellation = new CancellationTokenSource();
            var handler = new StubHandler(async _ =>
            {
                await Task.Delay(TimeSpan.FromSeconds(10), cancellation.Token);
                return new HttpResponseMessage(HttpStatusCode.OK);
            });
            var adapter = new OpenAiCompatibleChatAdapter(new HttpClient(handler));
            cancellation.CancelAfter(TimeSpan.FromMilliseconds(50));

            await Assert.ThrowsAnyAsync<OperationCanceledException>(
                () => adapter.CompleteAsync(OpenAiCredentials(), SampleRequest(), cancellation.Token));
        }

        [Fact]
        public async Task Claude_SendsApiKeyHeaderAndSplitsTheSystemMessage()
        {
            var handler = Responding(HttpStatusCode.OK, """{"content":[{"type":"text","text":"Hola "},{"type":"text","text":"mundo"}]}""");
            var adapter = new ClaudeChatAdapter(new HttpClient(handler));

            var result = await adapter.CompleteAsync(ClaudeCredentials(), SampleRequest(), CancellationToken.None);

            Assert.Equal("https://api.anthropic.com/v1/messages", handler.LastRequest!.RequestUri!.ToString());
            Assert.Equal(SecretKey, handler.LastRequest.Headers.GetValues("x-api-key").Single());
            Assert.Equal("2023-06-01", handler.LastRequest.Headers.GetValues("anthropic-version").Single());
            Assert.Null(handler.LastRequest.Headers.Authorization);
            using var body = JsonDocument.Parse(handler.LastBody!);
            Assert.Equal("Eres un asistente.", body.RootElement.GetProperty("system").GetString());
            Assert.Equal(1024, body.RootElement.GetProperty("max_tokens").GetInt32());
            var messages = body.RootElement.GetProperty("messages");
            Assert.Equal(1, messages.GetArrayLength());
            Assert.Equal("user", messages[0].GetProperty("role").GetString());
            Assert.Equal("Hola mundo", result.Content);
        }

        [Fact]
        public async Task Claude_BaseUrlEndingInV1_DoesNotRepeatTheVersionSegment()
        {
            var handler = Responding(HttpStatusCode.OK, """{"content":[{"type":"text","text":"OK"}]}""");
            var adapter = new ClaudeChatAdapter(new HttpClient(handler));

            await adapter.CompleteAsync(ClaudeCredentials("https://proxy.example.com/v1"), SampleRequest(), CancellationToken.None);

            Assert.Equal("https://proxy.example.com/v1/messages", handler.LastRequest!.RequestUri!.ToString());
        }

        [Fact]
        public async Task Claude_WithoutSystemMessage_OmitsTheSystemField()
        {
            var handler = Responding(HttpStatusCode.OK, """{"content":[{"type":"text","text":"OK"}]}""");
            var adapter = new ClaudeChatAdapter(new HttpClient(handler));
            var request = new AiChatRequest([new AiChatMessage(AiChatRoles.User, "Hola")]);

            await adapter.CompleteAsync(ClaudeCredentials(), request, CancellationToken.None);

            using var body = JsonDocument.Parse(handler.LastBody!);
            Assert.False(body.RootElement.TryGetProperty("system", out _));
        }

        [Theory]
        [InlineData(HttpStatusCode.Unauthorized, """{"type":"error","error":{"type":"authentication_error"}}""", AiChatFailure.InvalidKey)]
        [InlineData(HttpStatusCode.NotFound, """{"type":"error","error":{"type":"not_found_error","message":"model: claude-x"}}""", AiChatFailure.UnknownModel)]
        [InlineData(HttpStatusCode.TooManyRequests, """{"type":"error","error":{"type":"rate_limit_error"}}""", AiChatFailure.QuotaExceeded)]
        public async Task Claude_ErrorStatus_IsClassified(HttpStatusCode status, string body, AiChatFailure expected)
        {
            var adapter = new ClaudeChatAdapter(new HttpClient(Responding(status, body)));

            var result = await adapter.CompleteAsync(ClaudeCredentials(), SampleRequest(), CancellationToken.None);

            Assert.Equal(expected, result.Failure);
        }

        private const string SampleSchema = """{"type":"object","properties":{"kind":{"type":"string"}}}""";

        [Fact]
        public void OpenAiCompatible_DeclaresForcedJsonSchemaSupport()
        {
            var adapter = new OpenAiCompatibleChatAdapter(new HttpClient(Responding(HttpStatusCode.OK, "{}")));

            Assert.True(adapter.SupportsForcedJsonSchema);
        }

        [Fact]
        public async Task OpenAiCompatible_WithResponseSchema_SendsItAsResponseFormat()
        {
            var handler = Responding(HttpStatusCode.OK, """{"choices":[{"message":{"content":"OK"}}]}""");
            var adapter = new OpenAiCompatibleChatAdapter(new HttpClient(handler));
            var request = SampleRequest() with { ResponseSchema = SampleSchema };

            await adapter.CompleteAsync(OpenAiCredentials(), request, CancellationToken.None);

            using var body = JsonDocument.Parse(handler.LastBody!);
            Assert.True(body.RootElement.TryGetProperty("response_format", out var responseFormat));
            Assert.Equal("json_schema", responseFormat.GetProperty("type").GetString());
            Assert.True(responseFormat.GetProperty("json_schema").GetProperty("schema").TryGetProperty("properties", out var properties));
            Assert.True(properties.TryGetProperty("kind", out _));
        }

        [Fact]
        public async Task OpenAiCompatible_WithoutResponseSchema_OmitsResponseFormat()
        {
            var handler = Responding(HttpStatusCode.OK, """{"choices":[{"message":{"content":"OK"}}]}""");
            var adapter = new OpenAiCompatibleChatAdapter(new HttpClient(handler));

            await adapter.CompleteAsync(OpenAiCredentials(), SampleRequest(), CancellationToken.None);

            using var body = JsonDocument.Parse(handler.LastBody!);
            Assert.False(body.RootElement.TryGetProperty("response_format", out _));
        }

        [Fact]
        public async Task OpenAiCompatible_WhenServerRejectsTheSchemaWithBadRequest_RetriesOnceWithoutIt()
        {
            var bodies = new List<string?>();
            var handler = new StubHandler(request =>
            {
                var rejected = bodies.Count == 0;
                bodies.Add(null);
                return Task.FromResult(new HttpResponseMessage(rejected ? HttpStatusCode.BadRequest : HttpStatusCode.OK)
                {
                    Content = new StringContent(
                        rejected ? """{"error":{"message":"response_format is not supported"}}""" : """{"choices":[{"message":{"content":"OK"}}]}""",
                        Encoding.UTF8, "application/json")
                });
            });
            var adapter = new OpenAiCompatibleChatAdapter(new HttpClient(handler));

            var result = await adapter.CompleteAsync(OpenAiCredentials(), SampleRequest() with { ResponseSchema = SampleSchema }, CancellationToken.None);

            Assert.True(result.Succeeded);
            Assert.Equal("OK", result.Content);
            Assert.Equal(2, bodies.Count);
            using var retryBody = JsonDocument.Parse(handler.LastBody!);
            Assert.False(retryBody.RootElement.TryGetProperty("response_format", out _));
        }

        [Fact]
        public async Task OpenAiCompatible_WhenTheRetryWithoutSchemaAlsoFails_ReturnsThatFailureAfterTwoCalls()
        {
            var calls = 0;
            var handler = new StubHandler(_ =>
            {
                calls++;
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.BadRequest)
                {
                    Content = new StringContent("""{"error":{"message":"invalid api key"}}""", Encoding.UTF8, "application/json")
                });
            });
            var adapter = new OpenAiCompatibleChatAdapter(new HttpClient(handler));

            var result = await adapter.CompleteAsync(OpenAiCredentials(), SampleRequest() with { ResponseSchema = SampleSchema }, CancellationToken.None);

            Assert.False(result.Succeeded);
            Assert.Equal(AiChatFailure.InvalidKey, result.Failure);
            Assert.Equal(2, calls);
        }

        [Fact]
        public async Task OpenAiCompatible_BadRequestWithoutSchema_IsNotRetried()
        {
            var calls = 0;
            var handler = new StubHandler(_ =>
            {
                calls++;
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.BadRequest)
                {
                    Content = new StringContent("""{"error":{"message":"bad"}}""", Encoding.UTF8, "application/json")
                });
            });
            var adapter = new OpenAiCompatibleChatAdapter(new HttpClient(handler));

            var result = await adapter.CompleteAsync(OpenAiCredentials(), SampleRequest(), CancellationToken.None);

            Assert.False(result.Succeeded);
            Assert.Equal(1, calls);
        }

        [Fact]
        public void Claude_DoesNotDeclareForcedJsonSchemaSupport()
        {
            var adapter = new ClaudeChatAdapter(new HttpClient(Responding(HttpStatusCode.OK, "{}")));

            Assert.False(adapter.SupportsForcedJsonSchema);
        }

        [Fact]
        public async Task Claude_BodyIsIdenticalWithOrWithoutResponseSchema()
        {
            var plainHandler = Responding(HttpStatusCode.OK, """{"content":[{"type":"text","text":"OK"}]}""");
            var schemaHandler = Responding(HttpStatusCode.OK, """{"content":[{"type":"text","text":"OK"}]}""");

            await new ClaudeChatAdapter(new HttpClient(plainHandler))
                .CompleteAsync(ClaudeCredentials(), SampleRequest(), CancellationToken.None);
            await new ClaudeChatAdapter(new HttpClient(schemaHandler))
                .CompleteAsync(ClaudeCredentials(), SampleRequest() with { ResponseSchema = SampleSchema }, CancellationToken.None);

            Assert.Equal(plainHandler.LastBody, schemaHandler.LastBody);
            using var body = JsonDocument.Parse(schemaHandler.LastBody!);
            Assert.False(body.RootElement.TryGetProperty("response_format", out _));
        }

        [Fact]
        public async Task OpenAiCompatible_WithMaxTokens4096_SendsThemInTheBody()
        {
            var handler = Responding(HttpStatusCode.OK, """{"choices":[{"message":{"content":"OK"}}]}""");
            var adapter = new OpenAiCompatibleChatAdapter(new HttpClient(handler));

            await adapter.CompleteAsync(OpenAiCredentials(), SampleRequest(maxTokens: 4096), CancellationToken.None);

            using var body = JsonDocument.Parse(handler.LastBody!);
            Assert.Equal(4096, body.RootElement.GetProperty("max_tokens").GetInt32());
        }

        [Fact]
        public async Task Claude_WithMaxTokens4096_SendsThemInTheBody()
        {
            var handler = Responding(HttpStatusCode.OK, """{"content":[{"type":"text","text":"OK"}]}""");
            var adapter = new ClaudeChatAdapter(new HttpClient(handler));

            await adapter.CompleteAsync(ClaudeCredentials(), SampleRequest(maxTokens: 4096), CancellationToken.None);

            using var body = JsonDocument.Parse(handler.LastBody!);
            Assert.Equal(4096, body.RootElement.GetProperty("max_tokens").GetInt32());
        }

        [Fact]
        public void Credentials_ToString_DoesNotExposeTheKey()
        {
            Assert.DoesNotContain(SecretKey, OpenAiCredentials().ToString());
        }
    }
}
