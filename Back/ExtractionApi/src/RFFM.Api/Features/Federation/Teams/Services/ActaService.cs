using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Entities.Federation.Results;
using RFFM.Api.Features.Federation.Teams.Models;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Federation.Teams.Services
{
    /// <summary>
    /// Devuelve el acta guardada si existe; si no, la descarga de la RFFM y, si está cerrada, la guarda
    /// (un acta cerrada ya no cambia).
    /// </summary>
    public class ActaService(IHttpClientFactory httpClientFactory, FederationDbContext db, TimeProvider timeProvider) : IActaService
    {
        public async Task<MatchRffm?> GetMatchFromActaAsync(string codActa, int temporada, int competicion, int grupo, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(codActa)) return null;
            codActa = codActa.Trim();

            var stored = await db.RffmMatchRecords.AsNoTracking()
                .Where(r => r.RecordCode == codActa)
                .Select(r => r.PayloadJson)
                .FirstOrDefaultAsync(cancellationToken);
            if (stored != null)
                return JsonSerializer.Deserialize<MatchRffm>(stored);

            var http = httpClientFactory.CreateClient();
            http.DefaultRequestHeaders.UserAgent.ParseAdd("RFFM.Extractor/1.0");

            var url = $"https://www.rffm.es/acta-partido/{codActa}?temporada={temporada}&competicion={competicion}&grupo={grupo}";
            var res = await http.GetAsync(url, cancellationToken);
            if (!res.IsSuccessStatusCode) return null;
            var html = await res.Content.ReadAsStringAsync(cancellationToken);

            var acta = ActaParser.Parse(html);
            var isClosed = acta?.RecordClosed?.Trim() == "1";
            if (acta != null && isClosed)
                await StoreAsync(codActa, grupo.ToString(), acta, cancellationToken);

            return acta;
        }

        private async Task StoreAsync(string codActa, string groupCode, MatchRffm acta, CancellationToken cancellationToken)
        {
            db.RffmMatchRecords.Add(RffmMatchRecord.Create(codActa, groupCode, JsonSerializer.Serialize(acta),
                timeProvider.GetUtcNow().UtcDateTime));
            try
            {
                await db.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateException)
            {
                // Otra petición la guardó a la vez (índice único por acta): el acta ya está en BD.
                db.ChangeTracker.Clear();
            }
        }
    }
}
