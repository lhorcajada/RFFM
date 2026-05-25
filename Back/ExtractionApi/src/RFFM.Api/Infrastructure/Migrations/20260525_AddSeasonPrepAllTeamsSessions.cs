using Microsoft.EntityFrameworkCore.Migrations;
using RFFM.Api.Infrastructure.Persistence;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    [Microsoft.EntityFrameworkCore.Infrastructure.DbContext(typeof(AppDbContext))]
    [Migration("20260525_AddSeasonPrepAllTeamsSessions")]
    public partial class AddSeasonPrepAllTeamsSessions : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS app.""SeasonPrepAllTeamsSessions"" (
                    ""Id""        character varying(50)  NOT NULL,
                    ""SportEventId"" character varying(50),
                    ""Data""      text                   NOT NULL,
                    ""UpdatedAt"" timestamp with time zone NOT NULL,
                    CONSTRAINT ""PK_SeasonPrepAllTeamsSessions"" PRIMARY KEY (""Id"")
                );
            ");

            migrationBuilder.Sql(@"CREATE UNIQUE INDEX IF NOT EXISTS ""IX_SeasonPrepAllTeamsSessions_SportEventId"" ON app.""SeasonPrepAllTeamsSessions"" (""SportEventId"");");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"DROP TABLE IF EXISTS app.""SeasonPrepAllTeamsSessions"";");
        }
    }
}
