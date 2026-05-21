using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTotalGoalsToSeasonAccess : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "TotalGoals",
                schema: "app",
                table: "SeasonAccessTrialPlayers",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TotalGoals",
                schema: "app",
                table: "SeasonAccessTrialDayRatings",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_SeasonAccessTrialDayRatings_TrialPlayerId",
                schema: "app",
                table: "SeasonAccessTrialDayRatings",
                column: "TrialPlayerId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_SeasonAccessTrialDayRatings_TrialPlayerId",
                schema: "app",
                table: "SeasonAccessTrialDayRatings");

            migrationBuilder.DropColumn(
                name: "TotalGoals",
                schema: "app",
                table: "SeasonAccessTrialPlayers");

            migrationBuilder.DropColumn(
                name: "TotalGoals",
                schema: "app",
                table: "SeasonAccessTrialDayRatings");
        }
    }
}
