using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPreferredTeamToSeason : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PreferredTeamId",
                schema: "app",
                table: "Seasons",
                type: "character varying(450)",
                maxLength: 450,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PreferredTeamId1",
                schema: "app",
                table: "Seasons",
                type: "text",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Seasons_PreferredTeamId",
                schema: "app",
                table: "Seasons",
                column: "PreferredTeamId");

            migrationBuilder.CreateIndex(
                name: "IX_Seasons_PreferredTeamId1",
                schema: "app",
                table: "Seasons",
                column: "PreferredTeamId1");

            migrationBuilder.AddForeignKey(
                name: "FK_Seasons_Teams_PreferredTeamId",
                schema: "app",
                table: "Seasons",
                column: "PreferredTeamId",
                principalSchema: "app",
                principalTable: "Teams",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Seasons_Teams_PreferredTeamId1",
                schema: "app",
                table: "Seasons",
                column: "PreferredTeamId1",
                principalSchema: "app",
                principalTable: "Teams",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Seasons_Teams_PreferredTeamId",
                schema: "app",
                table: "Seasons");

            migrationBuilder.DropForeignKey(
                name: "FK_Seasons_Teams_PreferredTeamId1",
                schema: "app",
                table: "Seasons");

            migrationBuilder.DropIndex(
                name: "IX_Seasons_PreferredTeamId",
                schema: "app",
                table: "Seasons");

            migrationBuilder.DropIndex(
                name: "IX_Seasons_PreferredTeamId1",
                schema: "app",
                table: "Seasons");

            migrationBuilder.DropColumn(
                name: "PreferredTeamId",
                schema: "app",
                table: "Seasons");

            migrationBuilder.DropColumn(
                name: "PreferredTeamId1",
                schema: "app",
                table: "Seasons");
        }
    }
}
