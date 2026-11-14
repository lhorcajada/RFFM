using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTeamPlayerTraitRatings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TeamPlayerTraitRatings",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    TeamPlayerId = table.Column<string>(type: "text", nullable: false),
                    RatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Trend = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false, defaultValue: "same")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TeamPlayerTraitRatings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TeamPlayerTraitRatings_TeamPlayers_TeamPlayerId",
                        column: x => x.TeamPlayerId,
                        principalSchema: "app",
                        principalTable: "TeamPlayers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TeamPlayerTraitRatingLevels",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    RatingId = table.Column<string>(type: "text", nullable: false),
                    TraitKey = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Level = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TeamPlayerTraitRatingLevels", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TeamPlayerTraitRatingLevels_TeamPlayerTraitRatings_RatingId",
                        column: x => x.RatingId,
                        principalSchema: "app",
                        principalTable: "TeamPlayerTraitRatings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TeamPlayerTraitRatingLevels_RatingId_TraitKey",
                schema: "app",
                table: "TeamPlayerTraitRatingLevels",
                columns: new[] { "RatingId", "TraitKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TeamPlayerTraitRatings_TeamPlayerId_RatedAt",
                schema: "app",
                table: "TeamPlayerTraitRatings",
                columns: new[] { "TeamPlayerId", "RatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TeamPlayerTraitRatingLevels",
                schema: "app");

            migrationBuilder.DropTable(
                name: "TeamPlayerTraitRatings",
                schema: "app");
        }
    }
}
