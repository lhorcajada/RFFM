using RFFM.Api.Features.Teams.Queries.Responses;

namespace RFFM.Api.Features.Teams.Services
{
    public interface ISectorFactory
    {
        List<Sector> BuildSectors(int matchTime, int sectorsPerHalf);
    }
}