using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddLiveMatchStates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "LiveMatchStates",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EventId = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    TeamId = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    Phase = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    ClockBaseSeconds = table.Column<int>(type: "integer", nullable: false),
                    ClockReferenceUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    MatchDurationMinutes = table.Column<int>(type: "integer", nullable: false),
                    ScoreLocal = table.Column<int>(type: "integer", nullable: false),
                    ScoreVisitor = table.Column<int>(type: "integer", nullable: false),
                    Formation = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    MatchDataJson = table.Column<string>(type: "text", nullable: false),
                    ClosedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LiveMatchStates", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LiveMatchStates_EventId",
                schema: "app",
                table: "LiveMatchStates",
                column: "EventId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LiveMatchStates",
                schema: "app");
        }
    }
}
