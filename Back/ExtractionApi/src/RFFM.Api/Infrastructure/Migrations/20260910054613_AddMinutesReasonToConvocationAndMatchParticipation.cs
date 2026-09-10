using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddMinutesReasonToConvocationAndMatchParticipation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "MinutesReason",
                schema: "app",
                table: "MatchParticipations",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MinutesReason",
                schema: "app",
                table: "Convocations",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MinutesReason",
                schema: "app",
                table: "MatchParticipations");

            migrationBuilder.DropColumn(
                name: "MinutesReason",
                schema: "app",
                table: "Convocations");
        }
    }
}
