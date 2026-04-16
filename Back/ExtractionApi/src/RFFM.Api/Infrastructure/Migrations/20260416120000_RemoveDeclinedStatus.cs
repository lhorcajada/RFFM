using Microsoft.EntityFrameworkCore.Migrations;

namespace RFFM.Api.Infrastructure.Migrations
{
    public partial class RemoveDeclinedStatus : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Migrate all Declined convocations (statusId=3) to Deconvoke (statusId=5),
            // preserving any existing ExcuseTypeId they already have.
            migrationBuilder.Sql(
                @"UPDATE app.""Convocations""
                  SET ""ConvocationStatusId"" = 5
                  WHERE ""ConvocationStatusId"" = 3;"
            );

            // Remove the Declined status from the catalog
            migrationBuilder.DeleteData(
                schema: "app",
                table: "ConvocationStatuses",
                keyColumn: "Id",
                keyValue: 3);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Restore the Declined status row
            migrationBuilder.InsertData(
                schema: "app",
                table: "ConvocationStatuses",
                columns: new[] { "Id", "Name" },
                values: new object[] { 3, "Declined" });

            // Note: we do NOT roll back the data update because we cannot
            // deterministically distinguish records that were originally Declined
            // from those set to Deconvoke by the coach.
        }
    }
}
