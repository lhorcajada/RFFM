using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTeamPlayerSanctions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TeamPlayerSanctions",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    TeamPlayerId = table.Column<string>(type: "text", nullable: false),
                    Category = table.Column<int>(type: "integer", nullable: false),
                    StartDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    SanctionType = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    EstimatedEnd = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    EndDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TeamPlayerSanctions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TeamPlayerSanctions_TeamPlayers_TeamPlayerId",
                        column: x => x.TeamPlayerId,
                        principalSchema: "app",
                        principalTable: "TeamPlayers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TeamPlayerSanctions_TeamPlayerId",
                schema: "app",
                table: "TeamPlayerSanctions",
                column: "TeamPlayerId");

            migrationBuilder.CreateIndex(
                name: "IX_TeamPlayerSanctions_TeamPlayerId_EndDate",
                schema: "app",
                table: "TeamPlayerSanctions",
                columns: new[] { "TeamPlayerId", "EndDate" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TeamPlayerSanctions",
                schema: "app");
        }
    }
}
