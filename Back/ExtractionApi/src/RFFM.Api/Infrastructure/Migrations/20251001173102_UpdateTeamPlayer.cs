using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class UpdateTeamPlayer : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TeamPlayerContactInfos",
                schema: "app",
                columns: table => new
                {
                    TeamPlayerId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Address_Street = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Address_City = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Address_Province = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Address_PostalCode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    Address_Country = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Phone = table.Column<string>(type: "nvarchar(15)", maxLength: 15, nullable: true),
                    Email = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TeamPlayerContactInfos", x => x.TeamPlayerId);
                    table.ForeignKey(
                        name: "FK_TeamPlayerContactInfos_TeamPlayers_TeamPlayerId",
                        column: x => x.TeamPlayerId,
                        principalSchema: "app",
                        principalTable: "TeamPlayers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TeamPlayerDemarcations",
                schema: "app",
                columns: table => new
                {
                    TeamPlayerId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    PossibleDemarcationIds = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ActivePositionId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TeamPlayerDemarcations", x => x.TeamPlayerId);
                    table.ForeignKey(
                        name: "FK_TeamPlayerDemarcations_TeamPlayers_TeamPlayerId",
                        column: x => x.TeamPlayerId,
                        principalSchema: "app",
                        principalTable: "TeamPlayers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TeamPlayerDorsals",
                schema: "app",
                columns: table => new
                {
                    TeamPlayerId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Number = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TeamPlayerDorsals", x => x.TeamPlayerId);
                    table.ForeignKey(
                        name: "FK_TeamPlayerDorsals_TeamPlayers_TeamPlayerId",
                        column: x => x.TeamPlayerId,
                        principalSchema: "app",
                        principalTable: "TeamPlayers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TeamPlayerFamilies",
                schema: "app",
                columns: table => new
                {
                    TeamPlayerId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Address_Street = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Address_City = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Address_Province = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Address_PostalCode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    Address_Country = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Phone = table.Column<string>(type: "nvarchar(15)", maxLength: 15, nullable: true),
                    Email = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    FamilyMember = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TeamPlayerFamilies", x => x.TeamPlayerId);
                    table.ForeignKey(
                        name: "FK_TeamPlayerFamilies_TeamPlayers_TeamPlayerId",
                        column: x => x.TeamPlayerId,
                        principalSchema: "app",
                        principalTable: "TeamPlayers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TeamPlayerPhysicalAttributes",
                schema: "app",
                columns: table => new
                {
                    TeamPlayerId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Height = table.Column<decimal>(type: "decimal(5,2)", nullable: true),
                    Weight = table.Column<decimal>(type: "decimal(5,2)", nullable: true),
                    DominantFoot = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TeamPlayerPhysicalAttributes", x => x.TeamPlayerId);
                    table.ForeignKey(
                        name: "FK_TeamPlayerPhysicalAttributes_TeamPlayers_TeamPlayerId",
                        column: x => x.TeamPlayerId,
                        principalSchema: "app",
                        principalTable: "TeamPlayers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TeamPlayerContactInfos",
                schema: "app");

            migrationBuilder.DropTable(
                name: "TeamPlayerDemarcations",
                schema: "app");

            migrationBuilder.DropTable(
                name: "TeamPlayerDorsals",
                schema: "app");

            migrationBuilder.DropTable(
                name: "TeamPlayerFamilies",
                schema: "app");

            migrationBuilder.DropTable(
                name: "TeamPlayerPhysicalAttributes",
                schema: "app");
        }
    }
}
