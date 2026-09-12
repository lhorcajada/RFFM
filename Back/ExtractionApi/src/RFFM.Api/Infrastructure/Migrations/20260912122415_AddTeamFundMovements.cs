using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTeamFundMovements : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TeamFundMovements",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    TeamId = table.Column<string>(type: "text", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    Source = table.Column<int>(type: "integer", nullable: false),
                    SourceSanctionId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: true),
                    OccurredAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TeamFundMovements", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TeamFundMovements_Teams_TeamId",
                        column: x => x.TeamId,
                        principalSchema: "app",
                        principalTable: "Teams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TeamFundMovements_SourceSanctionId",
                schema: "app",
                table: "TeamFundMovements",
                column: "SourceSanctionId",
                unique: true,
                filter: "\"SourceSanctionId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_TeamFundMovements_TeamId",
                schema: "app",
                table: "TeamFundMovements",
                column: "TeamId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TeamFundMovements",
                schema: "app");
        }
    }
}
