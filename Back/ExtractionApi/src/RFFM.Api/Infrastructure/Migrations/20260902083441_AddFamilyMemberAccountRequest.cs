using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddFamilyMemberAccountRequest : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "LinkedUserId",
                schema: "app",
                table: "TeamPlayerFamilies",
                type: "text",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "FamilyMemberAccountRequests",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    ApplicationUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    TeamPlayerFamilyMemberId = table.Column<string>(type: "text", nullable: false),
                    TeamPlayerId = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    RequestedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DecidedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DecidedByUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FamilyMemberAccountRequests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FamilyMemberAccountRequests_TeamPlayerFamilies_TeamPlayerFa~",
                        column: x => x.TeamPlayerFamilyMemberId,
                        principalSchema: "app",
                        principalTable: "TeamPlayerFamilies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FamilyMemberAccountRequests_TeamPlayers_TeamPlayerId",
                        column: x => x.TeamPlayerId,
                        principalSchema: "app",
                        principalTable: "TeamPlayers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FamilyMemberAccountRequests_ApplicationUserId",
                schema: "app",
                table: "FamilyMemberAccountRequests",
                column: "ApplicationUserId");

            migrationBuilder.CreateIndex(
                name: "IX_FamilyMemberAccountRequests_TeamPlayerFamilyMemberId",
                schema: "app",
                table: "FamilyMemberAccountRequests",
                column: "TeamPlayerFamilyMemberId");

            migrationBuilder.CreateIndex(
                name: "IX_FamilyMemberAccountRequests_TeamPlayerId",
                schema: "app",
                table: "FamilyMemberAccountRequests",
                column: "TeamPlayerId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FamilyMemberAccountRequests",
                schema: "app");

            migrationBuilder.DropColumn(
                name: "LinkedUserId",
                schema: "app",
                table: "TeamPlayerFamilies");
        }
    }
}
