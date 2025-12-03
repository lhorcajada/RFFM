using RFFM.Api.Features.Federation.Teams.Queries.Responses;

namespace RFFM.Api.Features.Federation.Teams.Services
{
    public class SectorFactory : ISectorFactory
    {
        public List<Sector> BuildSectors(int matchTime, int sectorsPerHalf)
        {
            var halfDuration = matchTime / 2;
            var sectors = new List<Sector>();

            for (var half = 0; half < 2; half++)
            {
                var currentStart = half * halfDuration + 1;
                var baseLen = halfDuration / sectorsPerHalf;
                var remainder = halfDuration % sectorsPerHalf;
                for (var s = 0; s < sectorsPerHalf; s++)
                {
                    var add = s < remainder ? 1 : 0;
                    var len = baseLen + add;
                    var start = currentStart;
                    var end = currentStart + len - 1;
                    sectors.Add(new Sector { StartMinute = start, EndMinute = end, GoalsFor = 0, GoalsAgainst = 0 });
                    currentStart = end + 1;
                }
            }

            return sectors.OrderBy(s=> s.StartMinute).ToList();
        }
    }
}