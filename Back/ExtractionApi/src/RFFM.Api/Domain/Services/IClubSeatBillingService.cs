namespace RFFM.Api.Domain.Services
{
    public interface IClubSeatBillingService
    {
        Task<Entities.ClubSeatCharge> ChargeSeatAsync(string clubId, string chargedUserId, int membershipId, CancellationToken cancellationToken);
    }
}
