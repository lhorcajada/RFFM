using Microsoft.EntityFrameworkCore.Migrations;
using RFFM.Api.Infrastructure.Persistence;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    [Microsoft.EntityFrameworkCore.Infrastructure.DbContext(typeof(AppDbContext))]
    [Migration("20260401163622_AddMissingAppTables")]
    /// <inheritdoc />
    public partial class AddMissingAppTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // SeasonPrepSessions
            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS app.""SeasonPrepSessions"" (
                    ""Id""        character varying(50)  NOT NULL,
                    ""UserId""    character varying(50)  NOT NULL,
                    ""Data""      text                   NOT NULL,
                    ""UpdatedAt"" timestamp with time zone NOT NULL,
                    CONSTRAINT ""PK_SeasonPrepSessions"" PRIMARY KEY (""Id"")
                );
            ");

            migrationBuilder.Sql(@"CREATE UNIQUE INDEX IF NOT EXISTS ""IX_SeasonPrepSessions_UserId"" ON app.""SeasonPrepSessions"" (""UserId"");");

            // SeasonPrepEvaluations
            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS app.""SeasonPrepEvaluations"" (
                    ""Id""        text NOT NULL,
                    ""UserId""    text NOT NULL,
                    ""FedSeason"" text NOT NULL,
                    ""Data""      text NOT NULL,
                    ""UpdatedAt"" timestamp with time zone NOT NULL,
                    CONSTRAINT ""PK_SeasonPrepEvaluations"" PRIMARY KEY (""Id"")
                );
            ");

            // MatchParticipations
            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS app.""MatchParticipations"" (
                    ""Id""                      text                     NOT NULL,
                    ""EventId""                 character varying(200)   NOT NULL,
                    ""TeamId""                  character varying(200)   NOT NULL,
                    ""TeamPlayerId""            character varying(200)   NOT NULL,
                    ""IsStarter""               boolean                  NOT NULL,
                    ""MatchPhase""              character varying(50)    NOT NULL,
                    ""EnteredAtMinute""         integer,
                    ""ExitedAtMinute""          integer,
                    ""MinutesPlayed""           integer                  NOT NULL,
                    ""ScoreLocal""              integer                  NOT NULL,
                    ""ScoreVisitor""            integer                  NOT NULL,
                    ""GoalsJson""              text,
                    ""RatingSnapshotsJson""     text,
                    ""SubstitutionWindowsJson"" text,
                    ""CreatedAt""              timestamp with time zone  NOT NULL,
                    ""UpdatedAt""              timestamp with time zone  NOT NULL,
                    CONSTRAINT ""PK_MatchParticipations"" PRIMARY KEY (""Id"")
                );
            ");

            migrationBuilder.Sql(@"CREATE UNIQUE INDEX IF NOT EXISTS ""IX_MatchParticipations_EventId_TeamPlayerId"" ON app.""MatchParticipations"" (""EventId"", ""TeamPlayerId"");");
            migrationBuilder.Sql(@"CREATE INDEX IF NOT EXISTS ""IX_MatchParticipations_TeamId_EventId"" ON app.""MatchParticipations"" (""TeamId"", ""EventId"");");

            // TeamPlayerInjuries
            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS app.""TeamPlayerInjuries"" (
                    ""Id""                text                     NOT NULL,
                    ""TeamPlayerId""      text                     NOT NULL,
                    ""InjuryType""        character varying(200)   NOT NULL,
                    ""StartDate""         timestamp with time zone NOT NULL,
                    ""EndDate""           timestamp with time zone,
                    ""EstimatedRecovery"" character varying(200),
                    ""Description""       character varying(1000),
                    CONSTRAINT ""PK_TeamPlayerInjuries"" PRIMARY KEY (""Id"")
                );
            ");

            migrationBuilder.Sql(@"CREATE INDEX IF NOT EXISTS ""IX_TeamPlayerInjuries_TeamPlayerId"" ON app.""TeamPlayerInjuries"" (""TeamPlayerId"");");
            migrationBuilder.Sql(@"CREATE INDEX IF NOT EXISTS ""IX_TeamPlayerInjuries_TeamPlayerId_EndDate"" ON app.""TeamPlayerInjuries"" (""TeamPlayerId"", ""EndDate"");");

            migrationBuilder.Sql(@"
                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'FK_TeamPlayerInjuries_TeamPlayers_TeamPlayerId' AND table_schema = 'app') THEN
                        ALTER TABLE app.""TeamPlayerInjuries"" ADD CONSTRAINT ""FK_TeamPlayerInjuries_TeamPlayers_TeamPlayerId"" FOREIGN KEY (""TeamPlayerId"") REFERENCES app.""TeamPlayers""(""Id"") ON DELETE CASCADE;
                    END IF;
                END $$;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"DROP TABLE IF EXISTS app.""TeamPlayerInjuries"";");
            migrationBuilder.Sql(@"DROP TABLE IF EXISTS app.""MatchParticipations"";");
            migrationBuilder.Sql(@"DROP TABLE IF EXISTS app.""SeasonPrepEvaluations"";");
            migrationBuilder.Sql(@"DROP TABLE IF EXISTS app.""SeasonPrepSessions"";");
        }
    }
}
