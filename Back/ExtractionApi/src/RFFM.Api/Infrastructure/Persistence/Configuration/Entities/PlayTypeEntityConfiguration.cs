using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities.Competitions;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Entities
{
    internal class PlayTypeEntityConfiguration : IEntityTypeConfiguration<PlayType>
    {
        public void Configure(EntityTypeBuilder<PlayType> builder)
        {
            builder.ToTable("PlayTypes");

            builder.Property(pt => pt.Name)
                .IsRequired()
                .HasMaxLength(ValidationConstants.PlayTypeNameMaxLength);

            builder.HasKey(pt => pt.Id);

            builder.HasData(PlayType.GetAll());
        }
    }
}
