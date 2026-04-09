using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ChangeRatingScaleToDecimal0_10 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<decimal>(
                name: "Technical",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(4,1)",
                nullable: false,
                oldClrType: typeof(byte),
                oldType: "smallint");

            migrationBuilder.AlterColumn<decimal>(
                name: "Tactical",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(4,1)",
                nullable: false,
                oldClrType: typeof(byte),
                oldType: "smallint");

            migrationBuilder.AlterColumn<decimal>(
                name: "Physical",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(4,1)",
                nullable: false,
                oldClrType: typeof(byte),
                oldType: "smallint");

            migrationBuilder.AlterColumn<decimal>(
                name: "Competitiveness",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "numeric(4,1)",
                nullable: false,
                oldClrType: typeof(byte),
                oldType: "smallint");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<byte>(
                name: "Technical",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "smallint",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(4,1)");

            migrationBuilder.AlterColumn<byte>(
                name: "Tactical",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "smallint",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(4,1)");

            migrationBuilder.AlterColumn<byte>(
                name: "Physical",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "smallint",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(4,1)");

            migrationBuilder.AlterColumn<byte>(
                name: "Competitiveness",
                schema: "app",
                table: "TeamPlayerRatings",
                type: "smallint",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(4,1)");
        }
    }
}
