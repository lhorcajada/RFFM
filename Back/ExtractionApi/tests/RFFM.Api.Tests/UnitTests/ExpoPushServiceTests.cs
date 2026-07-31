#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Moq;
using RFFM.Api.Features.Mobile.PushNotifications.Services;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class ExpoPushServiceTests
    {
        /// <summary>
        /// Minimal fake <see cref="HttpMessageHandler"/> capturing every outgoing request and
        /// replaying a scripted sequence of responses (one per request, in order). Avoids adding
        /// a Moq.Protected dependency for a single test file — no existing HttpClient-based test
        /// in this solution establishes a shared mocking helper to reuse (checked via grep before
        /// writing this).
        /// </summary>
        private sealed class FakeHttpMessageHandler : HttpMessageHandler
        {
            private readonly Queue<Func<HttpResponseMessage>> _responses;
            public List<string> RequestBodies { get; } = new();

            public FakeHttpMessageHandler(params Func<HttpResponseMessage>[] responses)
            {
                _responses = new Queue<Func<HttpResponseMessage>>(responses);
            }

            protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            {
                var body = request.Content is null ? string.Empty : await request.Content.ReadAsStringAsync(cancellationToken);
                RequestBodies.Add(body);
                return _responses.Count > 0 ? _responses.Dequeue()() : new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent("{\"data\":[]}", Encoding.UTF8, "application/json")
                };
            }
        }

        private static IHttpClientFactory CreateFactory(FakeHttpMessageHandler handler)
        {
            var httpClient = new HttpClient(handler) { BaseAddress = new Uri("https://exp.host/") };
            var factory = new Mock<IHttpClientFactory>();
            factory.Setup(f => f.CreateClient("ExpoPush")).Returns(httpClient);
            return factory.Object;
        }

        private static HttpResponseMessage JsonResponse(object payload) =>
            new(HttpStatusCode.OK)
            {
                Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json")
            };

        [Fact]
        public async Task SendAsync_AllSucceed_ReturnsNoPrunedTokens()
        {
            var handler = new FakeHttpMessageHandler(() => JsonResponse(new
            {
                data = new object[]
                {
                    new { status = "ok", id = "receipt-1" }
                }
            }));
            var service = new ExpoPushService(CreateFactory(handler));

            var messages = new[] { new ExpoPushMessage("ExponentPushToken[aaa]", "Title", "Body", new Dictionary<string, object> { ["type"] = "news" }) };
            var pruned = await service.SendAsync(messages);

            Assert.Empty(pruned);
        }

        [Fact]
        public async Task SendAsync_PartialFailure_ReturnsOnlyDeviceNotRegisteredTokens()
        {
            var handler = new FakeHttpMessageHandler(() => JsonResponse(new
            {
                data = new object[]
                {
                    new { status = "ok", id = "receipt-1" },
                    new { status = "error", message = "device not registered", details = new { error = "DeviceNotRegistered" } },
                    new { status = "error", message = "some other error", details = new { error = "MessageTooBig" } }
                }
            }));
            var service = new ExpoPushService(CreateFactory(handler));

            var messages = new[]
            {
                new ExpoPushMessage("ExponentPushToken[aaa]", "T", "B", new Dictionary<string, object>()),
                new ExpoPushMessage("ExponentPushToken[bbb]", "T", "B", new Dictionary<string, object>()),
                new ExpoPushMessage("ExponentPushToken[ccc]", "T", "B", new Dictionary<string, object>())
            };

            var pruned = await service.SendAsync(messages);

            Assert.Single(pruned);
            Assert.Contains("ExponentPushToken[bbb]", pruned);
        }

        [Fact]
        public async Task SendAsync_MoreThan100Messages_SplitsIntoMultipleBatches()
        {
            var handler = new FakeHttpMessageHandler(
                () => JsonResponse(new { data = Enumerable.Repeat(new { status = "ok", id = "r" }, 100).ToArray() }),
                () => JsonResponse(new { data = Enumerable.Repeat(new { status = "ok", id = "r" }, 20).ToArray() })
            );
            var service = new ExpoPushService(CreateFactory(handler));

            var messages = Enumerable.Range(0, 120)
                .Select(i => new ExpoPushMessage($"ExponentPushToken[{i}]", "T", "B", new Dictionary<string, object>()))
                .ToArray();

            var pruned = await service.SendAsync(messages);

            Assert.Empty(pruned);
            Assert.Equal(2, handler.RequestBodies.Count);
        }

        [Fact]
        public async Task SendAsync_NonSuccessStatusCode_SwallowsAndReturnsEmptyPrunedList()
        {
            var handler = new FakeHttpMessageHandler(() => new HttpResponseMessage(HttpStatusCode.InternalServerError)
            {
                Content = new StringContent("boom")
            });
            var service = new ExpoPushService(CreateFactory(handler));

            var messages = new[] { new ExpoPushMessage("ExponentPushToken[aaa]", "T", "B", new Dictionary<string, object>()) };

            var pruned = await service.SendAsync(messages);

            Assert.Empty(pruned);
        }

        [Fact]
        public async Task SendAsync_MalformedJsonResponse_SwallowsAndReturnsEmptyPrunedList()
        {
            var handler = new FakeHttpMessageHandler(() => new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("not json", Encoding.UTF8, "application/json")
            });
            var service = new ExpoPushService(CreateFactory(handler));

            var messages = new[] { new ExpoPushMessage("ExponentPushToken[aaa]", "T", "B", new Dictionary<string, object>()) };

            var pruned = await service.SendAsync(messages);

            Assert.Empty(pruned);
        }
    }
}
