using Microsoft.EntityFrameworkCore.Migrations;
using RFFM.Api.Infrastructure.Persistence;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    [Microsoft.EntityFrameworkCore.Infrastructure.DbContext(typeof(AppDbContext))]
    [Migration("20260611111000_AddMissingSportEventIsHomeMatchColumn")]
    public partial class AddMissingSportEventIsHomeMatchColumn : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                ALTER TABLE app.""SportEvents""
                ADD COLUMN IF NOT EXISTS ""IsHomeMatch"" boolean NOT NULL DEFAULT TRUE;
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                ALTER TABLE app.""SportEvents""
                DROP COLUMN IF EXISTS ""IsHomeMatch"";
            ");
        }
    }
}