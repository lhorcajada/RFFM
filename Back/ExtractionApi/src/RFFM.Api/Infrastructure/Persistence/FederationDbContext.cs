using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Entities.Federation;
using RFFM.Api.Infrastructure.Persistence.Configuration.Entities;

namespace RFFM.Api.Infrastructure.Persistence
{
    public class FederationDbContext : DbContext
    {
        public DbSet<FederationSetting> FederationSettings { get; set; }
        public DbSet<RffmSeasonPreference> RffmSeasonPreferences { get; set; }

        public FederationDbContext(DbContextOptions<FederationDbContext> options) : base(options) { }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            modelBuilder.HasDefaultSchema("federation");
            modelBuilder.ApplyConfiguration(new FederationSettingEntityConfiguration());
            modelBuilder.ApplyConfiguration(new RffmSeasonPreferenceEntityConfiguration());
        }

        public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            return await base.SaveChangesAsync(cancellationToken);
        }
    }
}
