using Microsoft.Extensions.Options;
using RFFM.Api.Features.Federation.Competitions.Queries.GetCalendar.Responses;
using RFFM.Api.Features.Federation.MatchResults.Services;
using RFFM.Api.Infrastructure.Options;

namespace RFFM.Api.Features.Federation.Competitions.Services
{
    public interface ICalendarService
    {
        Task<CalendarResponse> GetCalendarAsync(int competicion, int groupId,
            CancellationToken cancellationToken = default);
    }

    /// <summary>Calendario completo de un grupo, servido desde los resultados guardados (ver <see cref="IRffmResultsSyncService"/>).</summary>
    public class CalendarService(IRffmResultsSyncService resultsSyncService, IOptions<RffmOptions> rffmOptions) : ICalendarService
    {
        public Task<CalendarResponse> GetCalendarAsync(int competicion, int groupId, CancellationToken cancellationToken = default) =>
            resultsSyncService.GetCalendarAsync(groupId, rffmOptions.Value.CurrentSeasonId, cancellationToken);
    }
}
