using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSectionToTaskTraining : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Add with a temporary default so existing rows get a value
            migrationBuilder.AddColumn<string>(
                name: "Section",
                schema: "app",
                table: "TaskTrainings",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "Principal");

            // Copy the section from the linked exercise (best-effort default)
            migrationBuilder.Sql(
                @"UPDATE app.""TaskTrainings"" tt
                  SET ""Section"" = (
                      SELECT ""Section"" FROM app.""TaskTrainingBases""
                      WHERE ""Id"" = tt.""TaskTrainingBaseId""
                  )
                  WHERE EXISTS (
                      SELECT 1 FROM app.""TaskTrainingBases""
                      WHERE ""Id"" = tt.""TaskTrainingBaseId""
                  );");

            // Remove the column default — section must be supplied explicitly from now on
            migrationBuilder.AlterColumn<string>(
                name: "Section",
                schema: "app",
                table: "TaskTrainings",
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
                table: "TaskTrainings");
        }
    }
}
