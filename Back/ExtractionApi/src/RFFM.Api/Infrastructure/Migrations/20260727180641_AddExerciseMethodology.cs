using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddExerciseMethodology : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Methodology",
                schema: "app",
                table: "TaskTrainingBases",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "Integrado");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Methodology",
                schema: "app",
                table: "TaskTrainingBases");
        }
    }
}
