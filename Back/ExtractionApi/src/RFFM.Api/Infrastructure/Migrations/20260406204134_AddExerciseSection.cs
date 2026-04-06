using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddExerciseSection : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Add column with a temporary default so existing rows receive a value
            migrationBuilder.AddColumn<string>(
                name: "Section",
                schema: "app",
                table: "TaskTrainingBases",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "Principal");

            // Override defaults per discriminator
            migrationBuilder.Sql(
                "UPDATE app.\"TaskTrainingBases\" SET \"Section\" = 'Calentamiento' WHERE \"Discriminator\" = 'Technical';");
            migrationBuilder.Sql(
                "UPDATE app.\"TaskTrainingBases\" SET \"Section\" = 'Principal' WHERE \"Discriminator\" IN ('Tactical', 'Physical', 'Base');");

            // Remove the column default — values must be supplied explicitly from now on
            migrationBuilder.AlterColumn<string>(
                name: "Section",
                schema: "app",
                table: "TaskTrainingBases",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(50)",
                oldMaxLength: 50);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Section",
                schema: "app",
                table: "TaskTrainingBases");
        }
    }
}
