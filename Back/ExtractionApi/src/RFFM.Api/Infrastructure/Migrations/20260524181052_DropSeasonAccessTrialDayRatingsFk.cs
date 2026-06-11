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
            migrationBuilder.Sql(
                """
                DO $$
                BEGIN
                    IF to_regclass('app."SeasonAccessTrialPlayers"') IS NOT NULL THEN
                        ALTER TABLE app."SeasonAccessTrialPlayers"
                        ADD COLUMN IF NOT EXISTS "Status" character varying(50);

                        ALTER TABLE app."SeasonAccessTrialPlayers"
                        ADD COLUMN IF NOT EXISTS "Score" numeric(5,2);

                        ALTER TABLE app."SeasonAccessTrialPlayers"
                        ADD COLUMN IF NOT EXISTS "Notes" character varying(1000);

                        ALTER TABLE app."SeasonAccessTrialPlayers"
                        ALTER COLUMN "Status" TYPE character varying(50);

                        ALTER TABLE app."SeasonAccessTrialPlayers"
                        ALTER COLUMN "Score" TYPE numeric(5,2);

                        ALTER TABLE app."SeasonAccessTrialPlayers"
                        ALTER COLUMN "Notes" TYPE character varying(1000);

                        ALTER TABLE app."SeasonAccessTrialPlayers"
                        ADD COLUMN IF NOT EXISTS "TrialDayId" text;

                        CREATE INDEX IF NOT EXISTS "IX_SeasonAccessTrialPlayers_TrialDayId"
                        ON app."SeasonAccessTrialPlayers" ("TrialDayId");

                        ALTER TABLE app."SeasonAccessTrialPlayers"
                        DROP CONSTRAINT IF EXISTS "FK_SeasonAccessTrialPlayers_SeasonAccessTrialDays_TrialDayId";

                        IF to_regclass('app."SeasonAccessTrialDays"') IS NOT NULL THEN
                            ALTER TABLE app."SeasonAccessTrialPlayers"
                            ADD CONSTRAINT "FK_SeasonAccessTrialPlayers_SeasonAccessTrialDays_TrialDayId"
                            FOREIGN KEY ("TrialDayId")
                            REFERENCES app."SeasonAccessTrialDays" ("Id")
                            ON DELETE CASCADE;
                        END IF;
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
                    IF to_regclass('app."SeasonAccessTrialPlayers"') IS NOT NULL THEN
                        ALTER TABLE app."SeasonAccessTrialPlayers"
                        DROP CONSTRAINT IF EXISTS "FK_SeasonAccessTrialPlayers_SeasonAccessTrialDays_TrialDayId";

                        DROP INDEX IF EXISTS app."IX_SeasonAccessTrialPlayers_TrialDayId";

                        ALTER TABLE app."SeasonAccessTrialPlayers"
                        DROP COLUMN IF EXISTS "TrialDayId";

                        IF EXISTS (
                            SELECT 1
                            FROM information_schema.columns
                            WHERE table_schema = 'app'
                              AND table_name = 'SeasonAccessTrialPlayers'
                              AND column_name = 'Status'
                        ) THEN
                            ALTER TABLE app."SeasonAccessTrialPlayers"
                            ALTER COLUMN "Status" TYPE text;
                        END IF;

                        IF EXISTS (
                            SELECT 1
                            FROM information_schema.columns
                            WHERE table_schema = 'app'
                              AND table_name = 'SeasonAccessTrialPlayers'
                              AND column_name = 'Score'
                        ) THEN
                            ALTER TABLE app."SeasonAccessTrialPlayers"
                            ALTER COLUMN "Score" TYPE numeric;
                        END IF;

                        IF EXISTS (
                            SELECT 1
                            FROM information_schema.columns
                            WHERE table_schema = 'app'
                              AND table_name = 'SeasonAccessTrialPlayers'
                              AND column_name = 'Notes'
                        ) THEN
                            ALTER TABLE app."SeasonAccessTrialPlayers"
                            ALTER COLUMN "Notes" TYPE text;
                        END IF;
                    END IF;
                END $$;
                """);
        }
    }
}
