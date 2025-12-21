using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities.Coaches;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Entities
{
    internal class ConfigurationCoachEntityConfiguration : IEntityTypeConfiguration<ConfigurationCoach>
    {
        public void Configure(EntityTypeBuilder<ConfigurationCoach> builder)
        {
            builder.ToTable("ConfigurationCoach");
            builder.HasKey(c => c.Id);
            builder.Property(c => c.CoachId).IsRequired();
            builder.Property(c => c.PreferredClubId).HasMaxLength(50).IsRequired(false);
            builder.Property(c => c.PreferredTeamId).HasMaxLength(50).IsRequired(false);
            builder.HasIndex(c => c.CoachId).IsUnique();
        }
    }
}
