using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AllowMultipleQuinielaTicketsPerUser : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_QuinielaTickets_JornadaId_ApplicationUserId",
                schema: "app",
                table: "QuinielaTickets");

            migrationBuilder.AddColumn<int>(
                name: "Number",
                schema: "app",
                table: "QuinielaTickets",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.CreateIndex(
                name: "IX_QuinielaTickets_JornadaId_ApplicationUserId",
                schema: "app",
                table: "QuinielaTickets",
                columns: new[] { "JornadaId", "ApplicationUserId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_QuinielaTickets_JornadaId_ApplicationUserId",
                schema: "app",
                table: "QuinielaTickets");

            migrationBuilder.DropColumn(
                name: "Number",
                schema: "app",
                table: "QuinielaTickets");

            migrationBuilder.CreateIndex(
                name: "IX_QuinielaTickets_JornadaId_ApplicationUserId",
                schema: "app",
                table: "QuinielaTickets",
                columns: new[] { "JornadaId", "ApplicationUserId" },
                unique: true);
        }
    }
}
