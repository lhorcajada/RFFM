using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddQuinielaTeamSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "QuinielaTeamSettings",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    TeamId = table.Column<string>(type: "text", nullable: false),
                    FundPercent = table.Column<decimal>(type: "numeric(5,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuinielaTeamSettings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_QuinielaTeamSettings_Teams_TeamId",
                        column: x => x.TeamId,
                        principalSchema: "app",
                        principalTable: "Teams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_QuinielaTeamSettings_TeamId",
                schema: "app",
                table: "QuinielaTeamSettings",
                column: "TeamId",
                unique: true);

            // El fondo por defecto pasa a ser 0 %: las jornadas ya abiertas (Status 1) reparten el 100 % de lo cobrado.
            migrationBuilder.Sql("""UPDATE app."QuinielaJornadas" SET "PrizePercent" = 100 WHERE "Status" = 1;""");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "QuinielaTeamSettings",
                schema: "app");
        }
    }
}
