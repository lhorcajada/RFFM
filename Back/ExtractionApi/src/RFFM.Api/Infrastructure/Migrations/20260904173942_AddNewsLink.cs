using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddNewsLink : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "LinkType",
                schema: "app",
                table: "News",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<string>(
                name: "LinkUrl",
                schema: "app",
                table: "News",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LinkedEventId",
                schema: "app",
                table: "News",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LinkedTeamId",
                schema: "app",
                table: "News",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LinkType",
                schema: "app",
                table: "News");

            migrationBuilder.DropColumn(
                name: "LinkUrl",
                schema: "app",
                table: "News");

            migrationBuilder.DropColumn(
                name: "LinkedEventId",
                schema: "app",
                table: "News");

            migrationBuilder.DropColumn(
                name: "LinkedTeamId",
                schema: "app",
                table: "News");
        }
    }
}
