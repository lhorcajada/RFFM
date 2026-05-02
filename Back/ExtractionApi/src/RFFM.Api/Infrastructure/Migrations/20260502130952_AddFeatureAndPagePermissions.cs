using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddFeatureAndPagePermissions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // NOTE: Rivals.Category already existed in the database before this migration;
            // the AddColumn is intentionally omitted to avoid a duplicate-column error.

            migrationBuilder.CreateTable(
                name: "FeaturePermissions",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    FeatureName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    FeatureRoute = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    RoleName = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    PermissionTypeId = table.Column<int>(type: "integer", nullable: false),
                    IsEditable = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FeaturePermissions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PagePermissions",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    PageIdentifier = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    PermissionKey = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    RoleName = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    PermissionTypeId = table.Column<int>(type: "integer", nullable: false),
                    IsEditable = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PagePermissions", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FeaturePermissions_Id",
                schema: "app",
                table: "FeaturePermissions",
                column: "Id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FeaturePermissions_RoleName_FeatureRoute",
                schema: "app",
                table: "FeaturePermissions",
                columns: new[] { "RoleName", "FeatureRoute" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PagePermissions_Id",
                schema: "app",
                table: "PagePermissions",
                column: "Id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PagePermissions_RoleName_PageIdentifier_PermissionKey",
                schema: "app",
                table: "PagePermissions",
                columns: new[] { "RoleName", "PageIdentifier", "PermissionKey" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FeaturePermissions",
                schema: "app");

            migrationBuilder.DropTable(
                name: "PagePermissions",
                schema: "app");

            migrationBuilder.DropColumn(
                name: "Category",
                schema: "app",
                table: "Rivals");
        }
    }
}
