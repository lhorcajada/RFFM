using Microsoft.EntityFrameworkCore.Migrations;
using RFFM.Api.Infrastructure.Persistence;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    [Microsoft.EntityFrameworkCore.Infrastructure.DbContext(typeof(AppDbContext))]
    [Migration("20260709120000_AddUserTeam")]
    public partial class AddUserTeam : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS app.""UserTeams"" (
                    ""Id"" text NOT NULL,
                    ""ApplicationUserId"" character varying(450) NOT NULL,
                    ""TeamId"" text NOT NULL,
                    ""RoleId"" integer NOT NULL,
                    ""IsCreator"" boolean NOT NULL,
                    ""JoinedAt"" timestamp without time zone NOT NULL,
                    CONSTRAINT ""PK_UserTeams"" PRIMARY KEY (""Id""),
                    CONSTRAINT ""FK_UserTeams_Teams_TeamId"" FOREIGN KEY (""TeamId"")
                        REFERENCES app.""Teams""(""Id"") ON DELETE CASCADE,
                    CONSTRAINT ""FK_UserTeams_Memberships_RoleId"" FOREIGN KEY (""RoleId"")
                        REFERENCES app.""Memberships""(""Id"") ON DELETE RESTRICT
                );

                CREATE INDEX IF NOT EXISTS ""IX_UserTeams_ApplicationUserId_TeamId""
                    ON app.""UserTeams"" (""ApplicationUserId"", ""TeamId"");
                CREATE INDEX IF NOT EXISTS ""IX_UserTeams_ApplicationUserId""
                    ON app.""UserTeams"" (""ApplicationUserId"");
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"DROP TABLE IF EXISTS app.""UserTeams"";");
        }
    }
}