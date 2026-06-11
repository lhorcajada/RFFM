using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDemarcationsToTrialDayRatings : Migration
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
                        ADD COLUMN IF NOT EXISTS "IdealDemarcationId" integer;

                        ALTER TABLE app."SeasonAccessTrialDayRatings"
                        ADD COLUMN IF NOT EXISTS "PossibleDemarcationIds" integer[] NOT NULL DEFAULT ARRAY[]::integer[];
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
                        DROP COLUMN IF EXISTS "IdealDemarcationId";

                        ALTER TABLE app."SeasonAccessTrialDayRatings"
                        DROP COLUMN IF EXISTS "PossibleDemarcationIds";
                    END IF;
                END $$;
                """);
        }
    }
}
