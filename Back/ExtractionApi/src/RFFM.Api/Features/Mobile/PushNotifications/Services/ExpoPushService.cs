using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;

namespace RFFM.Api.Features.Mobile.PushNotifications.Services
{
    public interface IExpoPushService
    {
        /// <summary>
        /// Sends push messages to the Expo Push API in batches of up to 100 (Expo's limit).
        /// Returns the `To` tokens Expo reported as permanently dead (`DeviceNotRegistered`) so
        /// the caller can prune them. Never throws: transport failures, non-2xx responses and
        /// malformed payloads are logged and treated as "nothing to prune" — a delivery failure
        /// is not the same as a confirmed-dead token.
        /// </summary>
        Task<IReadOnlyCollection<string>> SendAsync(IReadOnlyCollection<ExpoPushMessage> messages, CancellationToken ct = default);
    }

    public record ExpoPushMessage(string To, string Title, string Body, IDictionary<string, object> Data);

    public class ExpoPushService : IExpoPushService
    {
        private const int BatchSize = 100;
        private const string SendPath = "--/api/v2/push/send";

        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<ExpoPushService>? _logger;

        public ExpoPushService(IHttpClientFactory httpClientFactory, ILogger<ExpoPushService>? logger = null)
        {
            _httpClientFactory = httpClientFactory;
            _logger = logger;
        }

        public async Task<IReadOnlyCollection<string>> SendAsync(IReadOnlyCollection<ExpoPushMessage> messages, CancellationToken ct = default)
        {
            if (messages.Count == 0)
                return Array.Empty<string>();

            var prunedTokens = new List<string>();
            var client = _httpClientFactory.CreateClient("ExpoPush");

            foreach (var batch in Chunk(messages, BatchSize))
            {
                var batchList = batch.ToList();
                try
                {
                    var payload = batchList.Select(m => new ExpoPushWireMessage(m.To, m.Title, m.Body, m.Data));
                    var json = JsonSerializer.Serialize(payload);
                    using var content = new StringContent(json, Encoding.UTF8, "application/json");

                    using var response = await client.PostAsync(SendPath, content, ct);
                    if (!response.IsSuccessStatusCode)
                    {
                        _logger?.LogWarning("Expo push send returned non-success status {StatusCode}", response.StatusCode);
                        continue;
                    }

                    var responseBody = await response.Content.ReadAsStringAsync(ct);
                    var parsed = JsonSerializer.Deserialize<ExpoPushSendResponse>(responseBody, JsonOptions);
                    if (parsed?.Data is null)
                        continue;

                    for (var i = 0; i < parsed.Data.Count && i < batchList.Count; i++)
                    {
                        var ticket = parsed.Data[i];
                        if (string.Equals(ticket.Status, "error", StringComparison.OrdinalIgnoreCase) &&
                            string.Equals(ticket.Details?.Error, "DeviceNotRegistered", StringComparison.OrdinalIgnoreCase))
                        {
                            prunedTokens.Add(batchList[i].To);
                        }
                    }
                }
                catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
                {
                    _logger?.LogWarning(ex, "Expo push send failed for a batch of {Count} messages", batchList.Count);
                }
            }

            return prunedTokens;
        }

        private static IEnumerable<IEnumerable<ExpoPushMessage>> Chunk(IReadOnlyCollection<ExpoPushMessage> messages, int size)
        {
            var list = messages.ToList();
            for (var i = 0; i < list.Count; i += size)
            {
                yield return list.Skip(i).Take(size);
            }
        }

        private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

        private record ExpoPushWireMessage(
            [property: JsonPropertyName("to")] string To,
            [property: JsonPropertyName("title")] string Title,
            [property: JsonPropertyName("body")] string Body,
            [property: JsonPropertyName("data")] IDictionary<string, object> Data);

        private record ExpoPushSendResponse([property: JsonPropertyName("data")] List<ExpoPushTicket>? Data);

        private record ExpoPushTicket(
            [property: JsonPropertyName("status")] string? Status,
            [property: JsonPropertyName("id")] string? Id,
            [property: JsonPropertyName("message")] string? Message,
            [property: JsonPropertyName("details")] ExpoPushTicketDetails? Details);

        private record ExpoPushTicketDetails([property: JsonPropertyName("error")] string? Error);
    }
}
