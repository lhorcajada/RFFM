using RFFM.Api.Features.Federation.Players.Models;

namespace RFFM.Api.Features.Federation.Players.Services;

public interface IPlayerService
{
    Task<Player?> GetPlayerAsync(string playerId, int seasonId, CancellationToken cancellationToken = default);
}
