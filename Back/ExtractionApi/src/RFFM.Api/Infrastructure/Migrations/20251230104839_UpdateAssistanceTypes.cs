using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class UpdateAssistanceTypes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                schema: "app",
                table: "AssistanceTypes",
                columns: new[] { "Id", "Name", "Points" },
                values: new object[,]
                {
                    { 5, "Disponible", 0 },
                    { 6, "No disponible", 0 }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                schema: "app",
                table: "AssistanceTypes",
                keyColumn: "Id",
                keyValue: 5);

            migrationBuilder.DeleteData(
                schema: "app",
                table: "AssistanceTypes",
                keyColumn: "Id",
                keyValue: 6);
        }
    }
}
