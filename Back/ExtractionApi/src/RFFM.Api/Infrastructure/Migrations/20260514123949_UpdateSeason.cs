using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class UpdateSeason : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ClubId",
                schema: "app",
                table: "Seasons",
                type: "character varying(450)",
                maxLength: 450,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Seasons_ClubId",
                schema: "app",
                table: "Seasons",
                column: "ClubId");

            migrationBuilder.AddForeignKey(
                name: "FK_Seasons_Clubs_ClubId",
                schema: "app",
                table: "Seasons",
                column: "ClubId",
                principalSchema: "app",
                principalTable: "Clubs",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Seasons_Clubs_ClubId",
                schema: "app",
                table: "Seasons");

            migrationBuilder.DropIndex(
                name: "IX_Seasons_ClubId",
                schema: "app",
                table: "Seasons");

            migrationBuilder.DropColumn(
                name: "ClubId",
                schema: "app",
                table: "Seasons");
        }
    }
}
