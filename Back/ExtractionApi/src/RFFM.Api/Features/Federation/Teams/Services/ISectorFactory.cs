using RFFM.Api.Features.Federation.Teams.Queries.Responses;

namespace RFFM.Api.Features.Federation.Teams.Services
{
    public interface ISectorFactory
    {
        List<Sector> BuildSectors(int matchTime, int sectorsPerHalf);
    }
}