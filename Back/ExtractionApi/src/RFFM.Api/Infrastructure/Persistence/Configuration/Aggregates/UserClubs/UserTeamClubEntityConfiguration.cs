using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.UserClubs
{
    internal class UserTeamClubEntityConfiguration : IEntityTypeConfiguration<UserTeamClub>
    {
        public void Configure(EntityTypeBuilder<UserTeamClub> builder)
        {
            builder.HasNoKey();
            builder.ToTable(table => table.ExcludeFromMigrations());

            builder.ToSqlQuery("""
                SELECT ut."ApplicationUserId", t."ClubId"
                FROM app."UserTeams" ut
                INNER JOIN app."Teams" t ON t."Id" = ut."TeamId"
                """);
        }
    }
}
