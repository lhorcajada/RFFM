using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddMicrocicloSessionZones : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "GameZoneIdSesionA",
                schema: "app",
                table: "Microciclos",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "GameZoneIdSesionB",
                schema: "app",
                table: "Microciclos",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "GameZoneIdSesionA",
                schema: "app",
                table: "Microciclos");

            migrationBuilder.DropColumn(
                name: "GameZoneIdSesionB",
                schema: "app",
                table: "Microciclos");
        }
    }
}
