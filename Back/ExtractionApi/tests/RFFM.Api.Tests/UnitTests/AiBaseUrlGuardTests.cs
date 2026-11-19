#nullable enable
using System.Net;
using RFFM.Api.Features.AiSettings.Services;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class AiBaseUrlGuardTests
    {
        private readonly AiBaseUrlGuard _guard = new();

        [Theory]
        [InlineData("127.0.0.1")]
        [InlineData("10.1.2.3")]
        [InlineData("172.16.0.1")]
        [InlineData("172.31.255.254")]
        [InlineData("192.168.1.10")]
        [InlineData("169.254.169.254")]
        [InlineData("100.64.0.1")]
        [InlineData("0.0.0.0")]
        [InlineData("::1")]
        [InlineData("fe80::1")]
        [InlineData("fc00::1")]
        [InlineData("::ffff:10.0.0.1")]
        public void IsForbiddenAddress_PrivateLoopbackOrLinkLocal_ReturnsTrue(string address)
        {
            Assert.True(AiBaseUrlGuard.IsForbiddenAddress(IPAddress.Parse(address)));
        }

        [Theory]
        [InlineData("8.8.8.8")]
        [InlineData("172.32.0.1")]
        [InlineData("2606:4700:4700::1111")]
        public void IsForbiddenAddress_PublicAddress_ReturnsFalse(string address)
        {
            Assert.False(AiBaseUrlGuard.IsForbiddenAddress(IPAddress.Parse(address)));
        }

        [Theory]
        [InlineData("https://127.0.0.1/v1", AiBaseUrlVerdict.ForbiddenAddress)]
        [InlineData("https://10.0.0.5", AiBaseUrlVerdict.ForbiddenAddress)]
        [InlineData("https://[::1]/v1", AiBaseUrlVerdict.ForbiddenAddress)]
        [InlineData("https://localhost/v1", AiBaseUrlVerdict.ForbiddenAddress)]
        [InlineData("http://8.8.8.8/v1", AiBaseUrlVerdict.NotHttps)]
        [InlineData("ftp://8.8.8.8", AiBaseUrlVerdict.NotHttps)]
        [InlineData("not a url", AiBaseUrlVerdict.Invalid)]
        [InlineData("", AiBaseUrlVerdict.Invalid)]
        [InlineData("https://user:secret@8.8.8.8/v1", AiBaseUrlVerdict.Invalid)]
        [InlineData("https://8.8.8.8/v1", AiBaseUrlVerdict.Allowed)]
        public async Task CheckAsync_ClassifiesTheBaseUrl(string baseUrl, AiBaseUrlVerdict expected)
        {
            var verdict = await _guard.CheckAsync(baseUrl, CancellationToken.None);

            Assert.Equal(expected, verdict);
        }

        [Theory]
        [InlineData("https://api.openai.com/v1", true)]
        [InlineData("http://api.openai.com/v1", false)]
        [InlineData("api.openai.com", false)]
        [InlineData(null, false)]
        public void IsHttpsUrl_OnlyAcceptsAbsoluteHttpsUrls(string? baseUrl, bool expected)
        {
            Assert.Equal(expected, AiBaseUrlGuard.IsHttpsUrl(baseUrl));
        }

        [Fact]
        public async Task GuardedHandler_RefusesToConnectToAPrivateAddress()
        {
            using var client = new HttpClient(AiHttpHandlerFactory.Create());

            await Assert.ThrowsAsync<HttpRequestException>(() => client.GetAsync("https://127.0.0.1:9/"));
        }
    }
}
