using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RemoveUserIdFromFederationSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_FederationSettings_UserId",
                schema: "app",
                table: "FederationSettings");

            migrationBuilder.DropIndex(
                name: "IX_FederationSettings_UserId_IsPrimary",
                schema: "app",
                table: "FederationSettings");

            migrationBuilder.DropColumn(
                name: "UserId",
                schema: "app",
                table: "FederationSettings");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "UserId",
                schema: "app",
                table: "FederationSettings",
                type: "nvarchar(450)",
                maxLength: 450,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_FederationSettings_UserId",
                schema: "app",
                table: "FederationSettings",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_FederationSettings_UserId_IsPrimary",
                schema: "app",
                table: "FederationSettings",
                columns: new[] { "UserId", "IsPrimary" });
        }
    }
}
