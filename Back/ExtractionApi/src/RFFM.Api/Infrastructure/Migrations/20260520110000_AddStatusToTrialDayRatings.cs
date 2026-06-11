using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddStatusToTrialDayRatings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                DO $$
                BEGIN
                    IF to_regclass('app."SeasonAccessTrialDayRatings"') IS NOT NULL THEN
                        ALTER TABLE app."SeasonAccessTrialDayRatings"
                        ADD COLUMN IF NOT EXISTS "Status" character varying(50);
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
                        ALTER TABLE app."SeasonAccessTrialDayRatings"
                        DROP COLUMN IF EXISTS "Status";
                    END IF;
                END $$;
                """);
        }
    }
}
