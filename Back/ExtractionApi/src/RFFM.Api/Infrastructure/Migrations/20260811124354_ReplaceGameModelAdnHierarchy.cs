using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <summary>
    /// DATA-DESTRUCTIVE BY DESIGN. Replaces the old `GameModel → GamePrinciple (per Momento×Zona)
    /// → GameScenario → SubPrinciple → SubSubPrinciple → EssentialSkill` hierarchy with the ADN
    /// hierarchy (`GameModel → GamePrinciple → Subprincipio → Zona (0..N) → SubSubPrincipio →
    /// Habilidad`, plus Nota/SetPieceRule/OpenIssue) per
    /// `docs/game-model/ADN-modelo-de-juego-especificacion-tecnica.md`. All existing
    /// GameScenario/SubPrinciple/SubSubPrinciple/EssentialSkill/TaskTrainingSkill rows are
    /// dropped — there is no data-preserving migration path (confirmed, disposable decision).
    /// `Down()` reverses the schema only; it does NOT restore the deleted data.
    /// </summary>
    public partial class ReplaceGameModelAdnHierarchy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // An earlier, abandoned design attempt (IdentityAxis/ZoneRule/Trigger/RuleException,
            // plus an old-shape OpenIssues/SetPieceRules) was applied to some databases via
            // migrations that were later removed from source control without ever being
            // committed. Those tables are always empty leftovers of that abandoned attempt, not
            // real data — drop them unconditionally so this migration is safe to run regardless
            // of whether that abandoned attempt was ever applied to a given database. OpenIssues
            // and SetPieceRules are dropped here because this migration recreates both, in a
            // different shape, further down.
            migrationBuilder.Sql(@"
                DROP TABLE IF EXISTS app.""IdentityAxes"";
                DROP TABLE IF EXISTS app.""RuleExceptions"";
                DROP TABLE IF EXISTS app.""Triggers"";
                DROP TABLE IF EXISTS app.""ZoneRules"";
                DROP TABLE IF EXISTS app.""OpenIssues"";
                DROP TABLE IF EXISTS app.""SetPieceRules"";");

            // GamePrinciples.GameZoneId / its FK+index may or may not exist depending on which
            // exact intermediate state a given database is in (some environments never had this
            // column fully materialized despite the migration history saying otherwise) — guard
            // these three drops so the migration is safe either way instead of assuming presence.
            migrationBuilder.Sql(@"
                DO $$ BEGIN
                    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_GamePrinciples_GameZones_GameZoneId') THEN
                        ALTER TABLE app.""GamePrinciples"" DROP CONSTRAINT ""FK_GamePrinciples_GameZones_GameZoneId"";
                    END IF;
                END $$;");

            migrationBuilder.DropForeignKey(
                name: "FK_SessionTrainings_SubPrinciples_SubPrincipleId",
                schema: "app",
                table: "SessionTrainings");

            migrationBuilder.DropForeignKey(
                name: "FK_TaskTrainingBases_GameScenarios_ScenarioId",
                schema: "app",
                table: "TaskTrainingBases");

            migrationBuilder.DropForeignKey(
                name: "FK_TaskTrainingBases_SubPrinciples_SubPrincipleId",
                schema: "app",
                table: "TaskTrainingBases");

            migrationBuilder.DropForeignKey(
                name: "FK_TaskTrainingBases_SubSubPrinciples_SubSubPrincipleId",
                schema: "app",
                table: "TaskTrainingBases");

            migrationBuilder.DropTable(
                name: "TaskTrainingSkills",
                schema: "app");

            migrationBuilder.DropTable(
                name: "EssentialSkills",
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

            migrationBuilder.DropIndex(
                name: "IX_TaskTrainingBases_ScenarioId",
                schema: "app",
                table: "TaskTrainingBases");

            migrationBuilder.DropIndex(
                name: "IX_TaskTrainingBases_SubPrincipleId",
                schema: "app",
                table: "TaskTrainingBases");

            migrationBuilder.DropIndex(
                name: "IX_TaskTrainingBases_SubSubPrincipleId",
                schema: "app",
                table: "TaskTrainingBases");

            migrationBuilder.DropIndex(
                name: "IX_SessionTrainings_SubPrincipleId",
                schema: "app",
                table: "SessionTrainings");

            migrationBuilder.DropIndex(
                name: "IX_GamePrinciples_GameModelId",
                schema: "app",
                table: "GamePrinciples");

            migrationBuilder.Sql(@"
                DROP INDEX IF EXISTS app.""IX_GamePrinciples_GameZoneId"";");

            migrationBuilder.DropColumn(
                name: "ScenarioId",
                schema: "app",
                table: "TaskTrainingBases");

            migrationBuilder.DropColumn(
                name: "SubPrincipleId",
                schema: "app",
                table: "TaskTrainingBases");

            migrationBuilder.DropColumn(
                name: "SubSubPrincipleId",
                schema: "app",
                table: "TaskTrainingBases");

            migrationBuilder.DropColumn(
                name: "SubPrincipleId",
                schema: "app",
                table: "SessionTrainings");

            migrationBuilder.DropColumn(
                name: "Description",
                schema: "app",
                table: "GamePrinciples");

            migrationBuilder.Sql(@"
                ALTER TABLE app.""GamePrinciples"" DROP COLUMN IF EXISTS ""GameZoneId"";");

            // Existing GamePrinciple rows predate the ADN hierarchy and have no meaningful `Key`
            // (it's about to become NOT NULL + unique per GameModel) — this data is confirmed
            // disposable per the change proposal; the real content is re-populated by the
            // markdown importer/seed after this migration runs.
            migrationBuilder.Sql(@"DELETE FROM app.""GamePrinciples"";");

            migrationBuilder.RenameColumn(
                name: "Title",
                schema: "app",
                table: "GamePrinciples",
                newName: "Titulo");

            migrationBuilder.RenameColumn(
                name: "Order",
                schema: "app",
                table: "GamePrinciples",
                newName: "Numero");

            migrationBuilder.AddColumn<string>(
                name: "Key",
                schema: "app",
                table: "GamePrinciples",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Texto",
                schema: "app",
                table: "GamePrinciples",
                type: "character varying(4000)",
                maxLength: 4000,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "Notas",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    GameModelId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    Tipo = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Texto = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    PrincipioId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: true),
                    SubprincipioId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: true),
                    ZonaId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: true),
                    SubSubPrincipioId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Notas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Notas_GameModels_GameModelId",
                        column: x => x.GameModelId,
                        principalSchema: "app",
                        principalTable: "GameModels",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "OpenIssues",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    GameModelId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    Topic = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Description = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OpenIssues", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OpenIssues_GameModels_GameModelId",
                        column: x => x.GameModelId,
                        principalSchema: "app",
                        principalTable: "GameModels",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SetPieceRules",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    GameModelId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    Subtype = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Texto = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SetPieceRules", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SetPieceRules_GameModels_GameModelId",
                        column: x => x.GameModelId,
                        principalSchema: "app",
                        principalTable: "GameModels",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Subprincipios",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    GamePrincipleId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    Key = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Numero = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Titulo = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Texto = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Subprincipios", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Subprincipios_GamePrinciples_GamePrincipleId",
                        column: x => x.GamePrincipleId,
                        principalSchema: "app",
                        principalTable: "GamePrinciples",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Zonas",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    SubprincipioId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    Key = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    ZoneKeysCsv = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Label = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    ZonaTexto = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Texto = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Zonas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Zonas_Subprincipios_SubprincipioId",
                        column: x => x.SubprincipioId,
                        principalSchema: "app",
                        principalTable: "Subprincipios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SubSubPrincipios",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    SubprincipioId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: true),
                    ZonaId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: true),
                    Key = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Numero = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Rol = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Texto = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SubSubPrincipios", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SubSubPrincipios_Subprincipios_SubprincipioId",
                        column: x => x.SubprincipioId,
                        principalSchema: "app",
                        principalTable: "Subprincipios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SubSubPrincipios_Zonas_ZonaId",
                        column: x => x.ZonaId,
                        principalSchema: "app",
                        principalTable: "Zonas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Habilidades",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    SubSubPrincipioId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    Nombre = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Descripcion = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    Entrenable = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    ReferenciaAKey = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Habilidades", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Habilidades_SubSubPrincipios_SubSubPrincipioId",
                        column: x => x.SubSubPrincipioId,
                        principalSchema: "app",
                        principalTable: "SubSubPrincipios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_GamePrinciples_GameModelId_Key",
                schema: "app",
                table: "GamePrinciples",
                columns: new[] { "GameModelId", "Key" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Habilidades_SubSubPrincipioId_Nombre",
                schema: "app",
                table: "Habilidades",
                columns: new[] { "SubSubPrincipioId", "Nombre" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Notas_GameModelId",
                schema: "app",
                table: "Notas",
                column: "GameModelId");

            migrationBuilder.CreateIndex(
                name: "IX_Notas_PrincipioId",
                schema: "app",
                table: "Notas",
                column: "PrincipioId");

            migrationBuilder.CreateIndex(
                name: "IX_Notas_SubprincipioId",
                schema: "app",
                table: "Notas",
                column: "SubprincipioId");

            migrationBuilder.CreateIndex(
                name: "IX_Notas_SubSubPrincipioId",
                schema: "app",
                table: "Notas",
                column: "SubSubPrincipioId");

            migrationBuilder.CreateIndex(
                name: "IX_Notas_ZonaId",
                schema: "app",
                table: "Notas",
                column: "ZonaId");

            migrationBuilder.CreateIndex(
                name: "IX_OpenIssues_GameModelId",
                schema: "app",
                table: "OpenIssues",
                column: "GameModelId");

            migrationBuilder.CreateIndex(
                name: "IX_SetPieceRules_GameModelId_Subtype",
                schema: "app",
                table: "SetPieceRules",
                columns: new[] { "GameModelId", "Subtype" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Subprincipios_GamePrincipleId_Key",
                schema: "app",
                table: "Subprincipios",
                columns: new[] { "GamePrincipleId", "Key" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SubSubPrincipios_SubprincipioId",
                schema: "app",
                table: "SubSubPrincipios",
                column: "SubprincipioId");

            migrationBuilder.CreateIndex(
                name: "IX_SubSubPrincipios_ZonaId",
                schema: "app",
                table: "SubSubPrincipios",
                column: "ZonaId");

            migrationBuilder.CreateIndex(
                name: "IX_Zonas_SubprincipioId_Key",
                schema: "app",
                table: "Zonas",
                columns: new[] { "SubprincipioId", "Key" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Habilidades",
                schema: "app");

            migrationBuilder.DropTable(
                name: "Notas",
                schema: "app");

            migrationBuilder.DropTable(
                name: "OpenIssues",
                schema: "app");

            migrationBuilder.DropTable(
                name: "SetPieceRules",
                schema: "app");

            migrationBuilder.DropTable(
                name: "SubSubPrincipios",
                schema: "app");

            migrationBuilder.DropTable(
                name: "Zonas",
                schema: "app");

            migrationBuilder.DropTable(
                name: "Subprincipios",
                schema: "app");

            migrationBuilder.DropIndex(
                name: "IX_GamePrinciples_GameModelId_Key",
                schema: "app",
                table: "GamePrinciples");

            migrationBuilder.DropColumn(
                name: "Key",
                schema: "app",
                table: "GamePrinciples");

            migrationBuilder.DropColumn(
                name: "Texto",
                schema: "app",
                table: "GamePrinciples");

            migrationBuilder.RenameColumn(
                name: "Titulo",
                schema: "app",
                table: "GamePrinciples",
                newName: "Title");

            migrationBuilder.RenameColumn(
                name: "Numero",
                schema: "app",
                table: "GamePrinciples",
                newName: "Order");

            migrationBuilder.AddColumn<string>(
                name: "ScenarioId",
                schema: "app",
                table: "TaskTrainingBases",
                type: "character varying(36)",
                maxLength: 36,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SubPrincipleId",
                schema: "app",
                table: "TaskTrainingBases",
                type: "character varying(36)",
                maxLength: 36,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SubSubPrincipleId",
                schema: "app",
                table: "TaskTrainingBases",
                type: "character varying(36)",
                maxLength: 36,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SubPrincipleId",
                schema: "app",
                table: "SessionTrainings",
                type: "character varying(36)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Description",
                schema: "app",
                table: "GamePrinciples",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "GameZoneId",
                schema: "app",
                table: "GamePrinciples",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "GameScenarios",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    GamePrincipleId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    Context = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    MediaType = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    MediaUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Name = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GameScenarios", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GameScenarios_GamePrinciples_GamePrincipleId",
                        column: x => x.GamePrincipleId,
                        principalSchema: "app",
                        principalTable: "GamePrinciples",
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
                    Context = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    Label = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Name = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Order = table.Column<int>(type: "integer", nullable: false, defaultValue: 0)
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
                name: "SubSubPrinciples",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    SubPrincipleId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    Action = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    Name = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Order = table.Column<int>(type: "integer", nullable: false, defaultValue: 0)
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
                    Description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    MasteredAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Name = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false)
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

            migrationBuilder.CreateTable(
                name: "TaskTrainingSkills",
                schema: "app",
                columns: table => new
                {
                    TaskTrainingBaseId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    EssentialSkillId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TaskTrainingSkills", x => new { x.TaskTrainingBaseId, x.EssentialSkillId });
                    table.ForeignKey(
                        name: "FK_TaskTrainingSkills_EssentialSkills_EssentialSkillId",
                        column: x => x.EssentialSkillId,
                        principalSchema: "app",
                        principalTable: "EssentialSkills",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TaskTrainingSkills_TaskTrainingBases_TaskTrainingBaseId",
                        column: x => x.TaskTrainingBaseId,
                        principalSchema: "app",
                        principalTable: "TaskTrainingBases",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TaskTrainingBases_ScenarioId",
                schema: "app",
                table: "TaskTrainingBases",
                column: "ScenarioId");

            migrationBuilder.CreateIndex(
                name: "IX_TaskTrainingBases_SubPrincipleId",
                schema: "app",
                table: "TaskTrainingBases",
                column: "SubPrincipleId");

            migrationBuilder.CreateIndex(
                name: "IX_TaskTrainingBases_SubSubPrincipleId",
                schema: "app",
                table: "TaskTrainingBases",
                column: "SubSubPrincipleId");

            migrationBuilder.CreateIndex(
                name: "IX_SessionTrainings_SubPrincipleId",
                schema: "app",
                table: "SessionTrainings",
                column: "SubPrincipleId");

            migrationBuilder.CreateIndex(
                name: "IX_GamePrinciples_GameModelId",
                schema: "app",
                table: "GamePrinciples",
                column: "GameModelId");

            migrationBuilder.CreateIndex(
                name: "IX_GamePrinciples_GameZoneId",
                schema: "app",
                table: "GamePrinciples",
                column: "GameZoneId");

            migrationBuilder.CreateIndex(
                name: "IX_EssentialSkills_SubSubPrincipleId",
                schema: "app",
                table: "EssentialSkills",
                column: "SubSubPrincipleId");

            migrationBuilder.CreateIndex(
                name: "IX_GameScenarios_GamePrincipleId",
                schema: "app",
                table: "GameScenarios",
                column: "GamePrincipleId");

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

            migrationBuilder.CreateIndex(
                name: "IX_TaskTrainingSkills_EssentialSkillId",
                schema: "app",
                table: "TaskTrainingSkills",
                column: "EssentialSkillId");

            migrationBuilder.AddForeignKey(
                name: "FK_GamePrinciples_GameZones_GameZoneId",
                schema: "app",
                table: "GamePrinciples",
                column: "GameZoneId",
                principalSchema: "app",
                principalTable: "GameZones",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_SessionTrainings_SubPrinciples_SubPrincipleId",
                schema: "app",
                table: "SessionTrainings",
                column: "SubPrincipleId",
                principalSchema: "app",
                principalTable: "SubPrinciples",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_TaskTrainingBases_GameScenarios_ScenarioId",
                schema: "app",
                table: "TaskTrainingBases",
                column: "ScenarioId",
                principalSchema: "app",
                principalTable: "GameScenarios",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_TaskTrainingBases_SubPrinciples_SubPrincipleId",
                schema: "app",
                table: "TaskTrainingBases",
                column: "SubPrincipleId",
                principalSchema: "app",
                principalTable: "SubPrinciples",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_TaskTrainingBases_SubSubPrinciples_SubSubPrincipleId",
                schema: "app",
                table: "TaskTrainingBases",
                column: "SubSubPrincipleId",
                principalSchema: "app",
                principalTable: "SubSubPrinciples",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }
    }
}
