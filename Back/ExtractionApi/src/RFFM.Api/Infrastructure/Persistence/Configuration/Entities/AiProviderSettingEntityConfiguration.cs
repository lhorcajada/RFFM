using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities.AiProviders;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Entities
{
    internal class AiProviderSettingEntityConfiguration : IEntityTypeConfiguration<AiProviderSetting>
    {
        public void Configure(EntityTypeBuilder<AiProviderSetting> builder)
        {
            builder.ToTable("AiProviderSettings");

            builder.HasKey(p => p.Id);

            builder.Property(p => p.UserId).HasMaxLength(450).IsRequired();
            builder.Property(p => p.Template).HasMaxLength(20).IsRequired();
            builder.Property(p => p.BaseUrl).HasMaxLength(AiProviderSetting.Rules.BaseUrlMaxLength).IsRequired();
            builder.Property(p => p.Model).HasMaxLength(AiProviderSetting.Rules.ModelMaxLength).IsRequired();
            builder.Property(p => p.EncryptedApiKey).HasMaxLength(2000).IsRequired();
            builder.Property(p => p.ApiKeyTail).HasMaxLength(AiProviderSetting.Rules.ApiKeyTailLength).IsRequired();
            builder.Property(p => p.IsActive).IsRequired();
            builder.Property(p => p.CreatedAt).IsRequired();
            builder.Property(p => p.UpdatedAt).IsRequired();

            builder.HasIndex(p => p.UserId);
        }
    }
}
