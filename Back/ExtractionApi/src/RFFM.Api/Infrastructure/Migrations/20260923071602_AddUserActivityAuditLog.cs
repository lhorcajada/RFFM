using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddUserActivityAuditLog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "UserActivityLogs",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    UserId = table.Column<string>(type: "text", nullable: false),
                    RoleName = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    ClubId = table.Column<string>(type: "text", nullable: true),
                    TeamId = table.Column<string>(type: "text", nullable: true),
                    Timestamp = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IpAddress = table.Column<string>(type: "character varying(45)", maxLength: 45, nullable: true),
                    EventType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    ActionOrPage = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Result = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    SubjectId = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserActivityLogs", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserActivityLogs_ClubId_Timestamp",
                schema: "app",
                table: "UserActivityLogs",
                columns: new[] { "ClubId", "Timestamp" });

            migrationBuilder.CreateIndex(
                name: "IX_UserActivityLogs_TeamId_Timestamp",
                schema: "app",
                table: "UserActivityLogs",
                columns: new[] { "TeamId", "Timestamp" });

            migrationBuilder.CreateIndex(
                name: "IX_UserActivityLogs_UserId",
                schema: "app",
                table: "UserActivityLogs",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UserActivityLogs",
                schema: "app");
        }
    }
}
