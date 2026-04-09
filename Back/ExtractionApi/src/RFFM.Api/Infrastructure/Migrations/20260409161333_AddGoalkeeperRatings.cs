using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddGoalkeeperRatings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsGoalkeeper",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "KeeperAerialPlay",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(5,1)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "KeeperAgility",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(5,1)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "KeeperBackCoverage",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(5,1)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "KeeperBuildupPlay",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(5,1)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "KeeperConcentration",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(5,1)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "KeeperConsistency",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(5,1)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "KeeperDefensiveOrganization",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(5,1)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "KeeperEndurance",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(5,1)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "KeeperErrorManagement",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(5,1)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "KeeperFirstTouch",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(5,1)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "KeeperGameReading",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(5,1)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "KeeperHandDistribution",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(5,1)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "KeeperHandSecurity",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(5,1)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "KeeperJumpPower",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(5,1)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "KeeperKeyMoments",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(5,1)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "KeeperKickDistribution",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(5,1)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "KeeperOneOnOne",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(5,1)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "KeeperPlayUnderPressure",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(5,1)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "KeeperPositioning",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(5,1)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "KeeperReactionSpeed",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(5,1)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "KeeperResponsibility",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(5,1)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "KeeperSallyTiming",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(5,1)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "KeeperSaves",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(5,1)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "KeeperStrength",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(5,1)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "KeeperValor",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(5,1)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsGoalkeeper",
                schema: "app",
                table: "TeamPlayerRatings");

            migrationBuilder.DropColumn(
                name: "KeeperAerialPlay",
                schema: "app",
                table: "TeamPlayerRatings");

            migrationBuilder.DropColumn(
                name: "KeeperAgility",
                schema: "app",
                table: "TeamPlayerRatings");

            migrationBuilder.DropColumn(
                name: "KeeperBackCoverage",
                schema: "app",
                table: "TeamPlayerRatings");

            migrationBuilder.DropColumn(
                name: "KeeperBuildupPlay",
                schema: "app",
                table: "TeamPlayerRatings");

            migrationBuilder.DropColumn(
                name: "KeeperConcentration",
                schema: "app",
                table: "TeamPlayerRatings");

            migrationBuilder.DropColumn(
                name: "KeeperConsistency",
                schema: "app",
                table: "TeamPlayerRatings");

            migrationBuilder.DropColumn(
                name: "KeeperDefensiveOrganization",
                schema: "app",
                table: "TeamPlayerRatings");

            migrationBuilder.DropColumn(
                name: "KeeperEndurance",
                schema: "app",
                table: "TeamPlayerRatings");

            migrationBuilder.DropColumn(
                name: "KeeperErrorManagement",
                schema: "app",
                table: "TeamPlayerRatings");

            migrationBuilder.DropColumn(
                name: "KeeperFirstTouch",
                schema: "app",
                table: "TeamPlayerRatings");

            migrationBuilder.DropColumn(
                name: "KeeperGameReading",
                schema: "app",
                table: "TeamPlayerRatings");

            migrationBuilder.DropColumn(
                name: "KeeperHandDistribution",
                schema: "app",
                table: "TeamPlayerRatings");

            migrationBuilder.DropColumn(
                name: "KeeperHandSecurity",
                schema: "app",
                table: "TeamPlayerRatings");

            migrationBuilder.DropColumn(
                name: "KeeperJumpPower",
                schema: "app",
                table: "TeamPlayerRatings");

            migrationBuilder.DropColumn(
                name: "KeeperKeyMoments",
                schema: "app",
                table: "TeamPlayerRatings");

            migrationBuilder.DropColumn(
                name: "KeeperKickDistribution",
                schema: "app",
                table: "TeamPlayerRatings");

            migrationBuilder.DropColumn(
                name: "KeeperOneOnOne",
                schema: "app",
                table: "TeamPlayerRatings");

            migrationBuilder.DropColumn(
                name: "KeeperPlayUnderPressure",
                schema: "app",
                table: "TeamPlayerRatings");

            migrationBuilder.DropColumn(
                name: "KeeperPositioning",
                schema: "app",
                table: "TeamPlayerRatings");

            migrationBuilder.DropColumn(
                name: "KeeperReactionSpeed",
                schema: "app",
                table: "TeamPlayerRatings");

            migrationBuilder.DropColumn(
                name: "KeeperResponsibility",
                schema: "app",
                table: "TeamPlayerRatings");

            migrationBuilder.DropColumn(
                name: "KeeperSallyTiming",
                schema: "app",
                table: "TeamPlayerRatings");

            migrationBuilder.DropColumn(
                name: "KeeperSaves",
                schema: "app",
                table: "TeamPlayerRatings");

            migrationBuilder.DropColumn(
                name: "KeeperStrength",
                schema: "app",
                table: "TeamPlayerRatings");

            migrationBuilder.DropColumn(
                name: "KeeperValor",
                schema: "app",
                table: "TeamPlayerRatings");
        }
    }
}
