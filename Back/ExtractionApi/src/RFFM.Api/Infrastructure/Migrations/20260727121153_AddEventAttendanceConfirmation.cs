using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddEventAttendanceConfirmation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "EventAttendanceConfirmations",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    SportEventId = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    TeamPlayerId = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    ConfirmedByApplicationUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    AttendanceStatusId = table.Column<int>(type: "integer", nullable: false),
                    RespondedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EventAttendanceConfirmations", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EventAttendanceConfirmations_Id",
                schema: "app",
                table: "EventAttendanceConfirmations",
                column: "Id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EventAttendanceConfirmations_SportEventId_TeamPlayerId",
                schema: "app",
                table: "EventAttendanceConfirmations",
                columns: new[] { "SportEventId", "TeamPlayerId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EventAttendanceConfirmations",
                schema: "app");
        }
    }
}
