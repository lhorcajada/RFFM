using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations.Federation
{
    /// <inheritdoc />
    public partial class AddSquadHistoryCandidateFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CandidateSearchNote",
                schema: "federation",
                table: "SquadHistoryReports",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsCandidateSquad",
                schema: "federation",
                table: "SquadHistoryReports",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "BirthYear",
                schema: "federation",
                table: "SquadHistoryEntries",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OriginTeamName",
                schema: "federation",
                table: "SquadHistoryEntries",
                type: "character varying(256)",
                maxLength: 256,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CandidateSearchNote",
                schema: "federation",
                table: "SquadHistoryReports");

            migrationBuilder.DropColumn(
                name: "IsCandidateSquad",
                schema: "federation",
                table: "SquadHistoryReports");

            migrationBuilder.DropColumn(
                name: "BirthYear",
                schema: "federation",
                table: "SquadHistoryEntries");

            migrationBuilder.DropColumn(
                name: "OriginTeamName",
                schema: "federation",
                table: "SquadHistoryEntries");
        }
    }
}
