using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class UpdateTeamPlayer_FamilyMembers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropPrimaryKey(
                name: "PK_TeamPlayerFamilies",
                schema: "app",
                table: "TeamPlayerFamilies");

            migrationBuilder.AddColumn<string>(
                name: "Id",
                schema: "app",
                table: "TeamPlayerFamilies",
                type: "nvarchar(450)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Address_Id",
                schema: "app",
                table: "TeamPlayerFamilies",
                type: "nvarchar(450)",
                nullable: true);

            migrationBuilder.AddPrimaryKey(
                name: "PK_TeamPlayerFamilies",
                schema: "app",
                table: "TeamPlayerFamilies",
                column: "Id");

            migrationBuilder.CreateIndex(
                name: "IX_TeamPlayerFamilies_TeamPlayerId",
                schema: "app",
                table: "TeamPlayerFamilies",
                column: "TeamPlayerId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropPrimaryKey(
                name: "PK_TeamPlayerFamilies",
                schema: "app",
                table: "TeamPlayerFamilies");

            migrationBuilder.DropIndex(
                name: "IX_TeamPlayerFamilies_TeamPlayerId",
                schema: "app",
                table: "TeamPlayerFamilies");

            migrationBuilder.DropColumn(
                name: "Id",
                schema: "app",
                table: "TeamPlayerFamilies");

            migrationBuilder.DropColumn(
                name: "Address_Id",
                schema: "app",
                table: "TeamPlayerFamilies");

            migrationBuilder.AddPrimaryKey(
                name: "PK_TeamPlayerFamilies",
                schema: "app",
                table: "TeamPlayerFamilies",
                column: "TeamPlayerId");
        }
    }
}
