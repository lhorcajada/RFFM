using Microsoft.EntityFrameworkCore.Migrations;
using RFFM.Api.Infrastructure.Persistence;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations.Identity
{
    [Microsoft.EntityFrameworkCore.Infrastructure.DbContext(typeof(IdentityDbContext))]
    [Migration("20260503000000_MoveIdentityToSchema")]
    /// <inheritdoc />
    public partial class MoveIdentityToSchema : Migration
    {
        private static readonly string[] _tables =
        [
            "AspNetRoles",
            "AspNetRoleClaims",
            "AspNetUsers",
            "AspNetUserClaims",
            "AspNetUserLogins",
            "AspNetUserRoles",
            "AspNetUserTokens"
        ];

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Ensure the identity schema exists
            migrationBuilder.Sql(@"CREATE SCHEMA IF NOT EXISTS identity;");

            // Move each table from public to identity schema if it still lives in public
            foreach (var table in _tables)
            {
                migrationBuilder.Sql($@"
                    DO $$ BEGIN
                        IF EXISTS (
                            SELECT 1 FROM information_schema.tables
                            WHERE table_schema = 'public' AND table_name = '{table}'
                        ) AND NOT EXISTS (
                            SELECT 1 FROM information_schema.tables
                            WHERE table_schema = 'identity' AND table_name = '{table}'
                        ) THEN
                            ALTER TABLE public.""{table}"" SET SCHEMA identity;
                        END IF;
                    END $$;
                ");
            }
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            foreach (var table in _tables)
            {
                migrationBuilder.Sql($@"
                    DO $$ BEGIN
                        IF EXISTS (
                            SELECT 1 FROM information_schema.tables
                            WHERE table_schema = 'identity' AND table_name = '{table}'
                        ) AND NOT EXISTS (
                            SELECT 1 FROM information_schema.tables
                            WHERE table_schema = 'public' AND table_name = '{table}'
                        ) THEN
                            ALTER TABLE identity.""{table}"" SET SCHEMA public;
                        END IF;
                    END $$;
                ");
            }
        }
    }
}
