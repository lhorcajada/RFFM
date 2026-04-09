using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddRatingSubRatings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "CompetConstantEffort",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(5,1)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "CompetDecisiveActions",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(5,1)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "CompetDuelWinning",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(5,1)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "CompetLooseBalls",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(5,1)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "CompetRecoveries",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(5,1)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "CompetResponsibility",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(5,1)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PhysicalEndurance",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(5,1)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PhysicalSpeed",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(5,1)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PhysicalStrength",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(5,1)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "TacticalDefensiveAwareness",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(5,1)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "TacticalLooseBalls",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(5,1)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "TacticalMarking",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(5,1)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "TacticalPressing",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(5,1)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "TacticalTrackBack",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(5,1)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "TechnicalControl",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(5,1)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "TechnicalDribbling",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(5,1)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "TechnicalHeading",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(5,1)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "TechnicalInterceptions",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(5,1)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "TechnicalPassing",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(5,1)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "TechnicalShooting",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(5,1)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "TechnicalTackling",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(5,1)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CompetConstantEffort",
                schema: "app",
                table: "TeamPlayerRatings");

            migrationBuilder.DropColumn(
                name: "CompetDecisiveActions",
                schema: "app",
                table: "TeamPlayerRatings");

            migrationBuilder.DropColumn(
                name: "CompetDuelWinning",
                schema: "app",
                table: "TeamPlayerRatings");

            migrationBuilder.DropColumn(
                name: "CompetLooseBalls",
                schema: "app",
                table: "TeamPlayerRatings");

            migrationBuilder.DropColumn(
                name: "CompetRecoveries",
                schema: "app",
                table: "TeamPlayerRatings");

            migrationBuilder.DropColumn(
                name: "CompetResponsibility",
                schema: "app",
                table: "TeamPlayerRatings");

            migrationBuilder.DropColumn(
                name: "PhysicalEndurance",
                schema: "app",
                table: "TeamPlayerRatings");

            migrationBuilder.DropColumn(
                name: "PhysicalSpeed",
                schema: "app",
                table: "TeamPlayerRatings");

            migrationBuilder.DropColumn(
                name: "PhysicalStrength",
                schema: "app",
                table: "TeamPlayerRatings");

            migrationBuilder.DropColumn(
                name: "TacticalDefensiveAwareness",
                schema: "app",
                table: "TeamPlayerRatings");

            migrationBuilder.DropColumn(
                name: "TacticalLooseBalls",
                schema: "app",
                table: "TeamPlayerRatings");

            migrationBuilder.DropColumn(
                name: "TacticalMarking",
                schema: "app",
                table: "TeamPlayerRatings");

            migrationBuilder.DropColumn(
                name: "TacticalPressing",
                schema: "app",
                table: "TeamPlayerRatings");

            migrationBuilder.DropColumn(
                name: "TacticalTrackBack",
                schema: "app",
                table: "TeamPlayerRatings");

            migrationBuilder.DropColumn(
                name: "TechnicalControl",
                schema: "app",
                table: "TeamPlayerRatings");

            migrationBuilder.DropColumn(
                name: "TechnicalDribbling",
                schema: "app",
                table: "TeamPlayerRatings");

            migrationBuilder.DropColumn(
                name: "TechnicalHeading",
                schema: "app",
                table: "TeamPlayerRatings");

            migrationBuilder.DropColumn(
                name: "TechnicalInterceptions",
                schema: "app",
                table: "TeamPlayerRatings");

            migrationBuilder.DropColumn(
                name: "TechnicalPassing",
                schema: "app",
                table: "TeamPlayerRatings");

            migrationBuilder.DropColumn(
                name: "TechnicalShooting",
                schema: "app",
                table: "TeamPlayerRatings");

            migrationBuilder.DropColumn(
                name: "TechnicalTackling",
                schema: "app",
                table: "TeamPlayerRatings");
        }
    }
}
