using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSeasonPlan : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "MicrocicloId",
                schema: "app",
                table: "TaskTrainingBases",
                type: "character varying(36)",
                maxLength: 36,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "SeasonPlans",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    TeamId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    SeasonId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SeasonPlans", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SeasonPlans_Seasons_SeasonId",
                        column: x => x.SeasonId,
                        principalSchema: "app",
                        principalTable: "Seasons",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Macrociclos",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    SeasonPlanId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    Order = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    StartDate = table.Column<DateOnly>(type: "date", nullable: false),
                    EndDate = table.Column<DateOnly>(type: "date", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Macrociclos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Macrociclos_SeasonPlans_SeasonPlanId",
                        column: x => x.SeasonPlanId,
                        principalSchema: "app",
                        principalTable: "SeasonPlans",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Mesociclos",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    MacrocicloId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    Order = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    StartDate = table.Column<DateOnly>(type: "date", nullable: false),
                    EndDate = table.Column<DateOnly>(type: "date", nullable: false),
                    GameZoneId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Mesociclos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Mesociclos_GameZones_GameZoneId",
                        column: x => x.GameZoneId,
                        principalSchema: "app",
                        principalTable: "GameZones",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Mesociclos_Macrociclos_MacrocicloId",
                        column: x => x.MacrocicloId,
                        principalSchema: "app",
                        principalTable: "Macrociclos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Microciclos",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    MesocicloId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    Order = table.Column<int>(type: "integer", nullable: false),
                    WeekLabel = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    StartDate = table.Column<DateOnly>(type: "date", nullable: false),
                    EndDate = table.Column<DateOnly>(type: "date", nullable: false),
                    ObjetivoSesionA = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    ObjetivoSesionB = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Microciclos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Microciclos_Mesociclos_MesocicloId",
                        column: x => x.MesocicloId,
                        principalSchema: "app",
                        principalTable: "Mesociclos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TaskTrainingBases_MicrocicloId",
                schema: "app",
                table: "TaskTrainingBases",
                column: "MicrocicloId");

            migrationBuilder.CreateIndex(
                name: "IX_Macrociclos_SeasonPlanId",
                schema: "app",
                table: "Macrociclos",
                column: "SeasonPlanId");

            migrationBuilder.CreateIndex(
                name: "IX_Mesociclos_GameZoneId",
                schema: "app",
                table: "Mesociclos",
                column: "GameZoneId");

            migrationBuilder.CreateIndex(
                name: "IX_Mesociclos_MacrocicloId",
                schema: "app",
                table: "Mesociclos",
                column: "MacrocicloId");

            migrationBuilder.CreateIndex(
                name: "IX_Microciclos_MesocicloId",
                schema: "app",
                table: "Microciclos",
                column: "MesocicloId");

            migrationBuilder.CreateIndex(
                name: "IX_SeasonPlans_SeasonId",
                schema: "app",
                table: "SeasonPlans",
                column: "SeasonId");

            migrationBuilder.CreateIndex(
                name: "IX_SeasonPlans_TeamId_SeasonId",
                schema: "app",
                table: "SeasonPlans",
                columns: new[] { "TeamId", "SeasonId" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_TaskTrainingBases_Microciclos_MicrocicloId",
                schema: "app",
                table: "TaskTrainingBases",
                column: "MicrocicloId",
                principalSchema: "app",
                principalTable: "Microciclos",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TaskTrainingBases_Microciclos_MicrocicloId",
                schema: "app",
                table: "TaskTrainingBases");

            migrationBuilder.DropTable(
                name: "Microciclos",
                schema: "app");

            migrationBuilder.DropTable(
                name: "Mesociclos",
                schema: "app");

            migrationBuilder.DropTable(
                name: "Macrociclos",
                schema: "app");

            migrationBuilder.DropTable(
                name: "SeasonPlans",
                schema: "app");

            migrationBuilder.DropIndex(
                name: "IX_TaskTrainingBases_MicrocicloId",
                schema: "app",
                table: "TaskTrainingBases");

            migrationBuilder.DropColumn(
                name: "MicrocicloId",
                schema: "app",
                table: "TaskTrainingBases");
        }
    }
}
