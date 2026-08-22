using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTeamPlayerLinkRequestsAndPlayerLinkCode : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "LinkCode",
                schema: "app",
                table: "TeamPlayers",
                type: "character varying(8)",
                maxLength: 8,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "TeamPlayerLinkRequests",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    ApplicationUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    TeamId = table.Column<string>(type: "text", nullable: false),
                    TeamPlayerId = table.Column<string>(type: "text", nullable: false),
                    MembershipId = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    RequestedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DecidedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DecidedByUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TeamPlayerLinkRequests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TeamPlayerLinkRequests_Memberships_MembershipId",
                        column: x => x.MembershipId,
                        principalSchema: "app",
                        principalTable: "Memberships",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TeamPlayerLinkRequests_TeamPlayers_TeamPlayerId",
                        column: x => x.TeamPlayerId,
                        principalSchema: "app",
                        principalTable: "TeamPlayers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TeamPlayerLinkRequests_Teams_TeamId",
                        column: x => x.TeamId,
                        principalSchema: "app",
                        principalTable: "Teams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TeamPlayers_LinkCode",
                schema: "app",
                table: "TeamPlayers",
                column: "LinkCode");

            migrationBuilder.CreateIndex(
                name: "IX_TeamPlayerLinkRequests_ApplicationUserId",
                schema: "app",
                table: "TeamPlayerLinkRequests",
                column: "ApplicationUserId");

            migrationBuilder.CreateIndex(
                name: "IX_TeamPlayerLinkRequests_MembershipId",
                schema: "app",
                table: "TeamPlayerLinkRequests",
                column: "MembershipId");

            migrationBuilder.CreateIndex(
                name: "IX_TeamPlayerLinkRequests_TeamId_Status",
                schema: "app",
                table: "TeamPlayerLinkRequests",
                columns: new[] { "TeamId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_TeamPlayerLinkRequests_TeamPlayerId",
                schema: "app",
                table: "TeamPlayerLinkRequests",
                column: "TeamPlayerId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TeamPlayerLinkRequests",
                schema: "app");

            migrationBuilder.DropIndex(
                name: "IX_TeamPlayers_LinkCode",
                schema: "app",
                table: "TeamPlayers");

            migrationBuilder.DropColumn(
                name: "LinkCode",
                schema: "app",
                table: "TeamPlayers");
        }
    }
}
