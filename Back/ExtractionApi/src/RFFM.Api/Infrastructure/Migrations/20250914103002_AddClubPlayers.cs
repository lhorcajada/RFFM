using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddClubPlayers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ClubId",
                schema: "app",
                table: "Players",
                type: "nvarchar(450)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_Players_Alias",
                schema: "app",
                table: "Players",
                column: "Alias",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Players_ClubId",
                schema: "app",
                table: "Players",
                column: "ClubId");

            migrationBuilder.CreateIndex(
                name: "IX_Players_Id",
                schema: "app",
                table: "Players",
                column: "Id",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Players_Clubs_ClubId",
                schema: "app",
                table: "Players",
                column: "ClubId",
                principalSchema: "app",
                principalTable: "Clubs",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Players_Clubs_ClubId",
                schema: "app",
                table: "Players");

            migrationBuilder.DropIndex(
                name: "IX_Players_Alias",
                schema: "app",
                table: "Players");

            migrationBuilder.DropIndex(
                name: "IX_Players_ClubId",
                schema: "app",
                table: "Players");

            migrationBuilder.DropIndex(
                name: "IX_Players_Id",
                schema: "app",
                table: "Players");

            migrationBuilder.DropColumn(
                name: "ClubId",
                schema: "app",
                table: "Players");
        }
    }
}
