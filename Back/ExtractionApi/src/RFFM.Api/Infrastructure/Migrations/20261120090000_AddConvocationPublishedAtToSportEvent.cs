using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddConvocationPublishedAtToSportEvent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ConvocationPublishedAt",
                schema: "app",
                table: "SportEvents",
                type: "timestamp with time zone",
                nullable: true);

            // Existing league matches (EventTypeId 1) keep their convocation visible to players and families.
            migrationBuilder.Sql(
                "UPDATE app.\"SportEvents\" SET \"ConvocationPublishedAt\" = now() WHERE \"EventTypeId\" = 1;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ConvocationPublishedAt",
                schema: "app",
                table: "SportEvents");
        }
    }
}
