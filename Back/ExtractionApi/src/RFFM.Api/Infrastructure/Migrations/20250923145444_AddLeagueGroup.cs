using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddLeagueGroup : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "LeagueGroup",
                schema: "app",
                table: "Teams",
                type: "int",
                nullable: true);

        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_SportEvents_SportEventTypes_EventTypeId",
                schema: "app",
                table: "SportEvents");

            migrationBuilder.DropForeignKey(
                name: "FK_SportEvents_Teams_TeamId",
                schema: "app",
                table: "SportEvents");

            migrationBuilder.DropColumn(
                name: "LeagueGroup",
                schema: "app",
                table: "Teams");

            migrationBuilder.AddForeignKey(
                name: "FK_SportEvents_SportEventTypes_EventTypeId",
                schema: "app",
                table: "SportEvents",
                column: "EventTypeId",
                principalSchema: "app",
                principalTable: "SportEventTypes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_SportEvents_Teams_TeamId",
                schema: "app",
                table: "SportEvents",
                column: "TeamId",
                principalSchema: "app",
                principalTable: "Teams",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
