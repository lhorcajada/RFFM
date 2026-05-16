using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Approach : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_SeasonPrepSessions_UserId",
                schema: "app",
                table: "SeasonPrepSessions");

            migrationBuilder.DropIndex(
                name: "IX_SeasonPrepPlayerRatings_UserId_FedSeason_SeasonPrepPlayerId",
                schema: "app",
                table: "SeasonPrepPlayerRatings");

            migrationBuilder.AddColumn<string>(
                name: "BoardStateJson",
                schema: "app",
                table: "TaskTrainingBases",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SportEventId",
                schema: "app",
                table: "SeasonPrepSessions",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SportEventId",
                schema: "app",
                table: "SeasonPrepPlayerRatings",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "UserId",
                schema: "app",
                table: "SeasonPrepEvaluations",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "FedSeason",
                schema: "app",
                table: "SeasonPrepEvaluations",
                type: "character varying(10)",
                maxLength: 10,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "Id",
                schema: "app",
                table: "SeasonPrepEvaluations",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AddColumn<string>(
                name: "SportEventId",
                schema: "app",
                table: "SeasonPrepEvaluations",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.InsertData(
                schema: "app",
                table: "SportEventTypes",
                columns: new[] { "Id", "Name" },
                values: new object[] { 5, "Pruebas de acceso" });

            migrationBuilder.CreateIndex(
                name: "IX_SeasonPrepSessions_UserId_SportEventId",
                schema: "app",
                table: "SeasonPrepSessions",
                columns: new[] { "UserId", "SportEventId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SeasonPrepPlayerRatings_UserId_FedSeason_SportEventId_Seaso~",
                schema: "app",
                table: "SeasonPrepPlayerRatings",
                columns: new[] { "UserId", "FedSeason", "SportEventId", "SeasonPrepPlayerId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SeasonPrepEvaluations_UserId_FedSeason_SportEventId",
                schema: "app",
                table: "SeasonPrepEvaluations",
                columns: new[] { "UserId", "FedSeason", "SportEventId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_SeasonPrepSessions_UserId_SportEventId",
                schema: "app",
                table: "SeasonPrepSessions");

            migrationBuilder.DropIndex(
                name: "IX_SeasonPrepPlayerRatings_UserId_FedSeason_SportEventId_Seaso~",
                schema: "app",
                table: "SeasonPrepPlayerRatings");

            migrationBuilder.DropIndex(
                name: "IX_SeasonPrepEvaluations_UserId_FedSeason_SportEventId",
                schema: "app",
                table: "SeasonPrepEvaluations");

            migrationBuilder.DeleteData(
                schema: "app",
                table: "SportEventTypes",
                keyColumn: "Id",
                keyValue: 5);

            migrationBuilder.DropColumn(
                name: "BoardStateJson",
                schema: "app",
                table: "TaskTrainingBases");

            migrationBuilder.DropColumn(
                name: "SportEventId",
                schema: "app",
                table: "SeasonPrepSessions");

            migrationBuilder.DropColumn(
                name: "SportEventId",
                schema: "app",
                table: "SeasonPrepPlayerRatings");

            migrationBuilder.DropColumn(
                name: "SportEventId",
                schema: "app",
                table: "SeasonPrepEvaluations");

            migrationBuilder.AlterColumn<string>(
                name: "UserId",
                schema: "app",
                table: "SeasonPrepEvaluations",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(50)",
                oldMaxLength: 50);

            migrationBuilder.AlterColumn<string>(
                name: "FedSeason",
                schema: "app",
                table: "SeasonPrepEvaluations",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(10)",
                oldMaxLength: 10);

            migrationBuilder.AlterColumn<string>(
                name: "Id",
                schema: "app",
                table: "SeasonPrepEvaluations",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(50)",
                oldMaxLength: 50);

            migrationBuilder.CreateIndex(
                name: "IX_SeasonPrepSessions_UserId",
                schema: "app",
                table: "SeasonPrepSessions",
                column: "UserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SeasonPrepPlayerRatings_UserId_FedSeason_SeasonPrepPlayerId",
                schema: "app",
                table: "SeasonPrepPlayerRatings",
                columns: new[] { "UserId", "FedSeason", "SeasonPrepPlayerId" },
                unique: true);
        }
    }
}
