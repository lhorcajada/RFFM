using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using System.Text;

namespace RFFM.Api.Infrastructure.Helpers
{
    public class HtmlFetcher
    {
        private readonly HttpClient _http;
        public HtmlFetcher(HttpClient http) => _http = http;
        public async Task<string> FetchAsync(string url, CancellationToken ct = default)
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, url);

            // Set common browser-like headers to increase chance of receiving full HTML
            // Only set headers that are safe to set on client side.
            if (!request.Headers.Contains("User-Agent"))
            {
                request.Headers.TryAddWithoutValidation("User-Agent", "Mozilla/5.0 (Windows NT10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
            }
            request.Headers.TryAddWithoutValidation("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
            request.Headers.TryAddWithoutValidation("Accept-Language", "es-ES,es;q=0.9,en;q=0.8");
            // Let HttpClient handle compression (AutomaticDecompression should be enabled on handler by default in most environments)

            using var resp = await _http.SendAsync(request, HttpCompletionOption.ResponseContentRead, ct).ConfigureAwait(false);
            resp.EnsureSuccessStatusCode();

            var bytes = await resp.Content.ReadAsByteArrayAsync(ct).ConfigureAwait(false);

            // try to detect charset from headers
            var charset = resp.Content.Headers.ContentType?.CharSet;
            if (!string.IsNullOrWhiteSpace(charset))
            {
                try
                {
                    return Encoding.GetEncoding(charset).GetString(bytes);
                }
                catch
                {
                    // ignore and fallback to utf8
                }
            }

            // fallback: try to sniff BOM
            if (bytes.Length >=3 && bytes[0] ==0xEF && bytes[1] ==0xBB && bytes[2] ==0xBF)
            {
                return Encoding.UTF8.GetString(bytes,3, bytes.Length -3);
            }

            // fallback: try UTF8 by default
            return Encoding.UTF8.GetString(bytes);
        }
    }
}
