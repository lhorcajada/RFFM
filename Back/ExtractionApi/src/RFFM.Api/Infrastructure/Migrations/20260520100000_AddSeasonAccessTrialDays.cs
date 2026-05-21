using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSeasonAccessTrialDays : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SeasonAccessTrialDays",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    TrialId = table.Column<string>(type: "text", nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    Label = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SeasonAccessTrialDays", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SeasonAccessTrialDays_SeasonAccessTrials_TrialId",
                        column: x => x.TrialId,
                        principalSchema: "app",
                        principalTable: "SeasonAccessTrials",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SeasonAccessTrialDayRatings",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    TrialDayId = table.Column<string>(type: "text", nullable: false),
                    TrialPlayerId = table.Column<string>(type: "text", nullable: false),
                    Score = table.Column<decimal>(type: "numeric(5,2)", nullable: true),
                    Notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SeasonAccessTrialDayRatings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SeasonAccessTrialDayRatings_SeasonAccessTrialDays_TrialDayId",
                        column: x => x.TrialDayId,
                        principalSchema: "app",
                        principalTable: "SeasonAccessTrialDays",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SeasonAccessTrialDayRatings_SeasonAccessTrialPlayers_TrialPlayerId",
                        column: x => x.TrialPlayerId,
                        principalSchema: "app",
                        principalTable: "SeasonAccessTrialPlayers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SeasonAccessTrialDayRatings_TrialDayId_TrialPlayerId",
                schema: "app",
                table: "SeasonAccessTrialDayRatings",
                columns: new[] { "TrialDayId", "TrialPlayerId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SeasonAccessTrialDays_TrialId",
                schema: "app",
                table: "SeasonAccessTrialDays",
                column: "TrialId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SeasonAccessTrialDayRatings",
                schema: "app");

            migrationBuilder.DropTable(
                name: "SeasonAccessTrialDays",
                schema: "app");
        }
    }
}
