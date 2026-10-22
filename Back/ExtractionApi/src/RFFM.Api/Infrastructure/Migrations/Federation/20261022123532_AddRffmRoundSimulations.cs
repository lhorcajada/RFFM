using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations.Federation
{
    /// <inheritdoc />
    public partial class AddRffmRoundSimulations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "RffmRoundSimulations",
                schema: "federation",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    GroupCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    SeasonId = table.Column<int>(type: "integer", nullable: false),
                    Round = table.Column<int>(type: "integer", nullable: false),
                    PlayedMatchesUsed = table.Column<int>(type: "integer", nullable: false),
                    UsesSquadStrength = table.Column<bool>(type: "boolean", nullable: false),
                    MatchesJson = table.Column<string>(type: "jsonb", nullable: false),
                    StandingsJson = table.Column<string>(type: "jsonb", nullable: false),
                    ComputedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    FrozenAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RffmRoundSimulations", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RffmRoundSimulations_GroupCode_Round",
                schema: "federation",
                table: "RffmRoundSimulations",
                columns: new[] { "GroupCode", "Round" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RffmRoundSimulations",
                schema: "federation");
        }
    }
}
