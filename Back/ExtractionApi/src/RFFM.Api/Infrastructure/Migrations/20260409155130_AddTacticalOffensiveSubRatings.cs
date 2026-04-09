using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTacticalOffensiveSubRatings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "TacticalLooseBalls",
                schema: "app",
                table: "TeamPlayerRatings",
                newName: "TacticalOffMovement");

            migrationBuilder.AddColumn<decimal>(
                name: "TacticalAttackParticipation",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(5,1)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "TacticalBeatsOpponents",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(5,1)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "TacticalGeneratesAdvantage",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(5,1)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TacticalAttackParticipation",
                schema: "app",
                table: "TeamPlayerRatings");

            migrationBuilder.DropColumn(
                name: "TacticalBeatsOpponents",
                schema: "app",
                table: "TeamPlayerRatings");

            migrationBuilder.DropColumn(
                name: "TacticalGeneratesAdvantage",
                schema: "app",
                table: "TeamPlayerRatings");

            migrationBuilder.RenameColumn(
                name: "TacticalOffMovement",
                schema: "app",
                table: "TeamPlayerRatings",
                newName: "TacticalLooseBalls");
        }
    }
}
