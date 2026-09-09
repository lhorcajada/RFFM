using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTeamPlayerCondition : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TeamPlayerConditions",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    TeamPlayerId = table.Column<string>(type: "text", nullable: false),
                    PhysicalFitness = table.Column<double>(type: "double precision", nullable: false),
                    Fatigue = table.Column<double>(type: "double precision", nullable: false),
                    LastCalculatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TeamPlayerConditions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TeamPlayerConditions_TeamPlayers_TeamPlayerId",
                        column: x => x.TeamPlayerId,
                        principalSchema: "app",
                        principalTable: "TeamPlayers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TeamPlayerConditions_TeamPlayerId",
                schema: "app",
                table: "TeamPlayerConditions",
                column: "TeamPlayerId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TeamPlayerConditions",
                schema: "app");
        }
    }
}
