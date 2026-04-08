using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSubPrincipleIdToTrainingSession : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "SubPrincipleId",
                schema: "app",
                table: "SessionTrainings",
                type: "character varying(36)",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_SessionTrainings_SubPrincipleId",
                schema: "app",
                table: "SessionTrainings",
                column: "SubPrincipleId");

            migrationBuilder.AddForeignKey(
                name: "FK_SessionTrainings_SubPrinciples_SubPrincipleId",
                schema: "app",
                table: "SessionTrainings",
                column: "SubPrincipleId",
                principalSchema: "app",
                principalTable: "SubPrinciples",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_SessionTrainings_SubPrinciples_SubPrincipleId",
                schema: "app",
                table: "SessionTrainings");

            migrationBuilder.DropIndex(
                name: "IX_SessionTrainings_SubPrincipleId",
                schema: "app",
                table: "SessionTrainings");

            migrationBuilder.DropColumn(
                name: "SubPrincipleId",
                schema: "app",
                table: "SessionTrainings");
        }
    }
}
