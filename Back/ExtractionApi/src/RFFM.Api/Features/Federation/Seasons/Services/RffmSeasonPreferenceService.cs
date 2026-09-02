using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Entities.Federation;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Federation.Seasons.Services
{
    public interface IRffmSeasonPreferenceService
    {
        Task<RffmSeasonPreference?> GetForUserAsync(string userId, CancellationToken cancellationToken);
        Task<RffmSeasonPreference> UpsertAsync(string userId, int seasonId, CancellationToken cancellationToken);
    }

    public class RffmSeasonPreferenceService : IRffmSeasonPreferenceService
    {
        private readonly FederationDbContext _context;

        public RffmSeasonPreferenceService(FederationDbContext context)
        {
            _context = context;
        }

        public async Task<RffmSeasonPreference?> GetForUserAsync(string userId, CancellationToken cancellationToken)
        {
            return await _context.RffmSeasonPreferences
                .FirstOrDefaultAsync(p => p.UserId == userId, cancellationToken);
        }

        public async Task<RffmSeasonPreference> UpsertAsync(string userId, int seasonId, CancellationToken cancellationToken)
        {
            var existing = await _context.RffmSeasonPreferences
                .FirstOrDefaultAsync(p => p.UserId == userId, cancellationToken);

            if (existing != null)
            {
                existing.UpdateSeason(seasonId);
                await _context.SaveChangesAsync(cancellationToken);
                return existing;
            }

            var created = new RffmSeasonPreference(userId, seasonId);
            _context.RffmSeasonPreferences.Add(created);
            await _context.SaveChangesAsync(cancellationToken);
            return created;
        }
    }
}
