using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.UserClubs;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.UserClubs
{
    internal class TeamEntityConfiguration : IEntityTypeConfiguration<Team>
    {
        public void Configure(EntityTypeBuilder<Team> builder)
        {
            builder.ToTable("Teams");
            builder.HasKey(t => t.Id);

            builder.Property(t => t.Name)
                .IsRequired()
                .HasMaxLength(ValidationConstants.TeamNameMaxLength);

            builder.Property(t => t.CategoryId)
                .IsRequired();
            builder.Property(t => t.LeagueId)
                .IsRequired(false);

            builder.Property(t => t.UrlPhoto)
                .HasMaxLength(ValidationConstants.TeamUrlPhotoMaxLength);

            builder.Property(t => t.ClubId)
                .IsRequired();

            builder.Property(t => t.SeasonId)
                .IsRequired();
            builder.Property(t => t.LeagueGroup)
                .IsRequired(false);

            builder.HasOne(t => t.Club)
                .WithMany(c => c.Teams)
                .HasForeignKey(t => t.ClubId);

            builder.HasOne(t => t.Season)
                .WithMany()
                .HasForeignKey(t => t.SeasonId);

            builder.HasMany(t => t.Players)
                .WithOne(tp => tp.Team)
                .HasForeignKey(tp => tp.TeamId);

            builder.HasMany(t => t.Trainings)
                .WithOne(tr => tr.Team)
                .HasForeignKey(tr => tr.TeamId);

            builder.HasMany(t => t.SportEvents)
                .WithOne(se => se.Team)
                .HasForeignKey(se => se.TeamId);

            builder.HasOne(t => t.Category)
                .WithMany()
                .HasForeignKey(t => t.CategoryId);
            builder.HasOne(t => t.League)
                .WithMany()
                .HasForeignKey(t => t.LeagueId);
        }
    }
}