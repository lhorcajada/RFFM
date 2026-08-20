using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class FixTaskTrainingBaseHabilidadesDefault : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // AddExerciseModelLinks used defaultValue: "" for this jsonb column, which is not
            // valid JSON — existing rows ended up with an unparseable value instead of "[]".
            migrationBuilder.Sql(
                "UPDATE app.\"TaskTrainingBases\" SET \"Habilidades\" = '[]' WHERE \"Habilidades\" IS NULL OR \"Habilidades\"::text !~ '^\\[.*\\]$';");

            migrationBuilder.AlterColumn<string>(
                name: "Habilidades",
                schema: "app",
                table: "TaskTrainingBases",
                type: "jsonb",
                nullable: false,
                defaultValue: "[]",
                oldClrType: typeof(string),
                oldType: "jsonb",
                oldDefaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "Habilidades",
                schema: "app",
                table: "TaskTrainingBases",
                type: "jsonb",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "jsonb",
                oldDefaultValue: "[]");
        }
    }
}
