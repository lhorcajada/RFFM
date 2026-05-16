using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSeasonPrepPlayerRatings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SeasonPrepPlayerRatings",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    UserId = table.Column<string>(type: "text", nullable: false),
                    FedSeason = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    SeasonPrepPlayerId = table.Column<string>(type: "text", nullable: false),
                    Technical = table.Column<decimal>(type: "numeric(5,1)", nullable: false),
                    Tactical = table.Column<decimal>(type: "numeric(5,1)", nullable: false),
                    Physical = table.Column<decimal>(type: "numeric(5,1)", nullable: false),
                    Competitiveness = table.Column<decimal>(type: "numeric(5,1)", nullable: false),
                    PhysicalSpeed = table.Column<decimal>(type: "numeric(5,1)", nullable: true),
                    PhysicalEndurance = table.Column<decimal>(type: "numeric(5,1)", nullable: true),
                    PhysicalStrength = table.Column<decimal>(type: "numeric(5,1)", nullable: true),
                    TechnicalDribbling = table.Column<decimal>(type: "numeric(5,1)", nullable: true),
                    TechnicalPassing = table.Column<decimal>(type: "numeric(5,1)", nullable: true),
                    TechnicalControl = table.Column<decimal>(type: "numeric(5,1)", nullable: true),
                    TechnicalShooting = table.Column<decimal>(type: "numeric(5,1)", nullable: true),
                    TechnicalTackling = table.Column<decimal>(type: "numeric(5,1)", nullable: true),
                    TechnicalInterceptions = table.Column<decimal>(type: "numeric(5,1)", nullable: true),
                    TechnicalHeading = table.Column<decimal>(type: "numeric(5,1)", nullable: true),
                    TacticalDefensiveAwareness = table.Column<decimal>(type: "numeric(5,1)", nullable: true),
                    TacticalMarking = table.Column<decimal>(type: "numeric(5,1)", nullable: true),
                    TacticalTrackBack = table.Column<decimal>(type: "numeric(5,1)", nullable: true),
                    TacticalPressing = table.Column<decimal>(type: "numeric(5,1)", nullable: true),
                    TacticalGeneratesAdvantage = table.Column<decimal>(type: "numeric(5,1)", nullable: true),
                    TacticalOffMovement = table.Column<decimal>(type: "numeric(5,1)", nullable: true),
                    TacticalBeatsOpponents = table.Column<decimal>(type: "numeric(5,1)", nullable: true),
                    TacticalAttackParticipation = table.Column<decimal>(type: "numeric(5,1)", nullable: true),
                    CompetDuelWinning = table.Column<decimal>(type: "numeric(5,1)", nullable: true),
                    CompetLooseBalls = table.Column<decimal>(type: "numeric(5,1)", nullable: true),
                    CompetRecoveries = table.Column<decimal>(type: "numeric(5,1)", nullable: true),
                    CompetDecisiveActions = table.Column<decimal>(type: "numeric(5,1)", nullable: true),
                    CompetResponsibility = table.Column<decimal>(type: "numeric(5,1)", nullable: true),
                    CompetConstantEffort = table.Column<decimal>(type: "numeric(5,1)", nullable: true),
                    IsGoalkeeper = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    RatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SeasonPrepPlayerRatings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SeasonPrepPlayerRatingDetails",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    RatingId = table.Column<string>(type: "text", nullable: false),
                    CharacteristicKey = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    CategoryKey = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Level = table.Column<int>(type: "integer", nullable: false),
                    Concept = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SeasonPrepPlayerRatingDetails", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SeasonPrepPlayerRatingDetails_SeasonPrepPlayerRatings_Ratin~",
                        column: x => x.RatingId,
                        principalSchema: "app",
                        principalTable: "SeasonPrepPlayerRatings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SeasonPrepPlayerRatingDetails_RatingId",
                schema: "app",
                table: "SeasonPrepPlayerRatingDetails",
                column: "RatingId");

            migrationBuilder.CreateIndex(
                name: "IX_SeasonPrepPlayerRatingDetails_RatingId_CharacteristicKey",
                schema: "app",
                table: "SeasonPrepPlayerRatingDetails",
                columns: new[] { "RatingId", "CharacteristicKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SeasonPrepPlayerRatings_RatedAt",
                schema: "app",
                table: "SeasonPrepPlayerRatings",
                column: "RatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_SeasonPrepPlayerRatings_UserId_FedSeason_SeasonPrepPlayerId",
                schema: "app",
                table: "SeasonPrepPlayerRatings",
                columns: new[] { "UserId", "FedSeason", "SeasonPrepPlayerId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SeasonPrepPlayerRatingDetails",
                schema: "app");

            migrationBuilder.DropTable(
                name: "SeasonPrepPlayerRatings",
                schema: "app");
        }
    }
}
