using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddUniqueConvocationPerEventAndPlayer : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Existing duplicates (same player convocated twice to the same event) must go before
            // the unique index can be created. Keep the most meaningful row: attendance already
            // marked, then a decided status (not Pending = 1), then the latest response.
            migrationBuilder.Sql("""
                DELETE FROM app."Convocations" c
                USING (
                    SELECT "Id",
                           ROW_NUMBER() OVER (
                               PARTITION BY "SportEventId", "TeamPlayerId"
                               ORDER BY ("AssistanceTypeId" IS NOT NULL) DESC,
                                        (COALESCE("ConvocationStatusId", 1) <> 1) DESC,
                                        "ResponseDateTime" DESC NULLS LAST,
                                        "Id"
                           ) AS rn
                    FROM app."Convocations"
                ) ranked
                WHERE c."Id" = ranked."Id" AND ranked.rn > 1;
                """);

            migrationBuilder.DropIndex(
                name: "IX_Convocations_SportEventId",
                schema: "app",
                table: "Convocations");

            migrationBuilder.CreateIndex(
                name: "IX_Convocations_SportEventId_TeamPlayerId",
                schema: "app",
                table: "Convocations",
                columns: new[] { "SportEventId", "TeamPlayerId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Convocations_SportEventId_TeamPlayerId",
                schema: "app",
                table: "Convocations");

            migrationBuilder.CreateIndex(
                name: "IX_Convocations_SportEventId",
                schema: "app",
                table: "Convocations",
                column: "SportEventId");
        }
    }
}
