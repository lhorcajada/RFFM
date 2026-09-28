using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Entities.Federation;
using RFFM.Api.Domain.Entities.Federation.SquadHistory;
using RFFM.Api.Infrastructure.Persistence.Configuration.Entities;

namespace RFFM.Api.Infrastructure.Persistence
{
    public class FederationDbContext : DbContext
    {
        public DbSet<FederationSetting> FederationSettings { get; set; }
        public DbSet<RffmSeasonPreference> RffmSeasonPreferences { get; set; }
        public DbSet<SquadHistoryReport> SquadHistoryReports { get; set; }
        public DbSet<SquadHistoryEntry> SquadHistoryEntries { get; set; }
        public DbSet<SquadHistorySubscriber> SquadHistorySubscribers { get; set; }

        public FederationDbContext(DbContextOptions<FederationDbContext> options) : base(options) { }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            modelBuilder.HasDefaultSchema("federation");
            modelBuilder.ApplyConfiguration(new FederationSettingEntityConfiguration());
            modelBuilder.ApplyConfiguration(new RffmSeasonPreferenceEntityConfiguration());
            modelBuilder.ApplyConfiguration(new SquadHistoryReportEntityConfiguration());
            modelBuilder.ApplyConfiguration(new SquadHistoryEntryEntityConfiguration());
            modelBuilder.ApplyConfiguration(new SquadHistorySubscriberEntityConfiguration());
        }

        public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            return await base.SaveChangesAsync(cancellationToken);
        }
    }
}
