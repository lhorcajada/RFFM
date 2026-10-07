using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddUnforeseenEventExcuseType : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                schema: "app",
                table: "ExcuseTypes",
                columns: new[] { "Id", "Justified", "Name" },
                values: new object[] { 10, true, "Imprevisto" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                schema: "app",
                table: "ExcuseTypes",
                keyColumn: "Id",
                keyValue: 10);
        }
    }
}
