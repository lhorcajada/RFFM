using RFFM.Api.Features.Federation.Teams.Models;

namespace RFFM.Api.Features.Federation.Teams.Services
{
    public class ActaService : IActaService
    {
        private readonly IHttpClientFactory _httpClientFactory;

        public ActaService(IHttpClientFactory httpClientFactory)
        {
            _httpClientFactory = httpClientFactory;
        }

        public async Task<MatchRffm?> GetMatchFromActaAsync(string codActa, int temporada, int competicion, int grupo, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(codActa)) return null;
            var http = _httpClientFactory.CreateClient();
            http.DefaultRequestHeaders.UserAgent.ParseAdd("RFFM.Extractor/1.0");

            var url = $"https://www.rffm.es/acta-partido/{codActa}?temporada={temporada}&competicion={competicion}&grupo={grupo}";
            var res = await http.GetAsync(url, cancellationToken);
            if (!res.IsSuccessStatusCode) return null;
            var html = await res.Content.ReadAsStringAsync(cancellationToken);

            return ActaParser.Parse(html);
        }
    }
}
