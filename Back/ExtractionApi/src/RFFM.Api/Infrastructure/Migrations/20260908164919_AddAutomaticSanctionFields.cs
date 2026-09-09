using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAutomaticSanctionFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "Fine",
                schema: "app",
                table: "TeamPlayerSanctions",
                type: "numeric(10,2)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsAutomatic",
                schema: "app",
                table: "TeamPlayerSanctions",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "SourceEventId",
                schema: "app",
                table: "TeamPlayerSanctions",
                type: "character varying(450)",
                maxLength: 450,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_TeamPlayerSanctions_TeamPlayerId_IsAutomatic_EndDate",
                schema: "app",
                table: "TeamPlayerSanctions",
                columns: new[] { "TeamPlayerId", "IsAutomatic", "EndDate" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_TeamPlayerSanctions_TeamPlayerId_IsAutomatic_EndDate",
                schema: "app",
                table: "TeamPlayerSanctions");

            migrationBuilder.DropColumn(
                name: "Fine",
                schema: "app",
                table: "TeamPlayerSanctions");

            migrationBuilder.DropColumn(
                name: "IsAutomatic",
                schema: "app",
                table: "TeamPlayerSanctions");

            migrationBuilder.DropColumn(
                name: "SourceEventId",
                schema: "app",
                table: "TeamPlayerSanctions");
        }
    }
}
