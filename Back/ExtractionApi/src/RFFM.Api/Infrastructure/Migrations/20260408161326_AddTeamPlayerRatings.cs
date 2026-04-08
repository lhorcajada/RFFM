using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTeamPlayerRatings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TeamPlayerRatings",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    TeamPlayerId = table.Column<string>(type: "text", nullable: false),
                    Technical = table.Column<byte>(type: "smallint", nullable: false),
                    Tactical = table.Column<byte>(type: "smallint", nullable: false),
                    Physical = table.Column<byte>(type: "smallint", nullable: false),
                    Competitiveness = table.Column<byte>(type: "smallint", nullable: false),
                    RatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TeamPlayerRatings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TeamPlayerRatings_TeamPlayers_TeamPlayerId",
                        column: x => x.TeamPlayerId,
                        principalSchema: "app",
                        principalTable: "TeamPlayers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TeamPlayerRatings_RatedAt",
                schema: "app",
                table: "TeamPlayerRatings",
                column: "RatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_TeamPlayerRatings_TeamPlayerId",
                schema: "app",
                table: "TeamPlayerRatings",
                column: "TeamPlayerId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TeamPlayerRatings",
                schema: "app");
        }
    }
}
