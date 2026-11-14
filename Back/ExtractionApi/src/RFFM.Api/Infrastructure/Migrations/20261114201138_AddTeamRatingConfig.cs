using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTeamRatingConfig : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TeamCapacityDefinitions",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    TeamId = table.Column<string>(type: "text", nullable: false),
                    Key = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    IsCustom = table.Column<bool>(type: "boolean", nullable: false),
                    IsHidden = table.Column<bool>(type: "boolean", nullable: false),
                    Sheet = table.Column<string>(type: "character varying(15)", maxLength: 15, nullable: false),
                    CategoryKey = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Label = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    LevelTexts = table.Column<List<string>>(type: "text[]", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TeamCapacityDefinitions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TeamCapacityDefinitions_Teams_TeamId",
                        column: x => x.TeamId,
                        principalSchema: "app",
                        principalTable: "Teams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TeamTraitDefinitions",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    TeamId = table.Column<string>(type: "text", nullable: false),
                    Key = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    IsCustom = table.Column<bool>(type: "boolean", nullable: false),
                    IsHidden = table.Column<bool>(type: "boolean", nullable: false),
                    Label = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    Phase = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Anchor1 = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Anchor3 = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Anchor5 = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TeamTraitDefinitions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TeamTraitDefinitions_Teams_TeamId",
                        column: x => x.TeamId,
                        principalSchema: "app",
                        principalTable: "Teams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TeamCapacityDefinitions_TeamId_Key",
                schema: "app",
                table: "TeamCapacityDefinitions",
                columns: new[] { "TeamId", "Key" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TeamTraitDefinitions_TeamId_Key",
                schema: "app",
                table: "TeamTraitDefinitions",
                columns: new[] { "TeamId", "Key" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TeamCapacityDefinitions",
                schema: "app");

            migrationBuilder.DropTable(
                name: "TeamTraitDefinitions",
                schema: "app");
        }
    }
}
