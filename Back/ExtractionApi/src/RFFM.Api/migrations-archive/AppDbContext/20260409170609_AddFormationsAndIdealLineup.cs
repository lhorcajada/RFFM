using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.migrationsarchive.AppDbContext
{
    /// <inheritdoc />
    public partial class AddFormationsAndIdealLineup : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Formations",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    Name = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Description = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Formations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TeamIdealLineups",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    TeamId = table.Column<string>(type: "text", nullable: false),
                    SeasonId = table.Column<string>(type: "text", nullable: false),
                    FormationId = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TeamIdealLineups", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TeamIdealLineups_Formations_FormationId",
                        column: x => x.FormationId,
                        principalSchema: "app",
                        principalTable: "Formations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "TeamIdealLineupSlots",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    LineupId = table.Column<string>(type: "text", nullable: false),
                    SlotIndex = table.Column<int>(type: "integer", nullable: false),
                    TeamPlayerId = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TeamIdealLineupSlots", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TeamIdealLineupSlots_TeamIdealLineups_LineupId",
                        column: x => x.LineupId,
                        principalSchema: "app",
                        principalTable: "TeamIdealLineups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Formations_Name",
                schema: "app",
                table: "Formations",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TeamIdealLineups_FormationId",
                schema: "app",
                table: "TeamIdealLineups",
                column: "FormationId");

            migrationBuilder.CreateIndex(
                name: "IX_TeamIdealLineups_TeamId_SeasonId",
                schema: "app",
                table: "TeamIdealLineups",
                columns: new[] { "TeamId", "SeasonId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TeamIdealLineupSlots_LineupId_SlotIndex",
                schema: "app",
                table: "TeamIdealLineupSlots",
                columns: new[] { "LineupId", "SlotIndex" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TeamIdealLineupSlots_TeamPlayerId",
                schema: "app",
                table: "TeamIdealLineupSlots",
                column: "TeamPlayerId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TeamIdealLineupSlots",
                schema: "app");

            migrationBuilder.DropTable(
                name: "TeamIdealLineups",
                schema: "app");

            migrationBuilder.DropTable(
                name: "Formations",
                schema: "app");
        }
    }
}
