using Microsoft.EntityFrameworkCore.Migrations;
using RFFM.Api.Infrastructure.Persistence;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations.Federation
{
    [Microsoft.EntityFrameworkCore.Infrastructure.DbContext(typeof(FederationDbContext))]
    [Migration("20260503000001_MoveFederationToSchema")]
    /// <inheritdoc />
    public partial class MoveFederationToSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"CREATE SCHEMA IF NOT EXISTS federation;");

            migrationBuilder.Sql(@"
                DO $$ BEGIN
                    IF EXISTS (
                        SELECT 1 FROM information_schema.tables
                        WHERE table_schema = 'public' AND table_name = 'FederationSettings'
                    ) AND NOT EXISTS (
                        SELECT 1 FROM information_schema.tables
                        WHERE table_schema = 'federation' AND table_name = 'FederationSettings'
                    ) THEN
                        ALTER TABLE public.""FederationSettings"" SET SCHEMA federation;
                    END IF;
                END $$;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                DO $$ BEGIN
                    IF EXISTS (
                        SELECT 1 FROM information_schema.tables
                        WHERE table_schema = 'federation' AND table_name = 'FederationSettings'
                    ) AND NOT EXISTS (
                        SELECT 1 FROM information_schema.tables
                        WHERE table_schema = 'public' AND table_name = 'FederationSettings'
                    ) THEN
                        ALTER TABLE federation.""FederationSettings"" SET SCHEMA public;
                    END IF;
                END $$;
            ");
        }
    }
}
