using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPlayerModelObservations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PlayerModelObservations",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    TeamPlayerId = table.Column<string>(type: "text", nullable: false),
                    TeamId = table.Column<string>(type: "text", nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    Kind = table.Column<int>(type: "integer", nullable: false),
                    SubprincipioId = table.Column<string>(type: "character varying(36)", nullable: true),
                    MomentName = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    PrincipleLabel = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    SubprincipioLabel = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    AttitudeKey = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    Habilidades = table.Column<string>(type: "jsonb", nullable: false),
                    TrainingSessionId = table.Column<string>(type: "text", nullable: true),
                    Assessment = table.Column<int>(type: "integer", nullable: false),
                    Comment = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedByUserId = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlayerModelObservations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PlayerModelObservations_SessionTrainings_TrainingSessionId",
                        column: x => x.TrainingSessionId,
                        principalSchema: "app",
                        principalTable: "SessionTrainings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_PlayerModelObservations_Subprincipios_SubprincipioId",
                        column: x => x.SubprincipioId,
                        principalSchema: "app",
                        principalTable: "Subprincipios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_PlayerModelObservations_TeamPlayers_TeamPlayerId",
                        column: x => x.TeamPlayerId,
                        principalSchema: "app",
                        principalTable: "TeamPlayers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PlayerModelObservations_Teams_TeamId",
                        column: x => x.TeamId,
                        principalSchema: "app",
                        principalTable: "Teams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PlayerModelObservations_SubprincipioId",
                schema: "app",
                table: "PlayerModelObservations",
                column: "SubprincipioId");

            migrationBuilder.CreateIndex(
                name: "IX_PlayerModelObservations_TeamId_Date",
                schema: "app",
                table: "PlayerModelObservations",
                columns: new[] { "TeamId", "Date" });

            migrationBuilder.CreateIndex(
                name: "IX_PlayerModelObservations_TeamPlayerId_Date",
                schema: "app",
                table: "PlayerModelObservations",
                columns: new[] { "TeamPlayerId", "Date" });

            migrationBuilder.CreateIndex(
                name: "IX_PlayerModelObservations_TrainingSessionId",
                schema: "app",
                table: "PlayerModelObservations",
                column: "TrainingSessionId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PlayerModelObservations",
                schema: "app");
        }
    }
}
