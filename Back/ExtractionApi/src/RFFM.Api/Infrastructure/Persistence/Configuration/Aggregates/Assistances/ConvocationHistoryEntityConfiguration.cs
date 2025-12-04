using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.Assistances;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.Assistances
{
    internal class ConvocationHistoryEntityConfiguration : IEntityTypeConfiguration<ConvocationHistory>
    {
        public void Configure(EntityTypeBuilder<ConvocationHistory> builder)
        {
            builder.ToTable("ConvocationHistories");

            builder.HasKey(ch => ch.Id);

            builder.Property(ch => ch.ConvocationId)
                .IsRequired();

            builder.Property(ch => ch.UserId)
                .IsRequired();

            builder.Property(ch => ch.ChangeDateTime)
                .IsRequired();

            builder.Property(ch => ch.OldStatusId);

            builder.Property(ch => ch.NewStatusId)
                .IsRequired();

            builder.HasOne(ch => ch.Convocation)
                .WithMany()
                .HasForeignKey(ch => ch.ConvocationId);
        }
    }
}