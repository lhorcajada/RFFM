using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddClubKitsAndSportEventSelectedKit : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "SelectedKitNumber",
                schema: "app",
                table: "SportEvents",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ClubKits",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    ClubId = table.Column<string>(type: "text", nullable: false),
                    SeasonId = table.Column<string>(type: "text", nullable: false),
                    KitNumber = table.Column<int>(type: "integer", nullable: false),
                    ShirtColor = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: false),
                    ShortsColor = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: false),
                    SocksColor = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClubKits", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ClubKits_Clubs_ClubId",
                        column: x => x.ClubId,
                        principalSchema: "app",
                        principalTable: "Clubs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ClubKits_Seasons_SeasonId",
                        column: x => x.SeasonId,
                        principalSchema: "app",
                        principalTable: "Seasons",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ClubKits_ClubId_SeasonId_KitNumber",
                schema: "app",
                table: "ClubKits",
                columns: new[] { "ClubId", "SeasonId", "KitNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ClubKits_SeasonId",
                schema: "app",
                table: "ClubKits",
                column: "SeasonId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ClubKits",
                schema: "app");

            migrationBuilder.DropColumn(
                name: "SelectedKitNumber",
                schema: "app",
                table: "SportEvents");
        }
    }
}
