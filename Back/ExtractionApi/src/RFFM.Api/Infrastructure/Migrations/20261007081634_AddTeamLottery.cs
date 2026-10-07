using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTeamLottery : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "LotteryCampaigns",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    TeamId = table.Column<string>(type: "text", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    DrawDate = table.Column<DateOnly>(type: "date", nullable: false),
                    TicketPrice = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    TicketsPerBook = table.Column<int>(type: "integer", nullable: false),
                    ClubDeliveryFrom = table.Column<DateOnly>(type: "date", nullable: false),
                    ClubDeliveryTo = table.Column<DateOnly>(type: "date", nullable: false),
                    ClubDeliveredOn = table.Column<DateOnly>(type: "date", nullable: true),
                    ClubDeliveredAmount = table.Column<decimal>(type: "numeric(10,2)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LotteryCampaigns", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LotteryCampaigns_Teams_TeamId",
                        column: x => x.TeamId,
                        principalSchema: "app",
                        principalTable: "Teams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "LotteryBooks",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    LotteryCampaignId = table.Column<string>(type: "text", nullable: false),
                    TeamPlayerId = table.Column<string>(type: "text", nullable: false),
                    BookNumber = table.Column<int>(type: "integer", nullable: false),
                    FirstTicketNumber = table.Column<int>(type: "integer", nullable: false),
                    DeliveredOn = table.Column<DateOnly>(type: "date", nullable: false),
                    ReturnedOn = table.Column<DateOnly>(type: "date", nullable: true),
                    AmountReturned = table.Column<decimal>(type: "numeric(10,2)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LotteryBooks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LotteryBooks_LotteryCampaigns_LotteryCampaignId",
                        column: x => x.LotteryCampaignId,
                        principalSchema: "app",
                        principalTable: "LotteryCampaigns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_LotteryBooks_TeamPlayers_TeamPlayerId",
                        column: x => x.TeamPlayerId,
                        principalSchema: "app",
                        principalTable: "TeamPlayers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LotteryBooks_LotteryCampaignId_BookNumber",
                schema: "app",
                table: "LotteryBooks",
                columns: new[] { "LotteryCampaignId", "BookNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LotteryBooks_TeamPlayerId",
                schema: "app",
                table: "LotteryBooks",
                column: "TeamPlayerId");

            migrationBuilder.CreateIndex(
                name: "IX_LotteryCampaigns_TeamId_DrawDate",
                schema: "app",
                table: "LotteryCampaigns",
                columns: new[] { "TeamId", "DrawDate" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LotteryBooks",
                schema: "app");

            migrationBuilder.DropTable(
                name: "LotteryCampaigns",
                schema: "app");
        }
    }
}
