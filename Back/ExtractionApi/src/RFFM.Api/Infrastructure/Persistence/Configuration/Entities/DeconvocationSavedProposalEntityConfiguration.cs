using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Entities.Teams;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Entities
{
    internal class DeconvocationSavedProposalEntityConfiguration : IEntityTypeConfiguration<DeconvocationSavedProposal>
    {
        public void Configure(EntityTypeBuilder<DeconvocationSavedProposal> builder)
        {
            builder.ToTable("DeconvocationSavedProposals");

            builder.HasKey(p => p.Id);

            builder.Property(p => p.SportEventId).IsRequired();
            builder.Property(p => p.Name).HasMaxLength(DeconvocationSavedProposal.MaxNameLength).IsRequired();
            builder.Property(p => p.TeamPlayerIdsJson).HasColumnType("jsonb").IsRequired();
            builder.Property(p => p.CreatedOn).IsRequired();
            builder.Ignore(p => p.TeamPlayerIds);

            builder.HasIndex(p => p.SportEventId);

            builder.HasOne<SportEvent>()
                .WithMany()
                .HasForeignKey(p => p.SportEventId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
