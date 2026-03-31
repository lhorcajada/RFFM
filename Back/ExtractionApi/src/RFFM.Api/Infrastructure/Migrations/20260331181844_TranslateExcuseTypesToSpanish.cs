using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class TranslateExcuseTypesToSpanish : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                schema: "app",
                table: "ExcuseTypes",
                keyColumn: "Id",
                keyValue: 1,
                column: "Name",
                value: "Lesión");

            migrationBuilder.UpdateData(
                schema: "app",
                table: "ExcuseTypes",
                keyColumn: "Id",
                keyValue: 2,
                column: "Name",
                value: "Estudios");

            migrationBuilder.UpdateData(
                schema: "app",
                table: "ExcuseTypes",
                keyColumn: "Id",
                keyValue: 3,
                column: "Name",
                value: "Enfermedad");

            migrationBuilder.UpdateData(
                schema: "app",
                table: "ExcuseTypes",
                keyColumn: "Id",
                keyValue: 4,
                column: "Name",
                value: "Problema familiar");

            migrationBuilder.UpdateData(
                schema: "app",
                table: "ExcuseTypes",
                keyColumn: "Id",
                keyValue: 5,
                column: "Name",
                value: "Evento familiar");

            migrationBuilder.UpdateData(
                schema: "app",
                table: "ExcuseTypes",
                keyColumn: "Id",
                keyValue: 6,
                column: "Name",
                value: "Cumpleaños");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                schema: "app",
                table: "ExcuseTypes",
                keyColumn: "Id",
                keyValue: 1,
                column: "Name",
                value: "Injury");

            migrationBuilder.UpdateData(
                schema: "app",
                table: "ExcuseTypes",
                keyColumn: "Id",
                keyValue: 2,
                column: "Name",
                value: "Study");

            migrationBuilder.UpdateData(
                schema: "app",
                table: "ExcuseTypes",
                keyColumn: "Id",
                keyValue: 3,
                column: "Name",
                value: "Ill");

            migrationBuilder.UpdateData(
                schema: "app",
                table: "ExcuseTypes",
                keyColumn: "Id",
                keyValue: 4,
                column: "Name",
                value: "Family Problem");

            migrationBuilder.UpdateData(
                schema: "app",
                table: "ExcuseTypes",
                keyColumn: "Id",
                keyValue: 5,
                column: "Name",
                value: "Family Event");

            migrationBuilder.UpdateData(
                schema: "app",
                table: "ExcuseTypes",
                keyColumn: "Id",
                keyValue: 6,
                column: "Name",
                value: "Birthday Event");
        }
    }
}
