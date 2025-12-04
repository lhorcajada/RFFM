using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities.Competitions;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Entities
{
    internal class CategoryEntityConfiguration : IEntityTypeConfiguration<Category>
    {
        public void Configure(EntityTypeBuilder<Category> builder)
        {
            builder.ToTable("Categories");

            builder.Property(cg => cg.Name)
                .IsRequired()
                .HasMaxLength(ValidationConstants.CategoryNameMaxLength);

            builder.HasKey(cg => cg.Id);

            builder.HasData(Category.GetAll());
        }
    }
}
