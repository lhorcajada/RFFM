using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddRffmCompetitionAndGroupToTeam : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "RffmCompetitionId",
                schema: "app",
                table: "Teams",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RffmGroupId",
                schema: "app",
                table: "Teams",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RffmCompetitionId",
                schema: "app",
                table: "Teams");

            migrationBuilder.DropColumn(
                name: "RffmGroupId",
                schema: "app",
                table: "Teams");
        }
    }
}
