using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RemovePreferedTeamSeason : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Seasons_Clubs_ClubId",
                schema: "app",
                table: "Seasons");

            migrationBuilder.DropForeignKey(
                name: "FK_Seasons_Teams_PreferredTeamId",
                schema: "app",
                table: "Seasons");

            migrationBuilder.DropForeignKey(
                name: "FK_Seasons_Teams_PreferredTeamId1",
                schema: "app",
                table: "Seasons");

            migrationBuilder.DropIndex(
                name: "IX_Seasons_PreferredTeamId",
                schema: "app",
                table: "Seasons");

            migrationBuilder.DropIndex(
                name: "IX_Seasons_PreferredTeamId1",
                schema: "app",
                table: "Seasons");

            migrationBuilder.DropColumn(
                name: "PreferredTeamId",
                schema: "app",
                table: "Seasons");

            migrationBuilder.DropColumn(
                name: "PreferredTeamId1",
                schema: "app",
                table: "Seasons");

            migrationBuilder.AddColumn<int>(
                name: "Age",
                schema: "app",
                table: "TeamPlayers",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "BirthYear",
                schema: "app",
                table: "TeamPlayers",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SeasonId",
                schema: "app",
                table: "TeamPlayers",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "TeamCategory",
                schema: "app",
                table: "TeamPlayers",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TeamName",
                schema: "app",
                table: "TeamPlayers",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LastTeamCategory",
                schema: "app",
                table: "Players",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LastTeamName",
                schema: "app",
                table: "Players",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_TeamPlayers_SeasonId",
                schema: "app",
                table: "TeamPlayers",
                column: "SeasonId");

            migrationBuilder.AddForeignKey(
                name: "FK_Seasons_Clubs_ClubId",
                schema: "app",
                table: "Seasons",
                column: "ClubId",
                principalSchema: "app",
                principalTable: "Clubs",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_TeamPlayers_Seasons_SeasonId",
                schema: "app",
                table: "TeamPlayers",
                column: "SeasonId",
                principalSchema: "app",
                principalTable: "Seasons",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Seasons_Clubs_ClubId",
                schema: "app",
                table: "Seasons");

            migrationBuilder.DropForeignKey(
                name: "FK_TeamPlayers_Seasons_SeasonId",
                schema: "app",
                table: "TeamPlayers");

            migrationBuilder.DropIndex(
                name: "IX_TeamPlayers_SeasonId",
                schema: "app",
                table: "TeamPlayers");

            migrationBuilder.DropColumn(
                name: "Age",
                schema: "app",
                table: "TeamPlayers");

            migrationBuilder.DropColumn(
                name: "BirthYear",
                schema: "app",
                table: "TeamPlayers");

            migrationBuilder.DropColumn(
                name: "SeasonId",
                schema: "app",
                table: "TeamPlayers");

            migrationBuilder.DropColumn(
                name: "TeamCategory",
                schema: "app",
                table: "TeamPlayers");

            migrationBuilder.DropColumn(
                name: "TeamName",
                schema: "app",
                table: "TeamPlayers");

            migrationBuilder.DropColumn(
                name: "LastTeamCategory",
                schema: "app",
                table: "Players");

            migrationBuilder.DropColumn(
                name: "LastTeamName",
                schema: "app",
                table: "Players");

            migrationBuilder.AddColumn<string>(
                name: "PreferredTeamId",
                schema: "app",
                table: "Seasons",
                type: "character varying(450)",
                maxLength: 450,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PreferredTeamId1",
                schema: "app",
                table: "Seasons",
                type: "text",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Seasons_PreferredTeamId",
                schema: "app",
                table: "Seasons",
                column: "PreferredTeamId");

            migrationBuilder.CreateIndex(
                name: "IX_Seasons_PreferredTeamId1",
                schema: "app",
                table: "Seasons",
                column: "PreferredTeamId1");

            migrationBuilder.AddForeignKey(
                name: "FK_Seasons_Clubs_ClubId",
                schema: "app",
                table: "Seasons",
                column: "ClubId",
                principalSchema: "app",
                principalTable: "Clubs",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Seasons_Teams_PreferredTeamId",
                schema: "app",
                table: "Seasons",
                column: "PreferredTeamId",
                principalSchema: "app",
                principalTable: "Teams",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Seasons_Teams_PreferredTeamId1",
                schema: "app",
                table: "Seasons",
                column: "PreferredTeamId1",
                principalSchema: "app",
                principalTable: "Teams",
                principalColumn: "Id");
        }
    }
}
