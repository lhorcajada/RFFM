using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class UpdateSportEvent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "RivalId",
                schema: "app",
                table: "SportEvents",
                type: "nvarchar(450)",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Rivals",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    UrlPhoto = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Rivals", x => x.Id);
                });

            migrationBuilder.InsertData(
                schema: "app",
                table: "SportEventTypes",
                columns: new[] { "Id", "Name" },
                values: new object[] { 4, "FriendlyMatch" });

            migrationBuilder.CreateIndex(
                name: "IX_SportEvents_RivalId",
                schema: "app",
                table: "SportEvents",
                column: "RivalId");

            migrationBuilder.AddForeignKey(
                name: "FK_SportEvents_Rivals_RivalId",
                schema: "app",
                table: "SportEvents",
                column: "RivalId",
                principalSchema: "app",
                principalTable: "Rivals",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_SportEvents_Rivals_RivalId",
                schema: "app",
                table: "SportEvents");

            migrationBuilder.DropTable(
                name: "Rivals",
                schema: "app");

            migrationBuilder.DropIndex(
                name: "IX_SportEvents_RivalId",
                schema: "app",
                table: "SportEvents");

            migrationBuilder.DeleteData(
                schema: "app",
                table: "SportEventTypes",
                keyColumn: "Id",
                keyValue: 4);

            migrationBuilder.DropColumn(
                name: "RivalId",
                schema: "app",
                table: "SportEvents");
        }
    }
}
