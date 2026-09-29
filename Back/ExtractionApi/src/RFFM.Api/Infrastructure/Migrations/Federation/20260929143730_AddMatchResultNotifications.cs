using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations.Federation
{
    /// <inheritdoc />
    public partial class AddMatchResultNotifications : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "MatchResultNotificationLogs",
                schema: "federation",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    UserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    RecordCode = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    TeamCode = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    LocalGoals = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    VisitorGoals = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    NotifiedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MatchResultNotificationLogs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "MatchResultNotificationOptOuts",
                schema: "federation",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    UserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MatchResultNotificationOptOuts", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_MatchResultNotificationLogs_UserId_RecordCode",
                schema: "federation",
                table: "MatchResultNotificationLogs",
                columns: new[] { "UserId", "RecordCode" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MatchResultNotificationOptOuts_UserId",
                schema: "federation",
                table: "MatchResultNotificationOptOuts",
                column: "UserId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "MatchResultNotificationLogs",
                schema: "federation");

            migrationBuilder.DropTable(
                name: "MatchResultNotificationOptOuts",
                schema: "federation");
        }
    }
}
