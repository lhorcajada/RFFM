using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.migrationsarchive.AppDbContext
{
    /// <inheritdoc />
    public partial class RefactorInjuryToHistory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "InjuryInfo_Description",
                schema: "app",
                table: "TeamPlayers");

            migrationBuilder.DropColumn(
                name: "InjuryInfo_EstimatedRecovery",
                schema: "app",
                table: "TeamPlayers");

            migrationBuilder.DropColumn(
                name: "InjuryInfo_InjuryType",
                schema: "app",
                table: "TeamPlayers");

            migrationBuilder.DropColumn(
                name: "InjuryInfo_StartDate",
                schema: "app",
                table: "TeamPlayers");

            migrationBuilder.CreateTable(
                name: "TeamPlayerInjuries",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    TeamPlayerId = table.Column<string>(type: "text", nullable: false),
                    StartDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    InjuryType = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    EstimatedRecovery = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    EndDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TeamPlayerInjuries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TeamPlayerInjuries_TeamPlayers_TeamPlayerId",
                        column: x => x.TeamPlayerId,
                        principalSchema: "app",
                        principalTable: "TeamPlayers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TeamPlayerInjuries_TeamPlayerId",
                schema: "app",
                table: "TeamPlayerInjuries",
                column: "TeamPlayerId");

            migrationBuilder.CreateIndex(
                name: "IX_TeamPlayerInjuries_TeamPlayerId_EndDate",
                schema: "app",
                table: "TeamPlayerInjuries",
                columns: new[] { "TeamPlayerId", "EndDate" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TeamPlayerInjuries",
                schema: "app");

            migrationBuilder.AddColumn<string>(
                name: "InjuryInfo_Description",
                schema: "app",
                table: "TeamPlayers",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "InjuryInfo_EstimatedRecovery",
                schema: "app",
                table: "TeamPlayers",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "InjuryInfo_InjuryType",
                schema: "app",
                table: "TeamPlayers",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "InjuryInfo_StartDate",
                schema: "app",
                table: "TeamPlayers",
                type: "timestamp with time zone",
                nullable: true);
        }
    }
}
