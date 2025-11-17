using RFFM.Api.Features.Players.Models;

namespace RFFM.Api.Features.Players.Services;

public interface IPlayerService
{
    Task<Player?> GetPlayerAsync(string playerId, int seasonId, CancellationToken cancellationToken = default);
}
