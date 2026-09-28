using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations.Federation
{
    /// <inheritdoc />
    public partial class AddSquadHistory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SquadHistoryReports",
                schema: "federation",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    TeamCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    TeamName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    SeasonId = table.Column<int>(type: "integer", nullable: false),
                    PreviousSeasonId = table.Column<int>(type: "integer", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    TotalPlayers = table.Column<int>(type: "integer", nullable: false),
                    ProcessedPlayers = table.Column<int>(type: "integer", nullable: false),
                    FailedPlayers = table.Column<int>(type: "integer", nullable: false),
                    RequestedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    StartedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ErrorMessage = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SquadHistoryReports", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SquadHistoryEntries",
                schema: "federation",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    ReportId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    PlayerCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    PlayerName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    SeasonId = table.Column<int>(type: "integer", nullable: false),
                    SeasonName = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    CompetitionCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    CompetitionName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    GroupCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    GroupName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    TeamCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    TeamName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    ClubName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    TeamShieldUrl = table.Column<string>(type: "character varying(1024)", maxLength: 1024, nullable: true),
                    TeamPoints = table.Column<int>(type: "integer", nullable: false),
                    TeamPosition = table.Column<int>(type: "integer", nullable: false),
                    Goals = table.Column<int>(type: "integer", nullable: false),
                    YellowCards = table.Column<int>(type: "integer", nullable: false),
                    RedCards = table.Column<int>(type: "integer", nullable: false),
                    Starts = table.Column<int>(type: "integer", nullable: true),
                    CallUps = table.Column<int>(type: "integer", nullable: true),
                    Source = table.Column<int>(type: "integer", nullable: false),
                    IsIncomplete = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SquadHistoryEntries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SquadHistoryEntries_SquadHistoryReports_ReportId",
                        column: x => x.ReportId,
                        principalSchema: "federation",
                        principalTable: "SquadHistoryReports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SquadHistorySubscribers",
                schema: "federation",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    ReportId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    UserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    Notified = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SquadHistorySubscribers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SquadHistorySubscribers_SquadHistoryReports_ReportId",
                        column: x => x.ReportId,
                        principalSchema: "federation",
                        principalTable: "SquadHistoryReports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SquadHistoryEntries_ReportId",
                schema: "federation",
                table: "SquadHistoryEntries",
                column: "ReportId");

            migrationBuilder.CreateIndex(
                name: "IX_SquadHistoryReports_Status",
                schema: "federation",
                table: "SquadHistoryReports",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_SquadHistoryReports_TeamCode_SeasonId",
                schema: "federation",
                table: "SquadHistoryReports",
                columns: new[] { "TeamCode", "SeasonId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SquadHistorySubscribers_ReportId_UserId",
                schema: "federation",
                table: "SquadHistorySubscribers",
                columns: new[] { "ReportId", "UserId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SquadHistoryEntries",
                schema: "federation");

            migrationBuilder.DropTable(
                name: "SquadHistorySubscribers",
                schema: "federation");

            migrationBuilder.DropTable(
                name: "SquadHistoryReports",
                schema: "federation");
        }
    }
}
