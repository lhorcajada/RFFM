using Microsoft.EntityFrameworkCore.Migrations;
using RFFM.Api.Infrastructure.Persistence;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    [Microsoft.EntityFrameworkCore.Infrastructure.DbContext(typeof(AppDbContext))]
    [Migration("20260723162135_FixTacticalPrincipleForeignKeys")]
    /// <inheritdoc />
    /// <summary>
    /// The migration that created app."ScenarioTacticalPrinciples" and
    /// app."SubPrincipleTacticalPrinciples" (20260401163621_AddSubPrinciplesTables) mistakenly
    /// pointed their "TechnicalGoalId" foreign keys at app."TechnicalGoals" (the unrelated 8-row
    /// individual-training-goal catalog) instead of app."TacticalGoals" (the 21-row collective
    /// tactical-principle catalog actually surfaced by GET /api/technical-goals and selected by
    /// the frontend). This corrects both FKs to reference the right table, preserving the
    /// existing column name and ON DELETE CASCADE behavior.
    /// </summary>
    public partial class FixTacticalPrincipleForeignKeys : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                DO $$ BEGIN
                    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'FK_ScenarioTacticalPrinciples_TechnicalGoals_TechnicalGoalId' AND table_schema = 'app') THEN
                        ALTER TABLE app.""ScenarioTacticalPrinciples"" DROP CONSTRAINT ""FK_ScenarioTacticalPrinciples_TechnicalGoals_TechnicalGoalId"";
                    END IF;
                END $$;
            ");

            migrationBuilder.Sql(@"
                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'FK_ScenarioTacticalPrinciples_TacticalGoals_TechnicalGoalId' AND table_schema = 'app') THEN
                        ALTER TABLE app.""ScenarioTacticalPrinciples"" ADD CONSTRAINT ""FK_ScenarioTacticalPrinciples_TacticalGoals_TechnicalGoalId"" FOREIGN KEY (""TechnicalGoalId"") REFERENCES app.""TacticalGoals""(""Id"") ON DELETE CASCADE;
                    END IF;
                END $$;
            ");

            migrationBuilder.Sql(@"
                DO $$ BEGIN
                    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'FK_SubPrincipleTacticalPrinciples_TechnicalGoals_TechnicalGoalId' AND table_schema = 'app') THEN
                        ALTER TABLE app.""SubPrincipleTacticalPrinciples"" DROP CONSTRAINT ""FK_SubPrincipleTacticalPrinciples_TechnicalGoals_TechnicalGoalId"";
                    END IF;
                END $$;
            ");

            migrationBuilder.Sql(@"
                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'FK_SubPrincipleTacticalPrinciples_TacticalGoals_TechnicalGoalId' AND table_schema = 'app') THEN
                        ALTER TABLE app.""SubPrincipleTacticalPrinciples"" ADD CONSTRAINT ""FK_SubPrincipleTacticalPrinciples_TacticalGoals_TechnicalGoalId"" FOREIGN KEY (""TechnicalGoalId"") REFERENCES app.""TacticalGoals""(""Id"") ON DELETE CASCADE;
                    END IF;
                END $$;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                DO $$ BEGIN
                    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'FK_ScenarioTacticalPrinciples_TacticalGoals_TechnicalGoalId' AND table_schema = 'app') THEN
                        ALTER TABLE app.""ScenarioTacticalPrinciples"" DROP CONSTRAINT ""FK_ScenarioTacticalPrinciples_TacticalGoals_TechnicalGoalId"";
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

            migrationBuilder.Sql(@"
                DO $$ BEGIN
                    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'FK_SubPrincipleTacticalPrinciples_TacticalGoals_TechnicalGoalId' AND table_schema = 'app') THEN
                        ALTER TABLE app.""SubPrincipleTacticalPrinciples"" DROP CONSTRAINT ""FK_SubPrincipleTacticalPrinciples_TacticalGoals_TechnicalGoalId"";
                    END IF;
                END $$;
            ");

            migrationBuilder.Sql(@"
                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'FK_SubPrincipleTacticalPrinciples_TechnicalGoals_TechnicalGoalId' AND table_schema = 'app') THEN
                        ALTER TABLE app.""SubPrincipleTacticalPrinciples"" ADD CONSTRAINT ""FK_SubPrincipleTacticalPrinciples_TechnicalGoals_TechnicalGoalId"" FOREIGN KEY (""TechnicalGoalId"") REFERENCES app.""TechnicalGoals""(""Id"") ON DELETE CASCADE;
                    END IF;
                END $$;
            ");
        }
    }
}
