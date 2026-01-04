using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class UpdateExcuseTypes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "Justified",
                schema: "app",
                table: "ExcuseTypes",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.UpdateData(
                schema: "app",
                table: "ExcuseTypes",
                keyColumn: "Id",
                keyValue: 1,
                column: "Justified",
                value: true);

            migrationBuilder.UpdateData(
                schema: "app",
                table: "ExcuseTypes",
                keyColumn: "Id",
                keyValue: 2,
                column: "Justified",
                value: true);

            migrationBuilder.UpdateData(
                schema: "app",
                table: "ExcuseTypes",
                keyColumn: "Id",
                keyValue: 3,
                column: "Justified",
                value: true);

            migrationBuilder.InsertData(
                schema: "app",
                table: "ExcuseTypes",
                columns: new[] { "Id", "Justified", "Name" },
                values: new object[,]
                {
                    { 4, true, "Family Problem" },
                    { 5, false, "Family Event" },
                    { 6, false, "Birthday Event" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                schema: "app",
                table: "ExcuseTypes",
                keyColumn: "Id",
                keyValue: 4);

            migrationBuilder.DeleteData(
                schema: "app",
                table: "ExcuseTypes",
                keyColumn: "Id",
                keyValue: 5);

            migrationBuilder.DeleteData(
                schema: "app",
                table: "ExcuseTypes",
                keyColumn: "Id",
                keyValue: 6);

            migrationBuilder.DropColumn(
                name: "Justified",
                schema: "app",
                table: "ExcuseTypes");
        }
    }
}
