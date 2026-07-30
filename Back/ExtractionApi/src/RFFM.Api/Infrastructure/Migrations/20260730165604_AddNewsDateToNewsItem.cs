using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddNewsDateToNewsItem : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "NewsDate",
                schema: "app",
                table: "News",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.Sql(@"
                UPDATE app.""News""
                SET ""NewsDate"" = COALESCE(""PublishedAt"", ""CreatedAt"")
                WHERE ""NewsDate"" IS NULL;
            ");

            migrationBuilder.AlterColumn<DateTime>(
                name: "NewsDate",
                schema: "app",
                table: "News",
                type: "timestamp with time zone",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "timestamp with time zone",
                oldNullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "NewsDate",
                schema: "app",
                table: "News");
        }
    }
}
