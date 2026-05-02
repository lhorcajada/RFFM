using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTeamJoinCode : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "JoinCode",
                schema: "app",
                table: "Teams",
                type: "character varying(8)",
                maxLength: 8,
                nullable: false,
                defaultValue: "");

            // Backfill unique codes for any teams that exist before this migration
            migrationBuilder.Sql(@"
                DO $$
                DECLARE
                    r RECORD;
                    new_code TEXT;
                    attempts INT;
                BEGIN
                    FOR r IN SELECT ""Id"" FROM app.""Teams"" WHERE ""JoinCode"" = '' LOOP
                        attempts := 0;
                        LOOP
                            new_code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT || r.""Id""), 1, 8));
                            EXIT WHEN NOT EXISTS (SELECT 1 FROM app.""Teams"" WHERE ""JoinCode"" = new_code);
                            attempts := attempts + 1;
                            IF attempts > 100 THEN RAISE EXCEPTION 'Could not generate unique JoinCode'; END IF;
                        END LOOP;
                        UPDATE app.""Teams"" SET ""JoinCode"" = new_code WHERE ""Id"" = r.""Id"";
                    END LOOP;
                END $$;
            ");

            migrationBuilder.CreateIndex(
                name: "IX_Teams_JoinCode",
                schema: "app",
                table: "Teams",
                column: "JoinCode",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Teams_JoinCode",
                schema: "app",
                table: "Teams");

            migrationBuilder.DropColumn(
                name: "JoinCode",
                schema: "app",
                table: "Teams");
        }
    }
}
