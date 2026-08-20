using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddExerciseModelLinks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Habilidades",
                schema: "app",
                table: "TaskTrainingBases",
                type: "jsonb",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "ExerciseModelLinks",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    TaskTrainingBaseId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    SubprincipioId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: true),
                    SubSubPrincipioId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: true),
                    IsFoco = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExerciseModelLinks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ExerciseModelLinks_SubSubPrincipios_SubSubPrincipioId",
                        column: x => x.SubSubPrincipioId,
                        principalSchema: "app",
                        principalTable: "SubSubPrincipios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ExerciseModelLinks_Subprincipios_SubprincipioId",
                        column: x => x.SubprincipioId,
                        principalSchema: "app",
                        principalTable: "Subprincipios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ExerciseModelLinks_TaskTrainingBases_TaskTrainingBaseId",
                        column: x => x.TaskTrainingBaseId,
                        principalSchema: "app",
                        principalTable: "TaskTrainingBases",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ExerciseModelLinks_SubprincipioId",
                schema: "app",
                table: "ExerciseModelLinks",
                column: "SubprincipioId");

            migrationBuilder.CreateIndex(
                name: "IX_ExerciseModelLinks_SubSubPrincipioId",
                schema: "app",
                table: "ExerciseModelLinks",
                column: "SubSubPrincipioId");

            migrationBuilder.CreateIndex(
                name: "IX_ExerciseModelLinks_TaskTrainingBaseId",
                schema: "app",
                table: "ExerciseModelLinks",
                column: "TaskTrainingBaseId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ExerciseModelLinks",
                schema: "app");

            migrationBuilder.DropColumn(
                name: "Habilidades",
                schema: "app",
                table: "TaskTrainingBases");
        }
    }
}
