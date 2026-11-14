using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTeamPositionFitOrdersAndWeights : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TeamPositionFitOrders",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    TeamId = table.Column<string>(type: "text", nullable: false),
                    Position = table.Column<int>(type: "integer", nullable: false),
                    WeekStart = table.Column<DateTime>(type: "date", nullable: false),
                    IsManual = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TeamPositionFitOrders", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TeamPositionFitOrders_Teams_TeamId",
                        column: x => x.TeamId,
                        principalSchema: "app",
                        principalTable: "Teams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TeamTraitWeights",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    TeamId = table.Column<string>(type: "text", nullable: false),
                    Position = table.Column<int>(type: "integer", nullable: false),
                    TraitKey = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Weight = table.Column<string>(type: "character varying(15)", maxLength: 15, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TeamTraitWeights", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TeamTraitWeights_Teams_TeamId",
                        column: x => x.TeamId,
                        principalSchema: "app",
                        principalTable: "Teams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TeamPositionFitOrderEntries",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    OrderId = table.Column<string>(type: "text", nullable: false),
                    TeamPlayerId = table.Column<string>(type: "text", nullable: false),
                    Place = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TeamPositionFitOrderEntries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TeamPositionFitOrderEntries_TeamPlayers_TeamPlayerId",
                        column: x => x.TeamPlayerId,
                        principalSchema: "app",
                        principalTable: "TeamPlayers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TeamPositionFitOrderEntries_TeamPositionFitOrders_OrderId",
                        column: x => x.OrderId,
                        principalSchema: "app",
                        principalTable: "TeamPositionFitOrders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TeamPositionFitOrderEntries_OrderId_TeamPlayerId",
                schema: "app",
                table: "TeamPositionFitOrderEntries",
                columns: new[] { "OrderId", "TeamPlayerId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TeamPositionFitOrderEntries_TeamPlayerId",
                schema: "app",
                table: "TeamPositionFitOrderEntries",
                column: "TeamPlayerId");

            migrationBuilder.CreateIndex(
                name: "IX_TeamPositionFitOrders_TeamId_Position_WeekStart",
                schema: "app",
                table: "TeamPositionFitOrders",
                columns: new[] { "TeamId", "Position", "WeekStart" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TeamTraitWeights_TeamId_Position_TraitKey",
                schema: "app",
                table: "TeamTraitWeights",
                columns: new[] { "TeamId", "Position", "TraitKey" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TeamPositionFitOrderEntries",
                schema: "app");

            migrationBuilder.DropTable(
                name: "TeamTraitWeights",
                schema: "app");

            migrationBuilder.DropTable(
                name: "TeamPositionFitOrders",
                schema: "app");
        }
    }
}
