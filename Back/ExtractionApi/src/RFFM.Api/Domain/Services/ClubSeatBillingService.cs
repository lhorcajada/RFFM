using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Domain.Services
{
    public class ClubSeatBillingService : IClubSeatBillingService
    {
        private readonly AppDbContext _db;

        public ClubSeatBillingService(AppDbContext db)
        {
            _db = db;
        }

        public async Task<ClubSeatCharge> ChargeSeatAsync(string clubId, string chargedUserId, int membershipId, CancellationToken cancellationToken)
        {
            var seatPlan = await _db.PaymentPlans.FirstOrDefaultAsync(p => p.Name == "Seat", cancellationToken);
            if (seatPlan is null)
            {
                seatPlan = new PaymentPlan
                {
                    Name = "Seat",
                    Description = "Per-seat club membership charge",
                    PriceCents = 0,
                    BillingPeriod = BillingPeriodType.OneOff,
                    AllowedClubs = 0,
                    AllowedTeams = 0,
                    AllowedUsers = 0
                };
                _db.PaymentPlans.Add(seatPlan);
                await _db.SaveChangesAsync(cancellationToken);
            }

            var charge = new ClubSeatCharge
            {
                ClubId = clubId,
                ChargedUserId = chargedUserId,
                PriceCents = seatPlan.PriceCents,
                ChargedAt = DateTime.UtcNow,
                Status = ClubSeatChargeStatus.Pending
            };
            _db.ClubSeatCharges.Add(charge);
            await _db.SaveChangesAsync(cancellationToken);
            return charge;
        }
    }
}
