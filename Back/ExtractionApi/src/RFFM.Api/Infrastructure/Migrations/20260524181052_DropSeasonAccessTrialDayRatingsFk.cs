using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class DropSeasonAccessTrialDayRatingsFk : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "Status",
                schema: "app",
                table: "SeasonAccessTrialPlayers",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);

            migrationBuilder.AlterColumn<decimal>(
                name: "Score",
                schema: "app",
                table: "SeasonAccessTrialPlayers",
                type: "numeric(5,2)",
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "numeric",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "Notes",
                schema: "app",
                table: "SeasonAccessTrialPlayers",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TrialDayId",
                schema: "app",
                table: "SeasonAccessTrialPlayers",
                type: "text",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_SeasonAccessTrialPlayers_TrialDayId",
                schema: "app",
                table: "SeasonAccessTrialPlayers",
                column: "TrialDayId");

            migrationBuilder.AddForeignKey(
                name: "FK_SeasonAccessTrialPlayers_SeasonAccessTrialDays_TrialDayId",
                schema: "app",
                table: "SeasonAccessTrialPlayers",
                column: "TrialDayId",
                principalSchema: "app",
                principalTable: "SeasonAccessTrialDays",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_SeasonAccessTrialPlayers_SeasonAccessTrialDays_TrialDayId",
                schema: "app",
                table: "SeasonAccessTrialPlayers");

            migrationBuilder.DropIndex(
                name: "IX_SeasonAccessTrialPlayers_TrialDayId",
                schema: "app",
                table: "SeasonAccessTrialPlayers");

            migrationBuilder.DropColumn(
                name: "TrialDayId",
                schema: "app",
                table: "SeasonAccessTrialPlayers");

            migrationBuilder.AlterColumn<string>(
                name: "Status",
                schema: "app",
                table: "SeasonAccessTrialPlayers",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(50)",
                oldMaxLength: 50,
                oldNullable: true);

            migrationBuilder.AlterColumn<decimal>(
                name: "Score",
                schema: "app",
                table: "SeasonAccessTrialPlayers",
                type: "numeric",
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "numeric(5,2)",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "Notes",
                schema: "app",
                table: "SeasonAccessTrialPlayers",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(1000)",
                oldMaxLength: 1000,
                oldNullable: true);
        }
    }
}
