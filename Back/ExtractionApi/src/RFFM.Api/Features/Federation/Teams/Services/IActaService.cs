using RFFM.Api.Features.Federation.Teams.Models;

namespace RFFM.Api.Features.Federation.Teams.Services
{
    public interface IActaService
    {
        Task<MatchRffm?> GetMatchFromActaAsync(string codActa, int temporada, int competicion, int grupo, CancellationToken cancellationToken = default);
    }
}