using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddExerciseConditions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ExerciseConditions",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    TaskTrainingBaseId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    Text = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExerciseConditions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ExerciseConditions_TaskTrainingBases_TaskTrainingBaseId",
                        column: x => x.TaskTrainingBaseId,
                        principalSchema: "app",
                        principalTable: "TaskTrainingBases",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ExerciseConditions_TaskTrainingBaseId",
                schema: "app",
                table: "ExerciseConditions",
                column: "TaskTrainingBaseId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ExerciseConditions",
                schema: "app");
        }
    }
}
