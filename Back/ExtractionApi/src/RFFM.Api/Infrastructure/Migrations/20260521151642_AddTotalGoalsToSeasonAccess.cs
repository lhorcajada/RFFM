using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTotalGoalsToSeasonAccess : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "TotalGoals",
                schema: "app",
                table: "SeasonAccessTrialPlayers",
                type: "integer",
                nullable: true);

            migrationBuilder.Sql(
                """
                DO $$
                BEGIN
                    IF to_regclass('app."SeasonAccessTrialDayRatings"') IS NOT NULL THEN
                        ALTER TABLE app."SeasonAccessTrialDayRatings"
                        ADD COLUMN IF NOT EXISTS "TotalGoals" integer;

                        CREATE INDEX IF NOT EXISTS "IX_SeasonAccessTrialDayRatings_TrialPlayerId"
                        ON app."SeasonAccessTrialDayRatings" ("TrialPlayerId");
                    END IF;
                END $$;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                DO $$
                BEGIN
                    IF to_regclass('app."SeasonAccessTrialDayRatings"') IS NOT NULL THEN
                        DROP INDEX IF EXISTS app."IX_SeasonAccessTrialDayRatings_TrialPlayerId";

                        ALTER TABLE app."SeasonAccessTrialDayRatings"
                        DROP COLUMN IF EXISTS "TotalGoals";
                    END IF;
                END $$;
                """);

            migrationBuilder.DropColumn(
                name: "TotalGoals",
                schema: "app",
                table: "SeasonAccessTrialPlayers");
        }
    }
}
