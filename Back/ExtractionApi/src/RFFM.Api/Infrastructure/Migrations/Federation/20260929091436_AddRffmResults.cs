using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations.Federation
{
    /// <inheritdoc />
    public partial class AddRffmResults : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "RffmCompetitionGroups",
                schema: "federation",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    GroupCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    SeasonId = table.Column<int>(type: "integer", nullable: false),
                    CompetitionCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    CompetitionName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    GroupName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    MatchMinutes = table.Column<int>(type: "integer", nullable: false),
                    MatchParts = table.Column<int>(type: "integer", nullable: false),
                    StandingsJson = table.Column<string>(type: "jsonb", nullable: true),
                    StandingsSyncedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RffmCompetitionGroups", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RffmMatchRecords",
                schema: "federation",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    RecordCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    GroupCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    PayloadJson = table.Column<string>(type: "jsonb", nullable: false),
                    FetchedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RffmMatchRecords", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RffmRounds",
                schema: "federation",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    GroupCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Number = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: true),
                    LastSyncedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RffmRounds", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RffmMatches",
                schema: "federation",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    RffmRoundId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    RecordCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    MatchDate = table.Column<DateOnly>(type: "date", nullable: true),
                    KickoffTime = table.Column<TimeOnly>(type: "time without time zone", nullable: true),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    HasRecords = table.Column<string>(type: "text", nullable: false),
                    RecordClosed = table.Column<string>(type: "text", nullable: false),
                    GameSituation = table.Column<string>(type: "text", nullable: false),
                    Observations = table.Column<string>(type: "text", nullable: false),
                    Date = table.Column<string>(type: "text", nullable: false),
                    Time = table.Column<string>(type: "text", nullable: false),
                    Field = table.Column<string>(type: "text", nullable: false),
                    FieldCode = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    StatusReason = table.Column<string>(type: "text", nullable: false),
                    MatchInProgress = table.Column<string>(type: "text", nullable: false),
                    ProvisionalResult = table.Column<string>(type: "text", nullable: false),
                    Referee = table.Column<string>(type: "text", nullable: false),
                    Penalties = table.Column<string>(type: "text", nullable: false),
                    ExtraTimeWin = table.Column<string>(type: "text", nullable: false),
                    ExtraTimeWinnerTeam = table.Column<string>(type: "text", nullable: false),
                    LocalTeamCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    LocalTeamName = table.Column<string>(type: "text", nullable: false),
                    LocalTeamImageUrl = table.Column<string>(type: "text", nullable: false),
                    LocalTeamWithdrawn = table.Column<string>(type: "text", nullable: false),
                    LocalGoals = table.Column<string>(type: "text", nullable: false),
                    LocalPenalties = table.Column<string>(type: "text", nullable: false),
                    VisitorTeamCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    VisitorTeamName = table.Column<string>(type: "text", nullable: false),
                    VisitorTeamImageUrl = table.Column<string>(type: "text", nullable: false),
                    VisitorTeamWithdrawn = table.Column<string>(type: "text", nullable: false),
                    VisitorGoals = table.Column<string>(type: "text", nullable: false),
                    VisitorPenalties = table.Column<string>(type: "text", nullable: false),
                    OriginRecordCode = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RffmMatches", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RffmMatches_RffmRounds_RffmRoundId",
                        column: x => x.RffmRoundId,
                        principalSchema: "federation",
                        principalTable: "RffmRounds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RffmCompetitionGroups_GroupCode",
                schema: "federation",
                table: "RffmCompetitionGroups",
                column: "GroupCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RffmMatches_RecordClosed",
                schema: "federation",
                table: "RffmMatches",
                column: "RecordClosed");

            migrationBuilder.CreateIndex(
                name: "IX_RffmMatches_RecordCode",
                schema: "federation",
                table: "RffmMatches",
                column: "RecordCode");

            migrationBuilder.CreateIndex(
                name: "IX_RffmMatches_RffmRoundId_RecordCode",
                schema: "federation",
                table: "RffmMatches",
                columns: new[] { "RffmRoundId", "RecordCode" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RffmMatchRecords_RecordCode",
                schema: "federation",
                table: "RffmMatchRecords",
                column: "RecordCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RffmRounds_GroupCode_Number",
                schema: "federation",
                table: "RffmRounds",
                columns: new[] { "GroupCode", "Number" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RffmCompetitionGroups",
                schema: "federation");

            migrationBuilder.DropTable(
                name: "RffmMatches",
                schema: "federation");

            migrationBuilder.DropTable(
                name: "RffmMatchRecords",
                schema: "federation");

            migrationBuilder.DropTable(
                name: "RffmRounds",
                schema: "federation");
        }
    }
}
