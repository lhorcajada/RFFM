using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class MakeAssistanceTypeIdNullable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Convocations_AssistanceTypes_AssistanceTypeId",
                schema: "app",
                table: "Convocations");

            migrationBuilder.AlterColumn<int>(
                name: "AssistanceTypeId",
                schema: "app",
                table: "Convocations",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AddForeignKey(
                name: "FK_Convocations_AssistanceTypes_AssistanceTypeId",
                schema: "app",
                table: "Convocations",
                column: "AssistanceTypeId",
                principalSchema: "app",
                principalTable: "AssistanceTypes",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Convocations_AssistanceTypes_AssistanceTypeId",
                schema: "app",
                table: "Convocations");

            migrationBuilder.AlterColumn<int>(
                name: "AssistanceTypeId",
                schema: "app",
                table: "Convocations",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Convocations_AssistanceTypes_AssistanceTypeId",
                schema: "app",
                table: "Convocations",
                column: "AssistanceTypeId",
                principalSchema: "app",
                principalTable: "AssistanceTypes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
