#nullable disable

using Microsoft.EntityFrameworkCore.Migrations;

namespace RFFM.Api.Infrastructure.Migrations.Identity
{
    /// <inheritdoc />
    public partial class UpdateRoles : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Insert roles if they don't exist. Use deterministic GUIDs for Ids to avoid duplicates.
            migrationBuilder.Sql(@"
IF NOT EXISTS (SELECT 1 FROM dbo.AspNetRoles WHERE NormalizedName = 'COACH')
BEGIN
    INSERT INTO dbo.AspNetRoles (Id, [Name], NormalizedName, ConcurrencyStamp) VALUES (NEWID(), 'Coach', 'COACH', NEWID())
END
IF NOT EXISTS (SELECT 1 FROM dbo.AspNetRoles WHERE NormalizedName = 'FEDERATION')
BEGIN
    INSERT INTO dbo.AspNetRoles (Id, [Name], NormalizedName, ConcurrencyStamp) VALUES (NEWID(), 'Federation', 'FEDERATION', NEWID())
END
IF NOT EXISTS (SELECT 1 FROM dbo.AspNetRoles WHERE NormalizedName = 'ADMINISTRATOR')
BEGIN
    INSERT INTO dbo.AspNetRoles (Id, [Name], NormalizedName, ConcurrencyStamp) VALUES (NEWID(), 'Administrator', 'ADMINISTRATOR', NEWID())
END
IF NOT EXISTS (SELECT 1 FROM dbo.AspNetRoles WHERE NormalizedName = 'USER')
BEGIN
    INSERT INTO dbo.AspNetRoles (Id, [Name], NormalizedName, ConcurrencyStamp) VALUES (NEWID(), 'User', 'USER', NEWID())
END
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DELETE FROM dbo.AspNetRoles WHERE NormalizedName IN ('COACH','FEDERATION','ADMINISTRATOR','USER');");
        }
    }
}
