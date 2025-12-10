using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Entities.Federation;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Federation.Settings.Services
{
    public interface IFederationSettingService
    {
        Task<FederationSetting?> GetByIdAsync(string id, CancellationToken cancellationToken);
        Task<List<FederationSetting>> GetAllSettingsAsync(CancellationToken cancellationToken);
        Task<FederationSetting?> GetPrimarySettingAsync(CancellationToken cancellationToken);
        Task<FederationSetting> CreateAsync(FederationSetting setting, CancellationToken cancellationToken);
        Task<FederationSetting> UpdateAsync(string id, FederationSetting updatedSetting, CancellationToken cancellationToken);
        Task DeleteAsync(string id, CancellationToken cancellationToken);
        Task SetPrimaryAsync(string id, CancellationToken cancellationToken);
    }

    public class FederationSettingService : IFederationSettingService
    {
        private readonly AppDbContext _context;

        public FederationSettingService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<FederationSetting?> GetByIdAsync(string id, CancellationToken cancellationToken)
        {
            return await _context.FederationSettings
                .FirstOrDefaultAsync(s => s.Id == id, cancellationToken);
        }

        public async Task<List<FederationSetting>> GetAllSettingsAsync(CancellationToken cancellationToken)
        {
            return await _context.FederationSettings
                .OrderByDescending(s => s.IsPrimary)
                .ThenByDescending(s => s.CreatedAt)
                .ToListAsync(cancellationToken);
        }

        public async Task<FederationSetting?> GetPrimarySettingAsync(CancellationToken cancellationToken)
        {
            return await _context.FederationSettings
                .Where(s => s.IsPrimary)
                .FirstOrDefaultAsync(cancellationToken);
        }

        public async Task<FederationSetting> CreateAsync(FederationSetting setting, CancellationToken cancellationToken)
        {
            // Si es marcada como primaria, desmarcar otras como primarias
            if (setting.IsPrimary)
            {
                var existingPrimary = await _context.FederationSettings
                    .Where(s => s.IsPrimary)
                    .ToListAsync(cancellationToken);

                foreach (var primary in existingPrimary)
                {
                    primary.SetAsSecondary();
                }
            }

            _context.FederationSettings.Add(setting);
            await _context.SaveChangesAsync(cancellationToken);
            return setting;
        }

        public async Task<FederationSetting> UpdateAsync(string id, FederationSetting updatedSetting, CancellationToken cancellationToken)
        {
            var existing = await GetByIdAsync(id, cancellationToken);
            if (existing == null)
                throw new InvalidOperationException($"FederationSetting con id {id} no encontrado");

            existing.Update(
                updatedSetting.CompetitionId,
                updatedSetting.CompetitionName,
                updatedSetting.GroupId,
                updatedSetting.GroupName,
                updatedSetting.TeamId,
                updatedSetting.TeamName,
                updatedSetting.IsPrimary);

            // Si se marca como primaria, desmarcar otras
            if (updatedSetting.IsPrimary)
            {
                var otherPrimaries = await _context.FederationSettings
                    .Where(s => s.Id != id && s.IsPrimary)
                    .ToListAsync(cancellationToken);

                foreach (var primary in otherPrimaries)
                {
                    primary.SetAsSecondary();
                }
            }

            _context.FederationSettings.Update(existing);
            await _context.SaveChangesAsync(cancellationToken);
            return existing;
        }

        public async Task DeleteAsync(string id, CancellationToken cancellationToken)
        {
            var setting = await GetByIdAsync(id, cancellationToken);
            if (setting == null)
                throw new InvalidOperationException($"FederationSetting con id {id} no encontrado");

            _context.FederationSettings.Remove(setting);
            await _context.SaveChangesAsync(cancellationToken);
        }

        public async Task SetPrimaryAsync(string id, CancellationToken cancellationToken)
        {
            var setting = await GetByIdAsync(id, cancellationToken);
            if (setting == null)
                throw new InvalidOperationException($"FederationSetting con id {id} no encontrado");

            // Desmarcar otras como primarias
            var otherPrimaries = await _context.FederationSettings
                .Where(s => s.Id != id && s.IsPrimary)
                .ToListAsync(cancellationToken);

            foreach (var primary in otherPrimaries)
            {
                primary.SetAsSecondary();
            }

            setting.SetAsPrimary();
            _context.FederationSettings.Update(setting);
            await _context.SaveChangesAsync(cancellationToken);
        }
    }
}
