using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddHabilidadesToExerciseModelRelationItem : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Habilidades",
                schema: "app",
                table: "ExerciseModelRelationItems",
                type: "jsonb",
                nullable: false,
                defaultValue: "[]");

            // Backfill: each existing item inherits the relation-level Habilidades that its own
            // SubSubPrincipio actually defines in the GameModel.
            migrationBuilder.Sql("""
                UPDATE app."ExerciseModelRelationItems" AS i
                SET "Habilidades" = COALESCE((
                    SELECT jsonb_agg(h.value ORDER BY h.ordinality)
                    FROM app."ExerciseModelRelations" AS r,
                         jsonb_array_elements_text(r."HabilidadesImprescindibles") WITH ORDINALITY AS h(value, ordinality)
                    WHERE r."Id" = i."ExerciseModelRelationId"
                      AND EXISTS (
                          SELECT 1 FROM app."Habilidades" AS mh
                          WHERE mh."SubSubPrincipioId" = i."SubSubPrincipioId" AND mh."Nombre" = h.value)
                ), '[]'::jsonb);
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Habilidades",
                schema: "app",
                table: "ExerciseModelRelationItems");
        }
    }
}
