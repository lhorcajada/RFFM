using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations.Federation
{
    /// <inheritdoc />
    public partial class AddRffmStandings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "OfficialStandingsJson",
                schema: "federation",
                table: "RffmCompetitionGroups",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OfficialStandingsRound",
                schema: "federation",
                table: "RffmCompetitionGroups",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PointsDraw",
                schema: "federation",
                table: "RffmCompetitionGroups",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "PointsLoss",
                schema: "federation",
                table: "RffmCompetitionGroups",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "PointsWin",
                schema: "federation",
                table: "RffmCompetitionGroups",
                type: "integer",
                nullable: false,
                defaultValue: 3);

            migrationBuilder.AddColumn<int>(
                name: "StandingsRound",
                schema: "federation",
                table: "RffmCompetitionGroups",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "RffmStandingsSnapshots",
                schema: "federation",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    GroupCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Round = table.Column<int>(type: "integer", nullable: false),
                    PayloadJson = table.Column<string>(type: "jsonb", nullable: false),
                    Source = table.Column<int>(type: "integer", nullable: false),
                    ComputedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RffmStandingsSnapshots", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RffmStandingsSnapshots_GroupCode_Round",
                schema: "federation",
                table: "RffmStandingsSnapshots",
                columns: new[] { "GroupCode", "Round" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RffmStandingsSnapshots",
                schema: "federation");

            migrationBuilder.DropColumn(
                name: "OfficialStandingsJson",
                schema: "federation",
                table: "RffmCompetitionGroups");

            migrationBuilder.DropColumn(
                name: "OfficialStandingsRound",
                schema: "federation",
                table: "RffmCompetitionGroups");

            migrationBuilder.DropColumn(
                name: "PointsDraw",
                schema: "federation",
                table: "RffmCompetitionGroups");

            migrationBuilder.DropColumn(
                name: "PointsLoss",
                schema: "federation",
                table: "RffmCompetitionGroups");

            migrationBuilder.DropColumn(
                name: "PointsWin",
                schema: "federation",
                table: "RffmCompetitionGroups");

            migrationBuilder.DropColumn(
                name: "StandingsRound",
                schema: "federation",
                table: "RffmCompetitionGroups");
        }
    }
}
