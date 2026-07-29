using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddScenarioIdToTaskTrainingBase : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ScenarioId",
                schema: "app",
                table: "TaskTrainingBases",
                type: "character varying(36)",
                maxLength: 36,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_TaskTrainingBases_ScenarioId",
                schema: "app",
                table: "TaskTrainingBases",
                column: "ScenarioId");

            migrationBuilder.AddForeignKey(
                name: "FK_TaskTrainingBases_GameScenarios_ScenarioId",
                schema: "app",
                table: "TaskTrainingBases",
                column: "ScenarioId",
                principalSchema: "app",
                principalTable: "GameScenarios",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TaskTrainingBases_GameScenarios_ScenarioId",
                schema: "app",
                table: "TaskTrainingBases");

            migrationBuilder.DropIndex(
                name: "IX_TaskTrainingBases_ScenarioId",
                schema: "app",
                table: "TaskTrainingBases");

            migrationBuilder.DropColumn(
                name: "ScenarioId",
                schema: "app",
                table: "TaskTrainingBases");
        }
    }
}
