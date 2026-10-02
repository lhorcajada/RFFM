using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPlayerSessionEvaluations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PlayerSessionEvaluations",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    TeamId = table.Column<string>(type: "text", nullable: false),
                    TeamPlayerId = table.Column<string>(type: "text", nullable: false),
                    TrainingSessionId = table.Column<string>(type: "text", nullable: true),
                    SessionName = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    SessionDate = table.Column<DateOnly>(type: "date", nullable: false),
                    CreatedByUserId = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlayerSessionEvaluations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PlayerSessionEvaluations_SessionTrainings_TrainingSessionId",
                        column: x => x.TrainingSessionId,
                        principalSchema: "app",
                        principalTable: "SessionTrainings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_PlayerSessionEvaluations_TeamPlayers_TeamPlayerId",
                        column: x => x.TeamPlayerId,
                        principalSchema: "app",
                        principalTable: "TeamPlayers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PlayerSessionEvaluations_Teams_TeamId",
                        column: x => x.TeamId,
                        principalSchema: "app",
                        principalTable: "Teams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PlayerSessionSubprincipioEvaluations",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    PlayerSessionEvaluationId = table.Column<string>(type: "text", nullable: false),
                    SubprincipioId = table.Column<string>(type: "character varying(36)", nullable: true),
                    MomentName = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    PrincipleLabel = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    SubprincipioLabel = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Assessment = table.Column<int>(type: "integer", nullable: false),
                    Comment = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlayerSessionSubprincipioEvaluations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PlayerSessionSubprincipioEvaluations_PlayerSessionEvaluatio~",
                        column: x => x.PlayerSessionEvaluationId,
                        principalSchema: "app",
                        principalTable: "PlayerSessionEvaluations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PlayerSessionSubprincipioEvaluations_Subprincipios_Subprinc~",
                        column: x => x.SubprincipioId,
                        principalSchema: "app",
                        principalTable: "Subprincipios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PlayerSessionEvaluations_TeamId_SessionDate",
                schema: "app",
                table: "PlayerSessionEvaluations",
                columns: new[] { "TeamId", "SessionDate" });

            migrationBuilder.CreateIndex(
                name: "IX_PlayerSessionEvaluations_TeamPlayerId_TrainingSessionId",
                schema: "app",
                table: "PlayerSessionEvaluations",
                columns: new[] { "TeamPlayerId", "TrainingSessionId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PlayerSessionEvaluations_TrainingSessionId",
                schema: "app",
                table: "PlayerSessionEvaluations",
                column: "TrainingSessionId");

            migrationBuilder.CreateIndex(
                name: "IX_PlayerSessionSubprincipioEvaluations_PlayerSessionEvaluatio~",
                schema: "app",
                table: "PlayerSessionSubprincipioEvaluations",
                column: "PlayerSessionEvaluationId");

            migrationBuilder.CreateIndex(
                name: "IX_PlayerSessionSubprincipioEvaluations_SubprincipioId",
                schema: "app",
                table: "PlayerSessionSubprincipioEvaluations",
                column: "SubprincipioId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PlayerSessionSubprincipioEvaluations",
                schema: "app");

            migrationBuilder.DropTable(
                name: "PlayerSessionEvaluations",
                schema: "app");
        }
    }
}
