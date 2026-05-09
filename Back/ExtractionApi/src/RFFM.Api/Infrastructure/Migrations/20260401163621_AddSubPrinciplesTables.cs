using Microsoft.EntityFrameworkCore.Migrations;
using RFFM.Api.Infrastructure.Persistence;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    [Microsoft.EntityFrameworkCore.Infrastructure.DbContext(typeof(AppDbContext))]
    [Migration("20260401163621_AddSubPrinciplesTables")]
    /// <inheritdoc />
    public partial class AddSubPrinciplesTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // GameScenarios
            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS app.""GameScenarios"" (
                    ""Id""           character varying(36)   NOT NULL,
                    ""GameModelId""  character varying(36)   NOT NULL,
                    ""GameMomentId"" integer                 NOT NULL,
                    ""GameZoneId""   integer                 NOT NULL,
                    ""Name""         character varying(300)  NOT NULL,
                    ""Context""      character varying(2000) NOT NULL,
                    ""Order""        integer                 NOT NULL DEFAULT 0,
                    CONSTRAINT ""PK_GameScenarios"" PRIMARY KEY (""Id"")
                );
            ");

            migrationBuilder.Sql(@"CREATE INDEX IF NOT EXISTS ""IX_GameScenarios_GameModelId"" ON app.""GameScenarios"" (""GameModelId"");");
            migrationBuilder.Sql(@"CREATE INDEX IF NOT EXISTS ""IX_GameScenarios_GameMomentId"" ON app.""GameScenarios"" (""GameMomentId"");");
            migrationBuilder.Sql(@"CREATE INDEX IF NOT EXISTS ""IX_GameScenarios_GameZoneId"" ON app.""GameScenarios"" (""GameZoneId"");");

            migrationBuilder.Sql(@"
                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'FK_GameScenarios_GameModels_GameModelId' AND table_schema = 'app') THEN
                        ALTER TABLE app.""GameScenarios"" ADD CONSTRAINT ""FK_GameScenarios_GameModels_GameModelId"" FOREIGN KEY (""GameModelId"") REFERENCES app.""GameModels""(""Id"") ON DELETE CASCADE;
                    END IF;
                END $$;
            ");

            migrationBuilder.Sql(@"
                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'FK_GameScenarios_GameMoments_GameMomentId' AND table_schema = 'app') THEN
                        ALTER TABLE app.""GameScenarios"" ADD CONSTRAINT ""FK_GameScenarios_GameMoments_GameMomentId"" FOREIGN KEY (""GameMomentId"") REFERENCES app.""GameMoments""(""Id"") ON DELETE CASCADE;
                    END IF;
                END $$;
            ");

            migrationBuilder.Sql(@"
                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'FK_GameScenarios_GameZones_GameZoneId' AND table_schema = 'app') THEN
                        ALTER TABLE app.""GameScenarios"" ADD CONSTRAINT ""FK_GameScenarios_GameZones_GameZoneId"" FOREIGN KEY (""GameZoneId"") REFERENCES app.""GameZones""(""Id"") ON DELETE CASCADE;
                    END IF;
                END $$;
            ");

            // ScenarioTacticalPrinciples
            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS app.""ScenarioTacticalPrinciples"" (
                    ""GameScenarioId""  character varying(36) NOT NULL,
                    ""TechnicalGoalId"" integer               NOT NULL,
                    CONSTRAINT ""PK_ScenarioTacticalPrinciples"" PRIMARY KEY (""GameScenarioId"", ""TechnicalGoalId"")
                );
            ");

            migrationBuilder.Sql(@"CREATE INDEX IF NOT EXISTS ""IX_ScenarioTacticalPrinciples_TechnicalGoalId"" ON app.""ScenarioTacticalPrinciples"" (""TechnicalGoalId"");");

            migrationBuilder.Sql(@"
                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'FK_ScenarioTacticalPrinciples_GameScenarios_GameScenarioId' AND table_schema = 'app') THEN
                        ALTER TABLE app.""ScenarioTacticalPrinciples"" ADD CONSTRAINT ""FK_ScenarioTacticalPrinciples_GameScenarios_GameScenarioId"" FOREIGN KEY (""GameScenarioId"") REFERENCES app.""GameScenarios""(""Id"") ON DELETE CASCADE;
                    END IF;
                END $$;
            ");

            migrationBuilder.Sql(@"
                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'FK_ScenarioTacticalPrinciples_TechnicalGoals_TechnicalGoalId' AND table_schema = 'app') THEN
                        ALTER TABLE app.""ScenarioTacticalPrinciples"" ADD CONSTRAINT ""FK_ScenarioTacticalPrinciples_TechnicalGoals_TechnicalGoalId"" FOREIGN KEY (""TechnicalGoalId"") REFERENCES app.""TechnicalGoals""(""Id"") ON DELETE CASCADE;
                    END IF;
                END $$;
            ");

            // SubPrinciples
            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS app.""SubPrinciples"" (
                    ""Id""             character varying(36)   NOT NULL,
                    ""GameScenarioId"" character varying(36)   NOT NULL,
                    ""Label""          character varying(10)   NOT NULL,
                    ""Name""           character varying(300)  NOT NULL,
                    ""Context""        character varying(2000) NOT NULL DEFAULT '',
                    ""Order""          integer                 NOT NULL DEFAULT 0,
                    CONSTRAINT ""PK_SubPrinciples"" PRIMARY KEY (""Id"")
                );
            ");

            migrationBuilder.Sql(@"
                CREATE INDEX IF NOT EXISTS ""IX_SubPrinciples_GameScenarioId""
                    ON app.""SubPrinciples"" (""GameScenarioId"");
            ");

            migrationBuilder.Sql(@"
                DO $$ BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.table_constraints
                        WHERE constraint_name = 'FK_SubPrinciples_GameScenarios_GameScenarioId'
                          AND table_schema = 'app'
                    ) THEN
                        ALTER TABLE app.""SubPrinciples""
                            ADD CONSTRAINT ""FK_SubPrinciples_GameScenarios_GameScenarioId""
                            FOREIGN KEY (""GameScenarioId"")
                            REFERENCES app.""GameScenarios""(""Id"")
                            ON DELETE CASCADE;
                    END IF;
                END $$;
            ");

            // SubSubPrinciples
            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS app.""SubSubPrinciples"" (
                    ""Id""             character varying(36)   NOT NULL,
                    ""SubPrincipleId"" character varying(36)   NOT NULL,
                    ""Name""           character varying(300)  NOT NULL,
                    ""Action""         character varying(2000) NOT NULL DEFAULT '',
                    ""Order""          integer                 NOT NULL DEFAULT 0,
                    CONSTRAINT ""PK_SubSubPrinciples"" PRIMARY KEY (""Id"")
                );
            ");

            migrationBuilder.Sql(@"
                CREATE INDEX IF NOT EXISTS ""IX_SubSubPrinciples_SubPrincipleId""
                    ON app.""SubSubPrinciples"" (""SubPrincipleId"");
            ");

            migrationBuilder.Sql(@"
                DO $$ BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.table_constraints
                        WHERE constraint_name = 'FK_SubSubPrinciples_SubPrinciples_SubPrincipleId'
                          AND table_schema = 'app'
                    ) THEN
                        ALTER TABLE app.""SubSubPrinciples""
                            ADD CONSTRAINT ""FK_SubSubPrinciples_SubPrinciples_SubPrincipleId""
                            FOREIGN KEY (""SubPrincipleId"")
                            REFERENCES app.""SubPrinciples""(""Id"")
                            ON DELETE CASCADE;
                    END IF;
                END $$;
            ");

            // SubPrincipleTacticalPrinciples (join table)
            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS app.""SubPrincipleTacticalPrinciples"" (
                    ""SubPrincipleId""  character varying(36) NOT NULL,
                    ""TechnicalGoalId"" integer               NOT NULL,
                    CONSTRAINT ""PK_SubPrincipleTacticalPrinciples"" PRIMARY KEY (""SubPrincipleId"", ""TechnicalGoalId"")
                );
            ");

            migrationBuilder.Sql(@"
                CREATE INDEX IF NOT EXISTS ""IX_SubPrincipleTacticalPrinciples_TechnicalGoalId""
                    ON app.""SubPrincipleTacticalPrinciples"" (""TechnicalGoalId"");
            ");

            migrationBuilder.Sql(@"
                DO $$ BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.table_constraints
                        WHERE constraint_name = 'FK_SubPrincipleTacticalPrinciples_SubPrinciples_SubPrincipleId'
                          AND table_schema = 'app'
                    ) THEN
                        ALTER TABLE app.""SubPrincipleTacticalPrinciples""
                            ADD CONSTRAINT ""FK_SubPrincipleTacticalPrinciples_SubPrinciples_SubPrincipleId""
                            FOREIGN KEY (""SubPrincipleId"")
                            REFERENCES app.""SubPrinciples""(""Id"")
                            ON DELETE CASCADE;
                    END IF;
                END $$;
            ");

            // EssentialSkills
            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS app.""EssentialSkills"" (
                    ""Id""                character varying(36)   NOT NULL,
                    ""SubSubPrincipleId"" character varying(36)   NOT NULL,
                    ""Name""              character varying(300)  NOT NULL,
                    ""Description""       character varying(2000) NOT NULL DEFAULT '',
                    ""MasteredAt""        timestamp with time zone,
                    CONSTRAINT ""PK_EssentialSkills"" PRIMARY KEY (""Id"")
                );
            ");

            migrationBuilder.Sql(@"
                CREATE INDEX IF NOT EXISTS ""IX_EssentialSkills_SubSubPrincipleId""
                    ON app.""EssentialSkills"" (""SubSubPrincipleId"");
            ");

            migrationBuilder.Sql(@"
                DO $$ BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.table_constraints
                        WHERE constraint_name = 'FK_EssentialSkills_SubSubPrinciples_SubSubPrincipleId'
                          AND table_schema = 'app'
                    ) THEN
                        ALTER TABLE app.""EssentialSkills""
                            ADD CONSTRAINT ""FK_EssentialSkills_SubSubPrinciples_SubSubPrincipleId""
                            FOREIGN KEY (""SubSubPrincipleId"")
                            REFERENCES app.""SubSubPrinciples""(""Id"")
                            ON DELETE CASCADE;
                    END IF;
                END $$;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"DROP TABLE IF EXISTS app.""EssentialSkills"";");
            migrationBuilder.Sql(@"DROP TABLE IF EXISTS app.""SubPrincipleTacticalPrinciples"";");
            migrationBuilder.Sql(@"DROP TABLE IF EXISTS app.""SubSubPrinciples"";");
            migrationBuilder.Sql(@"DROP TABLE IF EXISTS app.""SubPrinciples"";");
            migrationBuilder.Sql(@"DROP TABLE IF EXISTS app.""ScenarioTacticalPrinciples"";");
            migrationBuilder.Sql(@"DROP TABLE IF EXISTS app.""GameScenarios"";");
        }
    }
}
