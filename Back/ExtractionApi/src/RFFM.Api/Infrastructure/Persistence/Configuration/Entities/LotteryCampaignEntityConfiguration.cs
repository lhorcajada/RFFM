using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Entities.Teams;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Entities
{
    internal class LotteryCampaignEntityConfiguration : IEntityTypeConfiguration<LotteryCampaign>
    {
        public void Configure(EntityTypeBuilder<LotteryCampaign> builder)
        {
            builder.ToTable("LotteryCampaigns");

            builder.HasKey(c => c.Id);

            builder.Property(c => c.TeamId).IsRequired();
            builder.Property(c => c.Name).HasMaxLength(LotteryCampaign.Rules.NameMaxLength).IsRequired();
            builder.Property(c => c.DrawDate).IsRequired();
            builder.Property(c => c.TicketPrice).HasColumnType("decimal(10,2)").IsRequired();
            builder.Property(c => c.TicketsPerBook).IsRequired();
            builder.Property(c => c.ClubDeliveryFrom).IsRequired();
            builder.Property(c => c.ClubDeliveryTo).IsRequired();
            builder.Property(c => c.ClubDeliveredAmount).HasColumnType("decimal(10,2)");

            builder.HasIndex(c => new { c.TeamId, c.DrawDate });

            builder.HasOne<Team>()
                .WithMany()
                .HasForeignKey(c => c.TeamId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasMany(c => c.Books)
                .WithOne()
                .HasForeignKey(b => b.LotteryCampaignId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Navigation(c => c.Books).UsePropertyAccessMode(PropertyAccessMode.Field);
        }
    }

    internal class LotteryBookEntityConfiguration : IEntityTypeConfiguration<LotteryBook>
    {
        public void Configure(EntityTypeBuilder<LotteryBook> builder)
        {
            builder.ToTable("LotteryBooks");

            builder.HasKey(b => b.Id);

            builder.Property(b => b.LotteryCampaignId).IsRequired();
            builder.Property(b => b.TeamPlayerId).IsRequired();
            builder.Property(b => b.BookNumber).IsRequired();
            builder.Property(b => b.FirstTicketNumber).IsRequired();
            builder.Property(b => b.DeliveredOn).IsRequired();
            builder.Property(b => b.AmountReturned).HasColumnType("decimal(10,2)");

            builder.HasIndex(b => new { b.LotteryCampaignId, b.BookNumber }).IsUnique();

            // Restrict: un taco con dinero no desaparece en silencio si se borra al jugador.
            builder.HasOne<TeamPlayer>()
                .WithMany()
                .HasForeignKey(b => b.TeamPlayerId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
