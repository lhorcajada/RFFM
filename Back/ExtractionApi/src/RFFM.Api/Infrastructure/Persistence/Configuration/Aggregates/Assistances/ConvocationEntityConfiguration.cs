using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.Assistances;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.Assistances
{
    internal class ConvocationEntityConfiguration : IEntityTypeConfiguration<Convocation>
    {
        public void Configure(EntityTypeBuilder<Convocation> builder)
        {
            builder.ToTable("Convocations");

            builder.HasKey(c => c.Id);

            builder.Property(c => c.SportEventId)
                .IsRequired();

            builder.Property(c => c.TeamPlayerId)
                .IsRequired();

            builder.Property(c => c.AssistanceTypeId)
                .IsRequired();

            builder.Property(c => c.ConvocationStatusId)
                .IsRequired(false);

            builder.Property(c => c.ResponseDateTime);

            builder.HasOne(c => c.Type)
                .WithMany()
                .HasForeignKey(c => c.AssistanceTypeId);

            builder.HasOne(c => c.Status)
                .WithMany()
                .HasForeignKey(c => c.ConvocationStatusId);

            builder.HasOne(c => c.SportEvent)
                .WithMany(se => se.Called)
                .HasForeignKey(c => c.SportEventId);

            builder.HasOne(c => c.Player)
                .WithMany()
                .HasForeignKey(c => c.TeamPlayerId);
        }
    }
}