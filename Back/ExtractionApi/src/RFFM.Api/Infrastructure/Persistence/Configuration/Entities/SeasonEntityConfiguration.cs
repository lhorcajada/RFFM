using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities.Seasons;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Entities
{
    internal class SeasonEntityConfiguration : IEntityTypeConfiguration<Season>
    {
        public void Configure(EntityTypeBuilder<Season> builder)
        {
            builder.ToTable("Seasons");

            builder.Property(c => c.Name)
                .IsRequired()
                .HasMaxLength(ValidationConstants.SeasonNameMaxLength);

            builder.Property(c => c.StartDate)
                .IsRequired()
                .HasColumnType("timestamp with time zone");

            builder.Property(c => c.EndDate)
                .IsRequired()
                .HasColumnType("timestamp with time zone");

            builder.Property(c => c.ClubId)
                .IsRequired()
                .HasMaxLength(ValidationConstants.ClubIdMaxLength);

            builder.Property(c => c.IsActive)
                .IsRequired();

            builder.HasKey(c => c.Id);

        }
    }
}
