using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSeasonDatesAndConstraints : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "StartDate",
                schema: "app",
                table: "Seasons",
                type: "timestamp with time zone",
                nullable: false,
                defaultValueSql: "now()");

            migrationBuilder.AddColumn<DateTime>(
                name: "EndDate",
                schema: "app",
                table: "Seasons",
                type: "timestamp with time zone",
                nullable: false,
                defaultValueSql: "now() + interval '1 year'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "StartDate",
                schema: "app",
                table: "Seasons");

            migrationBuilder.DropColumn(
                name: "EndDate",
                schema: "app",
                table: "Seasons");
        }
    }
}