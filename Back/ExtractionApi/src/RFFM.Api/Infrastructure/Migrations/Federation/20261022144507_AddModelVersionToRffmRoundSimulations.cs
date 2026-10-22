using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations.Federation
{
    /// <inheritdoc />
    public partial class AddModelVersionToRffmRoundSimulations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsBackfilled",
                schema: "federation",
                table: "RffmRoundSimulations",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "ModelVersion",
                schema: "federation",
                table: "RffmRoundSimulations",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            // Las simulaciones rellenadas a posteriori se congelaron en el mismo instante en que se calcularon;
            // con versión 0 se recalcularán con el modelo actual.
            migrationBuilder.Sql(
                """UPDATE federation."RffmRoundSimulations" SET "IsBackfilled" = TRUE WHERE "FrozenAt" IS NOT NULL AND "FrozenAt" = "ComputedAt";""");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsBackfilled",
                schema: "federation",
                table: "RffmRoundSimulations");

            migrationBuilder.DropColumn(
                name: "ModelVersion",
                schema: "federation",
                table: "RffmRoundSimulations");
        }
    }
}
