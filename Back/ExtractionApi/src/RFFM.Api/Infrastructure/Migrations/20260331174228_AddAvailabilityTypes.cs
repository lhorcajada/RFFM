using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAvailabilityTypes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                schema: "app",
                table: "AssistanceTypes",
                keyColumn: "Id",
                keyValue: 5);

            migrationBuilder.DeleteData(
                schema: "app",
                table: "AssistanceTypes",
                keyColumn: "Id",
                keyValue: 6);

            migrationBuilder.AddColumn<int>(
                name: "AvailabilityTypeId",
                schema: "app",
                table: "Convocations",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "AvailabilityTypes",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AvailabilityTypes", x => x.Id);
                });

            migrationBuilder.InsertData(
                schema: "app",
                table: "AvailabilityTypes",
                columns: new[] { "Id", "Name" },
                values: new object[,]
                {
                    { 1, "Disponible" },
                    { 2, "No disponible" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_Convocations_AvailabilityTypeId",
                schema: "app",
                table: "Convocations",
                column: "AvailabilityTypeId");

            migrationBuilder.AddForeignKey(
                name: "FK_Convocations_AvailabilityTypes_AvailabilityTypeId",
                schema: "app",
                table: "Convocations",
                column: "AvailabilityTypeId",
                principalSchema: "app",
                principalTable: "AvailabilityTypes",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Convocations_AvailabilityTypes_AvailabilityTypeId",
                schema: "app",
                table: "Convocations");

            migrationBuilder.DropTable(
                name: "AvailabilityTypes",
                schema: "app");

            migrationBuilder.DropIndex(
                name: "IX_Convocations_AvailabilityTypeId",
                schema: "app",
                table: "Convocations");

            migrationBuilder.DropColumn(
                name: "AvailabilityTypeId",
                schema: "app",
                table: "Convocations");

            migrationBuilder.InsertData(
                schema: "app",
                table: "AssistanceTypes",
                columns: new[] { "Id", "Name", "Points" },
                values: new object[,]
                {
                    { 5, "Disponible", 0 },
                    { 6, "No disponible", 0 }
                });
        }
    }
}
