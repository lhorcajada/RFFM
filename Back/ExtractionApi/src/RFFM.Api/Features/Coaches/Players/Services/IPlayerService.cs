using RFFM.Api.Domain.Entities.Players;

namespace RFFM.Api.Features.Coaches.Players.Services
{
    public interface IPlayerService
    {
        Task<Player> AddPlayerClub(CreatePlayerModel request, CancellationToken cancellationToken);
    }
}
