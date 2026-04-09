using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ChangeRatingScaleTo0_100 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Migrate existing data: multiply all values ×10 before changing column type
            migrationBuilder.Sql(@"
                UPDATE app.""TeamPlayerRatings""
                SET ""Technical""       = ""Technical""       * 10,
                    ""Tactical""        = ""Tactical""        * 10,
                    ""Physical""        = ""Physical""        * 10,
                    ""Competitiveness"" = ""Competitiveness"" * 10;
            ");

            migrationBuilder.AlterColumn<decimal>(
                name: "Technical",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(5,1)",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(4,1)");

            migrationBuilder.AlterColumn<decimal>(
                name: "Tactical",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(5,1)",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(4,1)");

            migrationBuilder.AlterColumn<decimal>(
                name: "Physical",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(5,1)",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(4,1)");

            migrationBuilder.AlterColumn<decimal>(
                name: "Competitiveness",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(5,1)",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(4,1)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<decimal>(
                name: "Technical",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(4,1)",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(5,1)");

            migrationBuilder.AlterColumn<decimal>(
                name: "Tactical",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(4,1)",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(5,1)");

            migrationBuilder.AlterColumn<decimal>(
                name: "Physical",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(4,1)",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(5,1)");

            migrationBuilder.AlterColumn<decimal>(
                name: "Competitiveness",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(4,1)",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(5,1)");
        }
    }
}
