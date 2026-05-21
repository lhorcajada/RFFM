using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSeasonAccessTrials : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SeasonAccessTrials",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    ApplicationUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    SeasonId = table.Column<string>(type: "text", nullable: false),
                    Category = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SeasonAccessTrials", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SeasonAccessTrialPlayers",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    TrialId = table.Column<string>(type: "text", nullable: false),
                    FederationPlayerCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    PlayerName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    TeamCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    TeamName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Category = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    BirthYear = table.Column<int>(type: "integer", nullable: true),
                    IdealDemarcationId = table.Column<int>(type: "integer", nullable: true),
                    PossibleDemarcationIds = table.Column<int[]>(type: "integer[]", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SeasonAccessTrialPlayers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SeasonAccessTrialPlayers_SeasonAccessTrials_TrialId",
                        column: x => x.TrialId,
                        principalSchema: "app",
                        principalTable: "SeasonAccessTrials",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SeasonAccessTrialPlayers_IdealDemarcationId",
                schema: "app",
                table: "SeasonAccessTrialPlayers",
                column: "IdealDemarcationId");

            migrationBuilder.CreateIndex(
                name: "IX_SeasonAccessTrialPlayers_TrialId_FederationPlayerCode",
                schema: "app",
                table: "SeasonAccessTrialPlayers",
                columns: new[] { "TrialId", "FederationPlayerCode" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SeasonAccessTrials_ApplicationUserId_SeasonId_Category",
                schema: "app",
                table: "SeasonAccessTrials",
                columns: new[] { "ApplicationUserId", "SeasonId", "Category" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SeasonAccessTrialPlayers",
                schema: "app");

            migrationBuilder.DropTable(
                name: "SeasonAccessTrials",
                schema: "app");
        }
    }
}
