using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSubPrincipleIdToTaskTrainingBase : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "SubPrincipleId",
                schema: "app",
                table: "TaskTrainingBases",
                type: "character varying(36)",
                maxLength: 36,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_TaskTrainingBases_SubPrincipleId",
                schema: "app",
                table: "TaskTrainingBases",
                column: "SubPrincipleId");

            migrationBuilder.AddForeignKey(
                name: "FK_TaskTrainingBases_SubPrinciples_SubPrincipleId",
                schema: "app",
                table: "TaskTrainingBases",
                column: "SubPrincipleId",
                principalSchema: "app",
                principalTable: "SubPrinciples",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TaskTrainingBases_SubPrinciples_SubPrincipleId",
                schema: "app",
                table: "TaskTrainingBases");

            migrationBuilder.DropIndex(
                name: "IX_TaskTrainingBases_SubPrincipleId",
                schema: "app",
                table: "TaskTrainingBases");

            migrationBuilder.DropColumn(
                name: "SubPrincipleId",
                schema: "app",
                table: "TaskTrainingBases");
        }
    }
}
