using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddGameScenarioMedia : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "MediaType",
                schema: "app",
                table: "GameScenarios",
                type: "character varying(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MediaUrl",
                schema: "app",
                table: "GameScenarios",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MediaType",
                schema: "app",
                table: "GameScenarios");

            migrationBuilder.DropColumn(
                name: "MediaUrl",
                schema: "app",
                table: "GameScenarios");
        }
    }
}
