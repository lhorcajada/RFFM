using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddMedicalAppointmentExcuseType : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                schema: "app",
                table: "ExcuseTypes",
                columns: new[] { "Id", "Justified", "Name" },
                values: new object[] { 9, true, "Cita médica" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                schema: "app",
                table: "ExcuseTypes",
                keyColumn: "Id",
                keyValue: 9);
        }
    }
}
