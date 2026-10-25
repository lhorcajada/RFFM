using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddStandingSpotsToTeam : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "PlayoffSpots",
                schema: "app",
                table: "Teams",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PromotionSpots",
                schema: "app",
                table: "Teams",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RelegationSpots",
                schema: "app",
                table: "Teams",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PlayoffSpots",
                schema: "app",
                table: "Teams");

            migrationBuilder.DropColumn(
                name: "PromotionSpots",
                schema: "app",
                table: "Teams");

            migrationBuilder.DropColumn(
                name: "RelegationSpots",
                schema: "app",
                table: "Teams");
        }
    }
}
