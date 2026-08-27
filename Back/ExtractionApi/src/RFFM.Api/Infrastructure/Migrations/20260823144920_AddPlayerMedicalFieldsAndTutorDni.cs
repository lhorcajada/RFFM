using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPlayerMedicalFieldsAndTutorDni : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Dni",
                schema: "app",
                table: "TeamPlayerFamilies",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Alergias",
                schema: "app",
                table: "Players",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Enfermedades",
                schema: "app",
                table: "Players",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Procedencia",
                schema: "app",
                table: "Players",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Dni",
                schema: "app",
                table: "TeamPlayerFamilies");

            migrationBuilder.DropColumn(
                name: "Alergias",
                schema: "app",
                table: "Players");

            migrationBuilder.DropColumn(
                name: "Enfermedades",
                schema: "app",
                table: "Players");

            migrationBuilder.DropColumn(
                name: "Procedencia",
                schema: "app",
                table: "Players");
        }
    }
}
