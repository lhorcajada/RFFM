using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.TeamPlayers;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.UserClubs
{
    internal class TeamPositionFitOrderEntityConfiguration : IEntityTypeConfiguration<TeamPositionFitOrder>
    {
        public void Configure(EntityTypeBuilder<TeamPositionFitOrder> builder)
        {
            builder.ToTable("TeamPositionFitOrders");
            builder.HasKey(o => o.Id);

            builder.Property(o => o.TeamId).IsRequired();
            builder.Property(o => o.Position).IsRequired();
            builder.Property(o => o.WeekStart).IsRequired().HasColumnType("date");
            builder.Property(o => o.IsManual).IsRequired();

            builder.HasOne<Team>()
                .WithMany()
                .HasForeignKey(o => o.TeamId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasIndex(o => new { o.TeamId, o.Position, o.WeekStart }).IsUnique();

            builder.Navigation(o => o.Entries)
                .UsePropertyAccessMode(PropertyAccessMode.Field)
                .HasField("_entries");
        }
    }

    internal class TeamPositionFitOrderEntryEntityConfiguration : IEntityTypeConfiguration<TeamPositionFitOrderEntry>
    {
        public void Configure(EntityTypeBuilder<TeamPositionFitOrderEntry> builder)
        {
            builder.ToTable("TeamPositionFitOrderEntries");
            builder.HasKey(e => e.Id);

            builder.Property(e => e.OrderId).IsRequired();
            builder.Property(e => e.TeamPlayerId).IsRequired();
            builder.Property(e => e.Place).IsRequired();

            builder.HasOne(e => e.Order)
                .WithMany(o => o.Entries)
                .HasForeignKey(e => e.OrderId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne<TeamPlayer>()
                .WithMany()
                .HasForeignKey(e => e.TeamPlayerId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasIndex(e => new { e.OrderId, e.TeamPlayerId }).IsUnique();
        }
    }

    internal class TeamTraitWeightEntityConfiguration : IEntityTypeConfiguration<TeamTraitWeight>
    {
        public void Configure(EntityTypeBuilder<TeamTraitWeight> builder)
        {
            builder.ToTable("TeamTraitWeights");
            builder.HasKey(w => w.Id);

            builder.Property(w => w.TeamId).IsRequired();
            builder.Property(w => w.Position).IsRequired();
            builder.Property(w => w.TraitKey).IsRequired().HasMaxLength(50);
            builder.Property(w => w.Weight).IsRequired().HasMaxLength(15);

            builder.HasOne<Team>()
                .WithMany()
                .HasForeignKey(w => w.TeamId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasIndex(w => new { w.TeamId, w.Position, w.TraitKey }).IsUnique();
        }
    }
}
