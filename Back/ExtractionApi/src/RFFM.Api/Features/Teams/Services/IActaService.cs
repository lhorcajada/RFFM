using System.Threading;
using System.Threading.Tasks;
using RFFM.Api.Features.Teams.Models;

namespace RFFM.Api.Features.Teams.Services
{
    public interface IActaService
    {
        Task<MatchRffm?> GetMatchFromActaAsync(string codActa, int temporada, int competicion, int grupo, CancellationToken cancellationToken = default);
    }
}