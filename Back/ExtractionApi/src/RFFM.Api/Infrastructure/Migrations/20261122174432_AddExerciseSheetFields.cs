using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <summary>
    /// Adds the structured sheet fields to TaskTrainingBases and copies the legacy free text into them
    /// literally, without splitting it: Descripcion becomes one line of Secuencia, Logistica becomes
    /// Espacio and ObjetivoPorRol becomes one objective line of a single team with no color. The legacy
    /// columns, Dibujo included, are kept. An empty legacy field creates no empty line.
    /// </summary>
    public partial class AddExerciseSheetFields : Migration
    {
        /// <summary>
        /// Exposed as a constant so tests can run the exact same statement against arbitrary data. It only
        /// touches rows whose new fields are all still empty, so running it again changes nothing.
        /// </summary>
        public const string BackfillSql = """
            UPDATE app."TaskTrainingBases"
            SET "Secuencia" = CASE
                    WHEN btrim("Descripcion") <> '' THEN jsonb_build_array("Descripcion")
                    ELSE '[]'::jsonb END,
                "Espacio" = CASE
                    WHEN btrim("Logistica") <> '' THEN "Logistica"
                    ELSE NULL END,
                "Jugadores" = CASE
                    WHEN btrim(coalesce("ObjetivoPorRol", '')) <> '' THEN jsonb_build_array(
                        jsonb_build_object(
                            'Color', NULL::text,
                            'Nombre', '',
                            'Cantidad', NULL::int,
                            'Roles', NULL::text,
                            'Objetivos', jsonb_build_array("ObjetivoPorRol")))
                    ELSE '[]'::jsonb END
            WHERE "Secuencia" = '[]'::jsonb
              AND "Reglas" = '[]'::jsonb
              AND "QueSeVe" = '[]'::jsonb
              AND "Jugadores" = '[]'::jsonb
              AND "Espacio" IS NULL;
            """;

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Espacio",
                schema: "app",
                table: "TaskTrainingBases",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Jugadores",
                schema: "app",
                table: "TaskTrainingBases",
                type: "jsonb",
                nullable: false,
                defaultValueSql: "'[]'::jsonb");

            migrationBuilder.AddColumn<int>(
                name: "NivelDibujo",
                schema: "app",
                table: "TaskTrainingBases",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "QueSeVe",
                schema: "app",
                table: "TaskTrainingBases",
                type: "jsonb",
                nullable: false,
                defaultValueSql: "'[]'::jsonb");

            migrationBuilder.AddColumn<string>(
                name: "Reglas",
                schema: "app",
                table: "TaskTrainingBases",
                type: "jsonb",
                nullable: false,
                defaultValueSql: "'[]'::jsonb");

            migrationBuilder.AddColumn<string>(
                name: "Secuencia",
                schema: "app",
                table: "TaskTrainingBases",
                type: "jsonb",
                nullable: false,
                defaultValueSql: "'[]'::jsonb");

            migrationBuilder.AddColumn<int>(
                name: "TurnoMinutos",
                schema: "app",
                table: "TaskTrainingBases",
                type: "integer",
                nullable: true);

            migrationBuilder.Sql(BackfillSql);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Espacio",
                schema: "app",
                table: "TaskTrainingBases");

            migrationBuilder.DropColumn(
                name: "Jugadores",
                schema: "app",
                table: "TaskTrainingBases");

            migrationBuilder.DropColumn(
                name: "NivelDibujo",
                schema: "app",
                table: "TaskTrainingBases");

            migrationBuilder.DropColumn(
                name: "QueSeVe",
                schema: "app",
                table: "TaskTrainingBases");

            migrationBuilder.DropColumn(
                name: "Reglas",
                schema: "app",
                table: "TaskTrainingBases");

            migrationBuilder.DropColumn(
                name: "Secuencia",
                schema: "app",
                table: "TaskTrainingBases");

            migrationBuilder.DropColumn(
                name: "TurnoMinutos",
                schema: "app",
                table: "TaskTrainingBases");
        }
    }
}
