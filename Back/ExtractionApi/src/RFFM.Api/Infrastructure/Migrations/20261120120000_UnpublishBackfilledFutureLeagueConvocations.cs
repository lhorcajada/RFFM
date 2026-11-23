using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class UnpublishBackfilledFutureLeagueConvocations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // AddConvocationPublishedAtToSportEvent marked every existing league match as published, also the
            // upcoming ones whose convocation was still a draft. That statement stamped all of them with the
            // same instant, so the upcoming matches that share a publication instant with other matches are
            // the backfilled ones; a convocation published by a coach carries its own instant and is kept.
            migrationBuilder.Sql(
                """
                UPDATE app."SportEvents"
                SET "ConvocationPublishedAt" = NULL
                WHERE "EventTypeId" = 1
                  AND "EveDateTime" > now()
                  AND "ConvocationPublishedAt" IN (
                      SELECT "ConvocationPublishedAt"
                      FROM app."SportEvents"
                      WHERE "ConvocationPublishedAt" IS NOT NULL
                      GROUP BY "ConvocationPublishedAt"
                      HAVING count(*) > 1);
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}
