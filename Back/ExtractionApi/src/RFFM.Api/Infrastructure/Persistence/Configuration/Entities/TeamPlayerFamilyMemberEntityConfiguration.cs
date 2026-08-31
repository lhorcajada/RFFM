using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities.TeamPlayers;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Entities
{
    internal class TeamPlayerFamilyMemberEntityConfiguration : IEntityTypeConfiguration<TeamPlayerFamilyMember>
    {
        public void Configure(EntityTypeBuilder<TeamPlayerFamilyMember> builder)
        {
            // Reuses the pre-existing "TeamPlayerFamilies" table: this entity promotes the owned
            // value object Family (whose shadow "Id" key already lived in this table) to a
            // first-level entity, so no data is moved.
            builder.ToTable("TeamPlayerFamilies");

            builder.HasKey(f => f.Id);

            builder.Property(f => f.TeamPlayerId).IsRequired();
            builder.Property(f => f.Name).HasMaxLength(100).IsRequired(false);
            builder.Property(f => f.LastName).HasMaxLength(100).IsRequired(false);
            builder.Property(f => f.Phone).HasMaxLength(15).IsRequired(false);
            builder.Property(f => f.Email).HasMaxLength(255).IsRequired(false);
            builder.Property(f => f.Dni).HasMaxLength(20).IsRequired(false);
            builder.Property(f => f.FamilyMember).HasMaxLength(50).IsRequired(false);

            builder.HasIndex(f => f.TeamPlayerId);

            builder.HasOne(f => f.TeamPlayer)
                .WithMany(tp => tp.FamilyMembers)
                .HasForeignKey(f => f.TeamPlayerId)
                .OnDelete(DeleteBehavior.Cascade);

            // Table-split (not a separate table) to match the pre-existing column layout
            // (Address_Street, Address_City, ... inline on "TeamPlayerFamilies") so the migration
            // that promotes Family to this entity does not need to move any Address data.
            builder.OwnsOne(f => f.Address, address =>
            {
                address.Property<string>("Id");

                address.Property(a => a.Street).HasMaxLength(200).IsRequired(false);
                address.Property(a => a.City).HasMaxLength(100).IsRequired(false);
                address.Property(a => a.Province).HasMaxLength(100).IsRequired(false);
                address.Property(a => a.PostalCode).HasMaxLength(20).IsRequired(false);
                address.Property(a => a.Country).HasMaxLength(100).IsRequired(false);

                address.WithOwner();
            });
        }
    }
}
