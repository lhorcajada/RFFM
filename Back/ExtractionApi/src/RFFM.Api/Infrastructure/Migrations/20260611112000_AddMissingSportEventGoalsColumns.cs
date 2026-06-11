using Microsoft.EntityFrameworkCore.Migrations;
using RFFM.Api.Infrastructure.Persistence;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    [Microsoft.EntityFrameworkCore.Infrastructure.DbContext(typeof(AppDbContext))]
    [Migration("20260611112000_AddMissingSportEventGoalsColumns")]
    public partial class AddMissingSportEventGoalsColumns : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                ALTER TABLE app.""SportEvents""
                ADD COLUMN IF NOT EXISTS ""LocalGoals"" text;

                ALTER TABLE app.""SportEvents""
                ADD COLUMN IF NOT EXISTS ""VisitorGoals"" text;
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                ALTER TABLE app.""SportEvents""
                DROP COLUMN IF EXISTS ""LocalGoals"";

                ALTER TABLE app.""SportEvents""
                DROP COLUMN IF EXISTS ""VisitorGoals"";
            ");
        }
    }
}