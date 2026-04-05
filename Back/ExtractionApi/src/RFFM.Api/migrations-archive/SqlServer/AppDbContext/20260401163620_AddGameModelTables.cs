using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace RFFM.Api.migrationsarchive.SqlServer.AppDbContext
{
    /// <inheritdoc />
    public partial class AddGameModelTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "GameModels",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    TeamId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Season = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GameModels", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "GameMoments",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Order = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GameMoments", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "GameZones",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Order = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GameZones", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "GameScenarios",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    GameModelId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    GameMomentId = table.Column<int>(type: "integer", nullable: false),
                    GameZoneId = table.Column<int>(type: "integer", nullable: false),
                    Order = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Context = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GameScenarios", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GameScenarios_GameModels_GameModelId",
                        column: x => x.GameModelId,
                        principalSchema: "app",
                        principalTable: "GameModels",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_GameScenarios_GameMoments_GameMomentId",
                        column: x => x.GameMomentId,
                        principalSchema: "app",
                        principalTable: "GameMoments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_GameScenarios_GameZones_GameZoneId",
                        column: x => x.GameZoneId,
                        principalSchema: "app",
                        principalTable: "GameZones",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ScenarioTacticalPrinciples",
                schema: "app",
                columns: table => new
                {
                    GameScenarioId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    TechnicalGoalId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScenarioTacticalPrinciples", x => new { x.GameScenarioId, x.TechnicalGoalId });
                    table.ForeignKey(
                        name: "FK_ScenarioTacticalPrinciples_GameScenarios_GameScenarioId",
                        column: x => x.GameScenarioId,
                        principalSchema: "app",
                        principalTable: "GameScenarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SubPrinciples",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    GameScenarioId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    Label = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Name = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Context = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SubPrinciples", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SubPrinciples_GameScenarios_GameScenarioId",
                        column: x => x.GameScenarioId,
                        principalSchema: "app",
                        principalTable: "GameScenarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SubPrincipleTacticalPrinciples",
                schema: "app",
                columns: table => new
                {
                    SubPrincipleId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    TechnicalGoalId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SubPrincipleTacticalPrinciples", x => new { x.SubPrincipleId, x.TechnicalGoalId });
                    table.ForeignKey(
                        name: "FK_SubPrincipleTacticalPrinciples_SubPrinciples_SubPrincipleId",
                        column: x => x.SubPrincipleId,
                        principalSchema: "app",
                        principalTable: "SubPrinciples",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SubSubPrinciples",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    SubPrincipleId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    Name = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Action = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SubSubPrinciples", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SubSubPrinciples_SubPrinciples_SubPrincipleId",
                        column: x => x.SubPrincipleId,
                        principalSchema: "app",
                        principalTable: "SubPrinciples",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EssentialSkills",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    SubSubPrincipleId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    Name = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EssentialSkills", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EssentialSkills_SubSubPrinciples_SubSubPrincipleId",
                        column: x => x.SubSubPrincipleId,
                        principalSchema: "app",
                        principalTable: "SubSubPrinciples",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                schema: "app",
                table: "GameMoments",
                columns: new[] { "Id", "IsActive", "Name", "Order" },
                values: new object[,]
                {
                    { 1, true, "Defensa Organizada", 1 },
                    { 2, true, "Ataque Organizado", 2 },
                    { 3, true, "Transición Defensa-Ataque", 3 },
                    { 4, true, "Transición Ataque-Defensa", 4 },
                    { 5, true, "Balón Parado", 5 }
                });

            migrationBuilder.InsertData(
                schema: "app",
                table: "GameZones",
                columns: new[] { "Id", "IsActive", "Name", "Order" },
                values: new object[,]
                {
                    { 1, true, "Zona de Iniciación", 1 },
                    { 2, true, "Zona de Creación en Campo Propio", 2 },
                    { 3, true, "Zona de Creación en Campo Rival", 3 },
                    { 4, true, "Zona de Finalización", 4 }
                });

            migrationBuilder.CreateIndex(
                name: "IX_EssentialSkills_SubSubPrincipleId",
                schema: "app",
                table: "EssentialSkills",
                column: "SubSubPrincipleId");

            migrationBuilder.CreateIndex(
                name: "IX_GameModels_TeamId_Season",
                schema: "app",
                table: "GameModels",
                columns: new[] { "TeamId", "Season" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_GameScenarios_GameModelId",
                schema: "app",
                table: "GameScenarios",
                column: "GameModelId");

            migrationBuilder.CreateIndex(
                name: "IX_GameScenarios_GameMomentId",
                schema: "app",
                table: "GameScenarios",
                column: "GameMomentId");

            migrationBuilder.CreateIndex(
                name: "IX_GameScenarios_GameZoneId",
                schema: "app",
                table: "GameScenarios",
                column: "GameZoneId");

            migrationBuilder.CreateIndex(
                name: "IX_SubPrinciples_GameScenarioId",
                schema: "app",
                table: "SubPrinciples",
                column: "GameScenarioId");

            migrationBuilder.CreateIndex(
                name: "IX_SubSubPrinciples_SubPrincipleId",
                schema: "app",
                table: "SubSubPrinciples",
                column: "SubPrincipleId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EssentialSkills",
                schema: "app");

            migrationBuilder.DropTable(
                name: "ScenarioTacticalPrinciples",
                schema: "app");

            migrationBuilder.DropTable(
                name: "SubPrincipleTacticalPrinciples",
                schema: "app");

            migrationBuilder.DropTable(
                name: "SubSubPrinciples",
                schema: "app");

            migrationBuilder.DropTable(
                name: "SubPrinciples",
                schema: "app");

            migrationBuilder.DropTable(
                name: "GameScenarios",
                schema: "app");

            migrationBuilder.DropTable(
                name: "GameModels",
                schema: "app");

            migrationBuilder.DropTable(
                name: "GameMoments",
                schema: "app");

            migrationBuilder.DropTable(
                name: "GameZones",
                schema: "app");
        }
    }
}
