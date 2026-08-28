using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTournamentSportEventType : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                schema: "app",
                table: "SportEventTypes",
                columns: new[] { "Id", "Name" },
                values: new object[] { 6, "Torneo" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                schema: "app",
                table: "SportEventTypes",
                keyColumn: "Id",
                keyValue: 6);
        }
    }
}
