using Microsoft.EntityFrameworkCore.Migrations;

namespace RFFM.Api.Infrastructure.Migrations
{
    public partial class AddDeconvokeStatusAndTechnicalDecisionExcuse : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Insert new ConvocationStatus: Deconvoke
            migrationBuilder.InsertData(
                schema: "app",
                table: "ConvocationStatuses",
                columns: new[] { "Id", "Name" },
                values: new object[] { 5, "Deconvoke" }
            );

            // Insert new ExcuseType: Decisión técnica
            migrationBuilder.InsertData(
                schema: "app",
                table: "ExcuseTypes",
                columns: new[] { "Id", "Name", "Justified" },
                values: new object[] { 7, "Decisión técnica", false }
            );
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                schema: "app",
                table: "ConvocationStatuses",
                keyColumn: "Id",
                keyValue: 5
            );

            migrationBuilder.DeleteData(
                schema: "app",
                table: "ExcuseTypes",
                keyColumn: "Id",
                keyValue: 7
            );
        }
    }
}