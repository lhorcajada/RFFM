using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTrackingComments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TrackingComments",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    TeamId = table.Column<string>(type: "text", nullable: false),
                    Title = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedByUserId = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TrackingComments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TrackingComments_Teams_TeamId",
                        column: x => x.TeamId,
                        principalSchema: "app",
                        principalTable: "Teams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PlayerSessionCommentEvaluations",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    PlayerSessionEvaluationId = table.Column<string>(type: "text", nullable: false),
                    TrackingCommentId = table.Column<string>(type: "text", nullable: true),
                    Title = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Assessment = table.Column<int>(type: "integer", nullable: false),
                    Note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlayerSessionCommentEvaluations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PlayerSessionCommentEvaluations_PlayerSessionEvaluations_Pl~",
                        column: x => x.PlayerSessionEvaluationId,
                        principalSchema: "app",
                        principalTable: "PlayerSessionEvaluations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PlayerSessionCommentEvaluations_TrackingComments_TrackingCo~",
                        column: x => x.TrackingCommentId,
                        principalSchema: "app",
                        principalTable: "TrackingComments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PlayerSessionCommentEvaluations_PlayerSessionEvaluationId",
                schema: "app",
                table: "PlayerSessionCommentEvaluations",
                column: "PlayerSessionEvaluationId");

            migrationBuilder.CreateIndex(
                name: "IX_PlayerSessionCommentEvaluations_TrackingCommentId",
                schema: "app",
                table: "PlayerSessionCommentEvaluations",
                column: "TrackingCommentId");

            migrationBuilder.CreateIndex(
                name: "IX_TrackingComments_TeamId_Title",
                schema: "app",
                table: "TrackingComments",
                columns: new[] { "TeamId", "Title" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PlayerSessionCommentEvaluations",
                schema: "app");

            migrationBuilder.DropTable(
                name: "TrackingComments",
                schema: "app");
        }
    }
}
