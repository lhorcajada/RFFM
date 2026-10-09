using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Entities.TeamPlayers;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.Assistances
{
    internal class AvailabilityRequestEntityConfiguration : IEntityTypeConfiguration<AvailabilityRequest>
    {
        public void Configure(EntityTypeBuilder<AvailabilityRequest> builder)
        {
            builder.ToTable("AvailabilityRequests");

            builder.HasKey(r => r.Id);

            builder.HasIndex(r => new { r.SportEventId, r.TeamPlayerId })
                .IsUnique();

            builder.Property(r => r.SportEventId).IsRequired();
            builder.Property(r => r.TeamPlayerId).IsRequired();
            builder.Property(r => r.StatusId).IsRequired();
            builder.Property(r => r.RequestedAt).IsRequired();
            builder.Property(r => r.RespondedAt);

            builder.Ignore(r => r.IsRequested);
            builder.Ignore(r => r.IsAvailable);
            builder.Ignore(r => r.IsUnavailable);

            builder.HasOne(r => r.SportEvent)
                .WithMany()
                .HasForeignKey(r => r.SportEventId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne<TeamPlayer>()
                .WithMany()
                .HasForeignKey(r => r.TeamPlayerId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
