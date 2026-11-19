using System.Net;
using System.Net.Http.Headers;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using RFFM.Api.Domain.Entities.AiProviders;

namespace RFFM.Api.Features.AiSettings.Services
{
    /// <summary>
    /// Sends one chat request and classifies the outcome. The provider response body is never
    /// copied into a result, so a key echoed back by a provider cannot reach logs or messages.
    /// </summary>
    public abstract class AiChatAdapterBase : IAiChatAdapter
    {
        private static readonly JsonSerializerOptions RequestJson = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        };

        private readonly HttpClient _http;

        protected AiChatAdapterBase(HttpClient http) => _http = http;

        public abstract AiProviderType Type { get; }

        public virtual bool SupportsForcedJsonSchema => false;

        public async Task<AiChatResult> CompleteAsync(
            AiProviderCredentials credentials, AiChatRequest request, CancellationToken cancellationToken)
        {
            try
            {
                using var message = BuildRequest(credentials, request);
                using var response = await _http.SendAsync(message, cancellationToken);
                var body = await response.Content.ReadAsStringAsync(cancellationToken);

                if (!response.IsSuccessStatusCode)
                    return AiChatResult.Failed(Classify(response.StatusCode, body));

                var content = ExtractContent(body);
                return content is null
                    ? AiChatResult.Failed(AiChatFailure.ProviderError)
                    : AiChatResult.Success(content);
            }
            catch (UriFormatException)
            {
                return AiChatResult.Failed(AiChatFailure.InvalidBaseUrl);
            }
            catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
            {
                return AiChatResult.Failed(AiChatFailure.Timeout);
            }
            catch (HttpRequestException)
            {
                return AiChatResult.Failed(AiChatFailure.Unreachable);
            }
        }

        protected abstract HttpRequestMessage BuildRequest(AiProviderCredentials credentials, AiChatRequest request);

        protected abstract string? ExtractContent(string responseBody);

        protected static StringContent JsonBody(object payload) =>
            new(JsonSerializer.Serialize(payload, RequestJson), Encoding.UTF8, "application/json");

        protected static string Endpoint(string baseUrl, string path) => $"{baseUrl.TrimEnd('/')}{path}";

        internal static AiChatFailure Classify(HttpStatusCode status, string body)
        {
            var code = (int)status;
            if (code is >= 300 and < 400)
                return AiChatFailure.Unreachable;

            return status switch
            {
                HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden => AiChatFailure.InvalidKey,
                HttpStatusCode.TooManyRequests => AiChatFailure.QuotaExceeded,
                HttpStatusCode.RequestTimeout or HttpStatusCode.GatewayTimeout => AiChatFailure.Timeout,
                HttpStatusCode.NotFound => Mentions(body, "model") ? AiChatFailure.UnknownModel : AiChatFailure.Unreachable,
                HttpStatusCode.BadRequest when Mentions(body, "api key") || Mentions(body, "api_key") => AiChatFailure.InvalidKey,
                HttpStatusCode.BadRequest when Mentions(body, "model") => AiChatFailure.UnknownModel,
                _ => AiChatFailure.ProviderError
            };
        }

        private static bool Mentions(string body, string text) =>
            body.Contains(text, StringComparison.OrdinalIgnoreCase);

        protected static string? TryGetString(JsonElement element, params string[] path)
        {
            foreach (var segment in path)
            {
                if (element.ValueKind != JsonValueKind.Object || !element.TryGetProperty(segment, out element))
                    return null;
            }

            return element.ValueKind == JsonValueKind.String ? element.GetString() : null;
        }
    }

    /// <summary>OpenAI chat-completions protocol, shared by OpenAI, Gemini, Groq, OpenRouter and similar providers.</summary>
    public sealed class OpenAiCompatibleChatAdapter : AiChatAdapterBase
    {
        private const string StructuredReplyName = "structured_reply";

        public OpenAiCompatibleChatAdapter(HttpClient http) : base(http) { }

        public override AiProviderType Type => AiProviderType.OpenAiCompatible;

        public override bool SupportsForcedJsonSchema => true;

        protected override HttpRequestMessage BuildRequest(AiProviderCredentials credentials, AiChatRequest request)
        {
            var message = new HttpRequestMessage(HttpMethod.Post, Endpoint(credentials.BaseUrl, "/chat/completions"))
            {
                Content = JsonBody(new
                {
                    Model = credentials.Model,
                    Messages = request.Messages.Select(m => new { m.Role, m.Content }),
                    request.MaxTokens,
                    ResponseFormat = ResponseFormatFor(request.ResponseSchema)
                })
            };
            message.Headers.Authorization = new AuthenticationHeaderValue("Bearer", credentials.ApiKey);
            return message;
        }

        // The schema is embedded as a JSON object, not a string; non-strict mode accepts the schema's optional members.
        private static object? ResponseFormatFor(string? responseSchema) =>
            responseSchema is null
                ? null
                : new
                {
                    Type = "json_schema",
                    JsonSchema = new { Name = StructuredReplyName, Schema = JsonSerializer.Deserialize<JsonElement>(responseSchema) }
                };

        protected override string? ExtractContent(string responseBody)
        {
            try
            {
                using var document = JsonDocument.Parse(responseBody);
                var choices = document.RootElement.TryGetProperty("choices", out var found) ? found : default;
                if (choices.ValueKind != JsonValueKind.Array || choices.GetArrayLength() == 0)
                    return null;

                return TryGetString(choices[0], "message", "content");
            }
            catch (Exception ex) when (ex is JsonException or InvalidOperationException)
            {
                return null;
            }
        }
    }

    /// <summary>Native Anthropic Messages API.</summary>
    public sealed class ClaudeChatAdapter : AiChatAdapterBase
    {
        private const string AnthropicVersion = "2023-06-01";
        private const int DefaultMaxTokens = 1024;

        public ClaudeChatAdapter(HttpClient http) : base(http) { }

        public override AiProviderType Type => AiProviderType.Claude;

        protected override HttpRequestMessage BuildRequest(AiProviderCredentials credentials, AiChatRequest request)
        {
            var system = string.Join("\n\n", request.Messages.Where(m => m.Role == AiChatRoles.System).Select(m => m.Content));
            var path = credentials.BaseUrl.TrimEnd('/').EndsWith("/v1", StringComparison.OrdinalIgnoreCase)
                ? "/messages"
                : "/v1/messages";

            var message = new HttpRequestMessage(HttpMethod.Post, Endpoint(credentials.BaseUrl, path))
            {
                Content = JsonBody(new
                {
                    Model = credentials.Model,
                    MaxTokens = request.MaxTokens ?? DefaultMaxTokens,
                    System = system.Length > 0 ? system : null,
                    Messages = request.Messages
                        .Where(m => m.Role != AiChatRoles.System)
                        .Select(m => new { m.Role, m.Content })
                })
            };
            message.Headers.Add("x-api-key", credentials.ApiKey);
            message.Headers.Add("anthropic-version", AnthropicVersion);
            return message;
        }

        protected override string? ExtractContent(string responseBody)
        {
            try
            {
                using var document = JsonDocument.Parse(responseBody);
                if (!document.RootElement.TryGetProperty("content", out var blocks) || blocks.ValueKind != JsonValueKind.Array)
                    return null;

                var text = string.Concat(blocks.EnumerateArray()
                    .Where(b => TryGetString(b, "type") == "text")
                    .Select(b => TryGetString(b, "text")));
                return text.Length > 0 ? text : null;
            }
            catch (Exception ex) when (ex is JsonException or InvalidOperationException)
            {
                return null;
            }
        }
    }

    public static class AiHttpHandlerFactory
    {
        /// <summary>
        /// No redirects, and the destination address is checked at connect time so a DNS answer
        /// that changes after validation cannot reach a private network.
        /// </summary>
        public static SocketsHttpHandler Create() => new()
        {
            AllowAutoRedirect = false,
            ConnectCallback = ConnectToPublicAddressAsync
        };

        private static async ValueTask<Stream> ConnectToPublicAddressAsync(
            SocketsHttpConnectionContext context, CancellationToken cancellationToken)
        {
            var addresses = await Dns.GetHostAddressesAsync(context.DnsEndPoint.Host, cancellationToken);
            if (addresses.Length == 0 || addresses.Any(AiBaseUrlGuard.IsForbiddenAddress))
                throw new HttpRequestException("The destination address is not allowed.");

            var socket = new Socket(SocketType.Stream, ProtocolType.Tcp) { NoDelay = true };
            try
            {
                await socket.ConnectAsync(addresses, context.DnsEndPoint.Port, cancellationToken);
                return new NetworkStream(socket, ownsSocket: true);
            }
            catch
            {
                socket.Dispose();
                throw;
            }
        }
    }
}
