using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.migrationsarchive.AppDbContext
{
    /// <inheritdoc />
    public partial class AddPlayerInjury : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
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

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
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
        }
    }
}
