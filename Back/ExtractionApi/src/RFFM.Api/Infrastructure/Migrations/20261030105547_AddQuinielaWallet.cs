using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddQuinielaWallet : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "QuinielaWallets",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    TeamId = table.Column<string>(type: "text", nullable: false),
                    ApplicationUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    Balance = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuinielaWallets", x => x.Id);
                    table.ForeignKey(
                        name: "FK_QuinielaWallets_Teams_TeamId",
                        column: x => x.TeamId,
                        principalSchema: "app",
                        principalTable: "Teams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "QuinielaWalletMovements",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    WalletId = table.Column<string>(type: "text", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    OccurredAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Description = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    TicketId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: true),
                    CreatedByUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuinielaWalletMovements", x => x.Id);
                    table.ForeignKey(
                        name: "FK_QuinielaWalletMovements_QuinielaWallets_WalletId",
                        column: x => x.WalletId,
                        principalSchema: "app",
                        principalTable: "QuinielaWallets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_QuinielaWalletMovements_TicketId",
                schema: "app",
                table: "QuinielaWalletMovements",
                column: "TicketId");

            migrationBuilder.CreateIndex(
                name: "IX_QuinielaWalletMovements_WalletId_OccurredAt",
                schema: "app",
                table: "QuinielaWalletMovements",
                columns: new[] { "WalletId", "OccurredAt" });

            migrationBuilder.CreateIndex(
                name: "IX_QuinielaWallets_TeamId_ApplicationUserId",
                schema: "app",
                table: "QuinielaWallets",
                columns: new[] { "TeamId", "ApplicationUserId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "QuinielaWalletMovements",
                schema: "app");

            migrationBuilder.DropTable(
                name: "QuinielaWallets",
                schema: "app");
        }
    }
}
