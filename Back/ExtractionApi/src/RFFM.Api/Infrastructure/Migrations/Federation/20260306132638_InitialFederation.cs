using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations.Federation
{
    /// <inheritdoc />
    public partial class InitialFederation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "FederationSettings",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    UserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    CompetitionId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    CompetitionName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    GroupId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    GroupName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    TeamId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    TeamName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    CreatedAt = table.Column<long>(type: "bigint", nullable: false),
                    IsPrimary = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FederationSettings", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FederationSettings_UserId",
                table: "FederationSettings",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_FederationSettings_UserId_IsPrimary",
                table: "FederationSettings",
                columns: new[] { "UserId", "IsPrimary" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FederationSettings");
        }
    }
}
