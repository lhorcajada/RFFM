using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    /// <summary>
    /// Introduces the <c>GamePrinciple</c> level between <c>GameModel</c> and <c>GameScenario</c>:
    /// each pre-existing scenario is wrapped in a generated principle (same moment/zone, Title =
    /// the scenario's current name, empty Description) so no existing data is lost. Also removes
    /// the "Principios tácticos colectivos" scenario selector entirely — drops
    /// app."ScenarioTacticalPrinciples" and the underlying app."TacticalGoals" catalog table.
    /// </summary>
    public partial class RestructureGameModelPrinciples : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Create the new GamePrinciples table.
            migrationBuilder.CreateTable(
                name: "GamePrinciples",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    GameModelId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    GameMomentId = table.Column<int>(type: "integer", nullable: false),
                    GameZoneId = table.Column<int>(type: "integer", nullable: false),
                    Order = table.Column<int>(type: "integer", nullable: false),
                    Title = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false, defaultValue: "")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GamePrinciples", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GamePrinciples_GameModels_GameModelId",
                        column: x => x.GameModelId,
                        principalSchema: "app",
                        principalTable: "GameModels",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_GamePrinciples_GameMoments_GameMomentId",
                        column: x => x.GameMomentId,
                        principalSchema: "app",
                        principalTable: "GameMoments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_GamePrinciples_GameZones_GameZoneId",
                        column: x => x.GameZoneId,
                        principalSchema: "app",
                        principalTable: "GameZones",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_GamePrinciples_GameModelId",
                schema: "app",
                table: "GamePrinciples",
                column: "GameModelId");

            migrationBuilder.CreateIndex(
                name: "IX_GamePrinciples_GameMomentId",
                schema: "app",
                table: "GamePrinciples",
                column: "GameMomentId");

            migrationBuilder.CreateIndex(
                name: "IX_GamePrinciples_GameZoneId",
                schema: "app",
                table: "GamePrinciples",
                column: "GameZoneId");

            // 2. Add the new (nullable, for now) GamePrincipleId column on GameScenarios.
            migrationBuilder.AddColumn<string>(
                name: "GamePrincipleId",
                schema: "app",
                table: "GameScenarios",
                type: "character varying(36)",
                maxLength: 36,
                nullable: true);

            // 3. Data migration: one GamePrinciple per pre-existing GameScenario, in the same
            //    moment/zone, Title = the scenario's current name, empty Description. The scenario
            //    is reparented under the generated principle as its only scenario (order 1).
            migrationBuilder.Sql(@"
                INSERT INTO app.""GamePrinciples"" (""Id"", ""GameModelId"", ""GameMomentId"", ""GameZoneId"", ""Order"", ""Title"", ""Description"")
                SELECT gen_random_uuid()::text, s.""GameModelId"", s.""GameMomentId"", s.""GameZoneId"", s.""Order"", s.""Name"", ''
                FROM app.""GameScenarios"" s;
            ");

            migrationBuilder.Sql(@"
                UPDATE app.""GameScenarios"" s
                SET ""GamePrincipleId"" = gp.""Id""
                FROM app.""GamePrinciples"" gp
                WHERE gp.""GameModelId"" = s.""GameModelId""
                  AND gp.""GameMomentId"" = s.""GameMomentId""
                  AND gp.""GameZoneId"" = s.""GameZoneId""
                  AND gp.""Order"" = s.""Order"";
            ");

            migrationBuilder.Sql(@"UPDATE app.""GameScenarios"" SET ""Order"" = 1;");

            // 4. Every scenario now has a GamePrincipleId — make it required.
            migrationBuilder.AlterColumn<string>(
                name: "GamePrincipleId",
                schema: "app",
                table: "GameScenarios",
                type: "character varying(36)",
                maxLength: 36,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(36)",
                oldMaxLength: 36,
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_GameScenarios_GamePrincipleId",
                schema: "app",
                table: "GameScenarios",
                column: "GamePrincipleId");

            migrationBuilder.AddForeignKey(
                name: "FK_GameScenarios_GamePrinciples_GamePrincipleId",
                schema: "app",
                table: "GameScenarios",
                column: "GamePrincipleId",
                principalSchema: "app",
                principalTable: "GamePrinciples",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            // 5. Drop the old direct moment/zone/model columns from GameScenarios — a scenario is
            //    now located exclusively via its owning GamePrinciple.
            migrationBuilder.DropForeignKey(
                name: "FK_GameScenarios_GameModels_GameModelId",
                schema: "app",
                table: "GameScenarios");

            migrationBuilder.DropForeignKey(
                name: "FK_GameScenarios_GameMoments_GameMomentId",
                schema: "app",
                table: "GameScenarios");

            migrationBuilder.DropForeignKey(
                name: "FK_GameScenarios_GameZones_GameZoneId",
                schema: "app",
                table: "GameScenarios");

            migrationBuilder.DropIndex(
                name: "IX_GameScenarios_GameModelId",
                schema: "app",
                table: "GameScenarios");

            migrationBuilder.DropIndex(
                name: "IX_GameScenarios_GameMomentId",
                schema: "app",
                table: "GameScenarios");

            migrationBuilder.DropIndex(
                name: "IX_GameScenarios_GameZoneId",
                schema: "app",
                table: "GameScenarios");

            migrationBuilder.DropColumn(
                name: "GameModelId",
                schema: "app",
                table: "GameScenarios");

            migrationBuilder.DropColumn(
                name: "GameMomentId",
                schema: "app",
                table: "GameScenarios");

            migrationBuilder.DropColumn(
                name: "GameZoneId",
                schema: "app",
                table: "GameScenarios");

            // 6. Remove the "Principios tácticos colectivos" selector entirely.
            migrationBuilder.DropTable(
                name: "ScenarioTacticalPrinciples",
                schema: "app");

            migrationBuilder.DropTable(
                name: "TacticalGoals",
                schema: "app");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Recreate the tactical-principles tables (empty — associations are not restored, per
            // the removed-requirement migration note in specs/game-model/spec.md).
            migrationBuilder.CreateTable(
                name: "TacticalGoals",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TacticalGoals", x => x.Id);
                });

            migrationBuilder.InsertData(
                schema: "app",
                table: "TacticalGoals",
                columns: new[] { "Id", "Name" },
                values: new object[,]
                {
                    { 1, "Marcaje" },
                    { 2, "Repliegue" },
                    { 3, "Cobertura" },
                    { 4, "Permuta" },
                    { 5, "Vigilancia defensiva" },
                    { 6, "Temporizaciones" },
                    { 7, "Entrada" },
                    { 8, "Carga" },
                    { 9, "Anticipación" },
                    { 10, "Intercepción" },
                    { 11, "Pressing" },
                    { 12, "Pressing tras pérdida" },
                    { 13, "Desmarques" },
                    { 14, "Apoyos" },
                    { 15, "Ataque" },
                    { 16, "Contraataque" },
                    { 17, "Ritmo de juego" },
                    { 18, "Cambios de ritmo" },
                    { 19, "Conservación de balón" },
                    { 20, "Cambios de orientación" },
                    { 21, "Progresión" }
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
                    table.ForeignKey(
                        name: "FK_ScenarioTacticalPrinciples_TacticalGoals_TechnicalGoalId",
                        column: x => x.TechnicalGoalId,
                        principalSchema: "app",
                        principalTable: "TacticalGoals",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            // Re-add the old direct moment/zone/model columns to GameScenarios (nullable at first,
            // backfilled from the owning GamePrinciple, then made required).
            migrationBuilder.AddColumn<string>(
                name: "GameModelId",
                schema: "app",
                table: "GameScenarios",
                type: "character varying(36)",
                maxLength: 36,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "GameMomentId",
                schema: "app",
                table: "GameScenarios",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "GameZoneId",
                schema: "app",
                table: "GameScenarios",
                type: "integer",
                nullable: true);

            migrationBuilder.Sql(@"
                UPDATE app.""GameScenarios"" s
                SET ""GameModelId"" = gp.""GameModelId"",
                    ""GameMomentId"" = gp.""GameMomentId"",
                    ""GameZoneId"" = gp.""GameZoneId""
                FROM app.""GamePrinciples"" gp
                WHERE gp.""Id"" = s.""GamePrincipleId"";
            ");

            migrationBuilder.AlterColumn<string>(
                name: "GameModelId",
                schema: "app",
                table: "GameScenarios",
                type: "character varying(36)",
                maxLength: 36,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(36)",
                oldMaxLength: 36,
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "GameMomentId",
                schema: "app",
                table: "GameScenarios",
                type: "integer",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "GameZoneId",
                schema: "app",
                table: "GameScenarios",
                type: "integer",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.DropForeignKey(
                name: "FK_GameScenarios_GamePrinciples_GamePrincipleId",
                schema: "app",
                table: "GameScenarios");

            migrationBuilder.DropIndex(
                name: "IX_GameScenarios_GamePrincipleId",
                schema: "app",
                table: "GameScenarios");

            migrationBuilder.DropColumn(
                name: "GamePrincipleId",
                schema: "app",
                table: "GameScenarios");

            migrationBuilder.DropTable(
                name: "GamePrinciples",
                schema: "app");

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

            migrationBuilder.AddForeignKey(
                name: "FK_GameScenarios_GameModels_GameModelId",
                schema: "app",
                table: "GameScenarios",
                column: "GameModelId",
                principalSchema: "app",
                principalTable: "GameModels",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_GameScenarios_GameMoments_GameMomentId",
                schema: "app",
                table: "GameScenarios",
                column: "GameMomentId",
                principalSchema: "app",
                principalTable: "GameMoments",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_GameScenarios_GameZones_GameZoneId",
                schema: "app",
                table: "GameScenarios",
                column: "GameZoneId",
                principalSchema: "app",
                principalTable: "GameZones",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
