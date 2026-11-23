using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <summary>
    /// Adds the Puntos, Rotaciones and Montaje line lists of the exercise sheet to TaskTrainingBases.
    /// Only these three jsonb columns are added: the stored values of Jugadores, Secuencia, QueSeVe and
    /// Porteros stay untouched.
    /// </summary>
    public partial class AddExerciseSheetSections : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Montaje",
                schema: "app",
                table: "TaskTrainingBases",
                type: "jsonb",
                nullable: false,
                defaultValueSql: "'[]'::jsonb");

            migrationBuilder.AddColumn<string>(
                name: "Puntos",
                schema: "app",
                table: "TaskTrainingBases",
                type: "jsonb",
                nullable: false,
                defaultValueSql: "'[]'::jsonb");

            migrationBuilder.AddColumn<string>(
                name: "Rotaciones",
                schema: "app",
                table: "TaskTrainingBases",
                type: "jsonb",
                nullable: false,
                defaultValueSql: "'[]'::jsonb");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Montaje",
                schema: "app",
                table: "TaskTrainingBases");

            migrationBuilder.DropColumn(
                name: "Puntos",
                schema: "app",
                table: "TaskTrainingBases");

            migrationBuilder.DropColumn(
                name: "Rotaciones",
                schema: "app",
                table: "TaskTrainingBases");
        }
    }
}
