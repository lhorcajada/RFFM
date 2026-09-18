using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class FixSportEventTrainingTypesDefault : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // AddTrainingTypesToSportEvent used defaultValue: "" for this jsonb column, which is
            // not valid JSON — existing rows ended up with an unparseable value instead of "[]".
            migrationBuilder.Sql(
                "UPDATE app.\"SportEvents\" SET \"TrainingTypes\" = '[]' WHERE \"TrainingTypes\" IS NULL OR \"TrainingTypes\"::text !~ '^\\[.*\\]$';");

            migrationBuilder.AlterColumn<string>(
                name: "TrainingTypes",
                schema: "app",
                table: "SportEvents",
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
                name: "TrainingTypes",
                schema: "app",
                table: "SportEvents",
                type: "jsonb",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "jsonb",
                oldDefaultValue: "[]");
        }
    }
}
