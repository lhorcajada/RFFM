using Microsoft.EntityFrameworkCore.Migrations;
using RFFM.Api.Infrastructure.Persistence;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    [Microsoft.EntityFrameworkCore.Infrastructure.DbContext(typeof(AppDbContext))]
    [Migration("20260611110000_AddMissingSportEventCodActaColumn")]
    public partial class AddMissingSportEventCodActaColumn : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                ALTER TABLE app.""SportEvents""
                ADD COLUMN IF NOT EXISTS ""CodActa"" text;
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                ALTER TABLE app.""SportEvents""
                DROP COLUMN IF EXISTS ""CodActa"";
            ");
        }
    }
}