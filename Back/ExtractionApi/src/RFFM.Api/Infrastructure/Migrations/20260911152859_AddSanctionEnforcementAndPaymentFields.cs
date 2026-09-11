using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSanctionEnforcementAndPaymentFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "AmountPaid",
                schema: "app",
                table: "TeamPlayerSanctions",
                type: "numeric(10,2)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "MinutesLimit",
                schema: "app",
                table: "TeamPlayerSanctions",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SportivePunishmentType",
                schema: "app",
                table: "TeamPlayerSanctions",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TargetEventId",
                schema: "app",
                table: "TeamPlayerSanctions",
                type: "character varying(450)",
                maxLength: 450,
                nullable: true);

            migrationBuilder.InsertData(
                schema: "app",
                table: "ExcuseTypes",
                columns: new[] { "Id", "Justified", "Name" },
                values: new object[] { 8, true, "Sanción deportiva" });

            migrationBuilder.CreateIndex(
                name: "IX_TeamPlayerSanctions_TargetEventId",
                schema: "app",
                table: "TeamPlayerSanctions",
                column: "TargetEventId");

            migrationBuilder.AddForeignKey(
                name: "FK_TeamPlayerSanctions_SportEvents_TargetEventId",
                schema: "app",
                table: "TeamPlayerSanctions",
                column: "TargetEventId",
                principalSchema: "app",
                principalTable: "SportEvents",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TeamPlayerSanctions_SportEvents_TargetEventId",
                schema: "app",
                table: "TeamPlayerSanctions");

            migrationBuilder.DropIndex(
                name: "IX_TeamPlayerSanctions_TargetEventId",
                schema: "app",
                table: "TeamPlayerSanctions");

            migrationBuilder.DeleteData(
                schema: "app",
                table: "ExcuseTypes",
                keyColumn: "Id",
                keyValue: 8);

            migrationBuilder.DropColumn(
                name: "AmountPaid",
                schema: "app",
                table: "TeamPlayerSanctions");

            migrationBuilder.DropColumn(
                name: "MinutesLimit",
                schema: "app",
                table: "TeamPlayerSanctions");

            migrationBuilder.DropColumn(
                name: "SportivePunishmentType",
                schema: "app",
                table: "TeamPlayerSanctions");

            migrationBuilder.DropColumn(
                name: "TargetEventId",
                schema: "app",
                table: "TeamPlayerSanctions");
        }
    }
}
