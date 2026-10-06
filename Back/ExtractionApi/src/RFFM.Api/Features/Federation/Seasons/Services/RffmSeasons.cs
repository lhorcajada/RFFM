using RFFM.Api.Infrastructure.Options;

namespace RFFM.Api.Features.Federation.Seasons.Services
{
    public static class RffmSeasons
    {
        public static int? Previous(RffmOptions options, int seasonId) =>
            options.SelectableSeasons
                .Where(s => s.Id < seasonId)
                .OrderByDescending(s => s.Id)
                .Select(s => (int?)s.Id)
                .FirstOrDefault();

        public static string Label(RffmOptions options, int seasonId) =>
            options.SelectableSeasons.FirstOrDefault(s => s.Id == seasonId)?.Label ?? seasonId.ToString();
    }
}
