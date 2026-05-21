using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDemarcationsToTrialDayRatings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "IdealDemarcationId",
                schema: "app",
                table: "SeasonAccessTrialDayRatings",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int[]>(
                name: "PossibleDemarcationIds",
                schema: "app",
                table: "SeasonAccessTrialDayRatings",
                type: "integer[]",
                nullable: false,
                defaultValue: new int[0]);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IdealDemarcationId",
                schema: "app",
                table: "SeasonAccessTrialDayRatings");

            migrationBuilder.DropColumn(
                name: "PossibleDemarcationIds",
                schema: "app",
                table: "SeasonAccessTrialDayRatings");
        }
    }
}
