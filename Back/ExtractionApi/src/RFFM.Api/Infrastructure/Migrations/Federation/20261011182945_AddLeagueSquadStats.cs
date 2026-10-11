using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations.Federation
{
    /// <inheritdoc />
    public partial class AddLeagueSquadStats : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "LeagueSquadStatsReports",
                schema: "federation",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    SeasonId = table.Column<int>(type: "integer", nullable: false),
                    PreviousSeasonId = table.Column<int>(type: "integer", nullable: true),
                    CompetitionCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    GroupCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    TotalPlayers = table.Column<int>(type: "integer", nullable: false),
                    ProcessedPlayers = table.Column<int>(type: "integer", nullable: false),
                    FailedPlayers = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    RequestedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    StartedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ErrorMessage = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LeagueSquadStatsReports", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RffmPlayerSeasonStats",
                schema: "federation",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    PlayerCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    SeasonId = table.Column<int>(type: "integer", nullable: false),
                    PlayerName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    BirthYear = table.Column<int>(type: "integer", nullable: true),
                    Position = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Called = table.Column<int>(type: "integer", nullable: false),
                    Starter = table.Column<int>(type: "integer", nullable: false),
                    Substitute = table.Column<int>(type: "integer", nullable: false),
                    Played = table.Column<int>(type: "integer", nullable: false),
                    Goals = table.Column<int>(type: "integer", nullable: false),
                    Yellow = table.Column<int>(type: "integer", nullable: false),
                    Red = table.Column<int>(type: "integer", nullable: false),
                    DoubleYellow = table.Column<int>(type: "integer", nullable: false),
                    ParticipationsJson = table.Column<string>(type: "text", nullable: false),
                    HasActivity = table.Column<bool>(type: "boolean", nullable: false),
                    FetchedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RffmPlayerSeasonStats", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "LeagueSquadStatsSubscribers",
                schema: "federation",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    ReportId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    UserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    TeamId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    Notified = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LeagueSquadStatsSubscribers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LeagueSquadStatsSubscribers_LeagueSquadStatsReports_ReportId",
                        column: x => x.ReportId,
                        principalSchema: "federation",
                        principalTable: "LeagueSquadStatsReports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "LeagueSquadTeams",
                schema: "federation",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    ReportId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    TeamCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    TeamName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    ShieldUrl = table.Column<string>(type: "character varying(1024)", maxLength: 1024, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LeagueSquadTeams", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LeagueSquadTeams_LeagueSquadStatsReports_ReportId",
                        column: x => x.ReportId,
                        principalSchema: "federation",
                        principalTable: "LeagueSquadStatsReports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "LeagueSquadPlayers",
                schema: "federation",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    LeagueSquadTeamId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    PlayerCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    PlayerName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LeagueSquadPlayers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LeagueSquadPlayers_LeagueSquadTeams_LeagueSquadTeamId",
                        column: x => x.LeagueSquadTeamId,
                        principalSchema: "federation",
                        principalTable: "LeagueSquadTeams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LeagueSquadPlayers_LeagueSquadTeamId",
                schema: "federation",
                table: "LeagueSquadPlayers",
                column: "LeagueSquadTeamId");

            migrationBuilder.CreateIndex(
                name: "IX_LeagueSquadPlayers_PlayerCode",
                schema: "federation",
                table: "LeagueSquadPlayers",
                column: "PlayerCode");

            migrationBuilder.CreateIndex(
                name: "IX_LeagueSquadStatsReports_SeasonId_CompetitionCode_GroupCode",
                schema: "federation",
                table: "LeagueSquadStatsReports",
                columns: new[] { "SeasonId", "CompetitionCode", "GroupCode" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LeagueSquadStatsReports_Status",
                schema: "federation",
                table: "LeagueSquadStatsReports",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_LeagueSquadStatsSubscribers_ReportId_UserId",
                schema: "federation",
                table: "LeagueSquadStatsSubscribers",
                columns: new[] { "ReportId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LeagueSquadTeams_ReportId_TeamCode",
                schema: "federation",
                table: "LeagueSquadTeams",
                columns: new[] { "ReportId", "TeamCode" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RffmPlayerSeasonStats_PlayerCode_SeasonId",
                schema: "federation",
                table: "RffmPlayerSeasonStats",
                columns: new[] { "PlayerCode", "SeasonId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RffmPlayerSeasonStats_SeasonId",
                schema: "federation",
                table: "RffmPlayerSeasonStats",
                column: "SeasonId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LeagueSquadPlayers",
                schema: "federation");

            migrationBuilder.DropTable(
                name: "LeagueSquadStatsSubscribers",
                schema: "federation");

            migrationBuilder.DropTable(
                name: "RffmPlayerSeasonStats",
                schema: "federation");

            migrationBuilder.DropTable(
                name: "LeagueSquadTeams",
                schema: "federation");

            migrationBuilder.DropTable(
                name: "LeagueSquadStatsReports",
                schema: "federation");
        }
    }
}
