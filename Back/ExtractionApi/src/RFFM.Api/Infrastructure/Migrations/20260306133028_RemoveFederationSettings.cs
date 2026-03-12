using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RemoveFederationSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FederationSettings",
                schema: "app");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "FederationSettings",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    CompetitionId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    CompetitionName = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    CreatedAt = table.Column<long>(type: "bigint", nullable: false),
                    GroupId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    GroupName = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    IsPrimary = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    TeamId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    TeamName = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    UserId = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FederationSettings", x => x.Id);
                });

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
