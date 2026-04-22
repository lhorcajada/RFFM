using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTeamPlayerRatingDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TeamPlayerRatingDetails",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    RatingId = table.Column<string>(type: "text", nullable: false),
                    CharacteristicKey = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    CategoryKey = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Level = table.Column<int>(type: "integer", nullable: false),
                    Concept = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TeamPlayerRatingDetails", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TeamPlayerRatingDetails_TeamPlayerRatings_RatingId",
                        column: x => x.RatingId,
                        principalSchema: "app",
                        principalTable: "TeamPlayerRatings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TeamPlayerRatingDetails_RatingId",
                schema: "app",
                table: "TeamPlayerRatingDetails",
                column: "RatingId");

            migrationBuilder.CreateIndex(
                name: "IX_TeamPlayerRatingDetails_RatingId_CharacteristicKey",
                schema: "app",
                table: "TeamPlayerRatingDetails",
                columns: new[] { "RatingId", "CharacteristicKey" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TeamPlayerRatingDetails",
                schema: "app");
        }
    }
}
