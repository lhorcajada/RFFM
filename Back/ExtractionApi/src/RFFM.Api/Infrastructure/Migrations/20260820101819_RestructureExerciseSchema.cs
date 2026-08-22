using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RestructureExerciseSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Materials_TaskTrainingBases_TaskTrainingBaseId",
                schema: "app",
                table: "Materials");

            migrationBuilder.DropForeignKey(
                name: "FK_TaskTrainingBases_Microciclos_MicrocicloId",
                schema: "app",
                table: "TaskTrainingBases");

            migrationBuilder.DropTable(
                name: "ExerciseConditions",
                schema: "app");

            migrationBuilder.DropTable(
                name: "ExerciseModelLinks",
                schema: "app");

            migrationBuilder.DropTable(
                name: "MicrocicloSubprincipioLinks",
                schema: "app");

            migrationBuilder.DropTable(
                name: "MicrocicloSubSubPrincipioLinks",
                schema: "app");

            migrationBuilder.DropTable(
                name: "TaskTrainings",
                schema: "app");

            migrationBuilder.DropTable(
                name: "TaskTrainingTypes",
                schema: "app");

            migrationBuilder.DropTable(
                name: "ExerciseTypes",
                schema: "app");

            // session-exercise-plan-redesign (design.md §2, migration "RestructureExerciseSchema"):
            // development exercises are wiped, not migrated, per req #5 / specs/exercises.md.
            // Explicit delete (rather than relying on the column-rename heuristics EF scaffolded
            // below, which would otherwise silently reinterpret old Section/Habilidades/
            // Description values as the new Tipo/NivelesColumnas/Objetivo columns) — this is a
            // one-way data wipe, not reversible in Down().
            migrationBuilder.Sql("DELETE FROM \"app\".\"TaskTrainingBases\";");

            migrationBuilder.DropIndex(
                name: "IX_TaskTrainingBases_MicrocicloId",
                schema: "app",
                table: "TaskTrainingBases");

            migrationBuilder.DropIndex(
                name: "IX_Materials_TaskTrainingBaseId",
                schema: "app",
                table: "Materials");

            migrationBuilder.DropColumn(
                name: "DurationSeries",
                schema: "app",
                table: "TaskTrainingBases");

            migrationBuilder.DropColumn(
                name: "DurationTotal",
                schema: "app",
                table: "TaskTrainingBases");

            migrationBuilder.DropColumn(
                name: "FieldSpace",
                schema: "app",
                table: "TaskTrainingBases");

            migrationBuilder.DropColumn(
                name: "GoalPeekersNumber",
                schema: "app",
                table: "TaskTrainingBases");

            migrationBuilder.DropColumn(
                name: "Methodology",
                schema: "app",
                table: "TaskTrainingBases");

            migrationBuilder.DropColumn(
                name: "MicrocicloId",
                schema: "app",
                table: "TaskTrainingBases");

            migrationBuilder.DropColumn(
                name: "PlayersNumber",
                schema: "app",
                table: "TaskTrainingBases");

            migrationBuilder.DropColumn(
                name: "Points",
                schema: "app",
                table: "TaskTrainingBases");

            migrationBuilder.DropColumn(
                name: "RestSeries",
                schema: "app",
                table: "TaskTrainingBases");

            migrationBuilder.DropColumn(
                name: "Series",
                schema: "app",
                table: "TaskTrainingBases");

            migrationBuilder.DropColumn(
                name: "Time",
                schema: "app",
                table: "TaskTrainingBases");

            migrationBuilder.DropColumn(
                name: "TouchesNumber",
                schema: "app",
                table: "TaskTrainingBases");

            migrationBuilder.DropColumn(
                name: "WildCards",
                schema: "app",
                table: "TaskTrainingBases");

            migrationBuilder.DropColumn(
                name: "GameZoneIdSesionA",
                schema: "app",
                table: "Microciclos");

            migrationBuilder.DropColumn(
                name: "GameZoneIdSesionB",
                schema: "app",
                table: "Microciclos");

            migrationBuilder.DropColumn(
                name: "ObjetivoSesionA",
                schema: "app",
                table: "Microciclos");

            migrationBuilder.DropColumn(
                name: "ObjetivoSesionB",
                schema: "app",
                table: "Microciclos");

            migrationBuilder.DropColumn(
                name: "SesionAHabilidades",
                schema: "app",
                table: "Microciclos");

            migrationBuilder.DropColumn(
                name: "SesionBHabilidades",
                schema: "app",
                table: "Microciclos");

            migrationBuilder.DropColumn(
                name: "TaskTrainingBaseId",
                schema: "app",
                table: "Materials");

            migrationBuilder.RenameColumn(
                name: "Section",
                schema: "app",
                table: "TaskTrainingBases",
                newName: "Tipo");

            migrationBuilder.RenameColumn(
                name: "Habilidades",
                schema: "app",
                table: "TaskTrainingBases",
                newName: "NivelesColumnas");

            migrationBuilder.RenameColumn(
                name: "Description",
                schema: "app",
                table: "TaskTrainingBases",
                newName: "Objetivo");

            migrationBuilder.AddColumn<string>(
                name: "Descripcion",
                schema: "app",
                table: "TaskTrainingBases",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Dibujo",
                schema: "app",
                table: "TaskTrainingBases",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DurationMinutes",
                schema: "app",
                table: "TaskTrainingBases",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Logistica",
                schema: "app",
                table: "TaskTrainingBases",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Niveles",
                schema: "app",
                table: "TaskTrainingBases",
                type: "jsonb",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ObjetivoPorRol",
                schema: "app",
                table: "TaskTrainingBases",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Porteros",
                schema: "app",
                table: "TaskTrainingBases",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MapaCampoTexto",
                schema: "app",
                table: "SessionTrainings",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MicrocicloId",
                schema: "app",
                table: "SessionTrainings",
                type: "character varying(36)",
                maxLength: 36,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ObjetivoGeneral",
                schema: "app",
                table: "SessionTrainings",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ExerciseModelRelations",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    TaskTrainingBaseId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    SubprincipioId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    IsFoco = table.Column<bool>(type: "boolean", nullable: false),
                    HabilidadesImprescindibles = table.Column<string>(type: "jsonb", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExerciseModelRelations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ExerciseModelRelations_Subprincipios_SubprincipioId",
                        column: x => x.SubprincipioId,
                        principalSchema: "app",
                        principalTable: "Subprincipios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ExerciseModelRelations_TaskTrainingBases_TaskTrainingBaseId",
                        column: x => x.TaskTrainingBaseId,
                        principalSchema: "app",
                        principalTable: "TaskTrainingBases",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SessionBlocks",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    TrainingSessionId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    Order = table.Column<int>(type: "integer", nullable: false),
                    Nombre = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    ComoConectaConAnterior = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    RotacionEntreEjercicios = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SessionBlocks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SessionBlocks_SessionTrainings_TrainingSessionId",
                        column: x => x.TrainingSessionId,
                        principalSchema: "app",
                        principalTable: "SessionTrainings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ExerciseModelRelationItems",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    ExerciseModelRelationId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    SubSubPrincipioId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    IsFoco = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExerciseModelRelationItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ExerciseModelRelationItems_ExerciseModelRelations_ExerciseM~",
                        column: x => x.ExerciseModelRelationId,
                        principalSchema: "app",
                        principalTable: "ExerciseModelRelations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ExerciseModelRelationItems_SubSubPrincipios_SubSubPrincipio~",
                        column: x => x.SubSubPrincipioId,
                        principalSchema: "app",
                        principalTable: "SubSubPrincipios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SessionBlockExercises",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    SessionBlockId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    TaskTrainingBaseId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    Position = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SessionBlockExercises", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SessionBlockExercises_SessionBlocks_SessionBlockId",
                        column: x => x.SessionBlockId,
                        principalSchema: "app",
                        principalTable: "SessionBlocks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SessionBlockExercises_TaskTrainingBases_TaskTrainingBaseId",
                        column: x => x.TaskTrainingBaseId,
                        principalSchema: "app",
                        principalTable: "TaskTrainingBases",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SessionTrainings_MicrocicloId",
                schema: "app",
                table: "SessionTrainings",
                column: "MicrocicloId");

            migrationBuilder.CreateIndex(
                name: "IX_ExerciseModelRelationItems_ExerciseModelRelationId",
                schema: "app",
                table: "ExerciseModelRelationItems",
                column: "ExerciseModelRelationId");

            migrationBuilder.CreateIndex(
                name: "IX_ExerciseModelRelationItems_SubSubPrincipioId",
                schema: "app",
                table: "ExerciseModelRelationItems",
                column: "SubSubPrincipioId");

            migrationBuilder.CreateIndex(
                name: "IX_ExerciseModelRelations_SubprincipioId",
                schema: "app",
                table: "ExerciseModelRelations",
                column: "SubprincipioId");

            migrationBuilder.CreateIndex(
                name: "IX_ExerciseModelRelations_TaskTrainingBaseId",
                schema: "app",
                table: "ExerciseModelRelations",
                column: "TaskTrainingBaseId");

            migrationBuilder.CreateIndex(
                name: "IX_SessionBlockExercises_SessionBlockId",
                schema: "app",
                table: "SessionBlockExercises",
                column: "SessionBlockId");

            migrationBuilder.CreateIndex(
                name: "IX_SessionBlockExercises_TaskTrainingBaseId",
                schema: "app",
                table: "SessionBlockExercises",
                column: "TaskTrainingBaseId");

            migrationBuilder.CreateIndex(
                name: "IX_SessionBlocks_TrainingSessionId",
                schema: "app",
                table: "SessionBlocks",
                column: "TrainingSessionId");

            migrationBuilder.AddForeignKey(
                name: "FK_SessionTrainings_Microciclos_MicrocicloId",
                schema: "app",
                table: "SessionTrainings",
                column: "MicrocicloId",
                principalSchema: "app",
                principalTable: "Microciclos",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <summary>
        /// Reverses the schema only — the exercise rows deleted by <see cref="Up"/>'s explicit
        /// <c>DELETE FROM "TaskTrainingBases"</c> are not recoverable (see design.md §2, req #5).
        /// </summary>
        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_SessionTrainings_Microciclos_MicrocicloId",
                schema: "app",
                table: "SessionTrainings");

            migrationBuilder.DropTable(
                name: "ExerciseModelRelationItems",
                schema: "app");

            migrationBuilder.DropTable(
                name: "SessionBlockExercises",
                schema: "app");

            migrationBuilder.DropTable(
                name: "ExerciseModelRelations",
                schema: "app");

            migrationBuilder.DropTable(
                name: "SessionBlocks",
                schema: "app");

            migrationBuilder.DropIndex(
                name: "IX_SessionTrainings_MicrocicloId",
                schema: "app",
                table: "SessionTrainings");

            migrationBuilder.DropColumn(
                name: "Descripcion",
                schema: "app",
                table: "TaskTrainingBases");

            migrationBuilder.DropColumn(
                name: "Dibujo",
                schema: "app",
                table: "TaskTrainingBases");

            migrationBuilder.DropColumn(
                name: "DurationMinutes",
                schema: "app",
                table: "TaskTrainingBases");

            migrationBuilder.DropColumn(
                name: "Logistica",
                schema: "app",
                table: "TaskTrainingBases");

            migrationBuilder.DropColumn(
                name: "Niveles",
                schema: "app",
                table: "TaskTrainingBases");

            migrationBuilder.DropColumn(
                name: "ObjetivoPorRol",
                schema: "app",
                table: "TaskTrainingBases");

            migrationBuilder.DropColumn(
                name: "Porteros",
                schema: "app",
                table: "TaskTrainingBases");

            migrationBuilder.DropColumn(
                name: "MapaCampoTexto",
                schema: "app",
                table: "SessionTrainings");

            migrationBuilder.DropColumn(
                name: "MicrocicloId",
                schema: "app",
                table: "SessionTrainings");

            migrationBuilder.DropColumn(
                name: "ObjetivoGeneral",
                schema: "app",
                table: "SessionTrainings");

            migrationBuilder.RenameColumn(
                name: "Tipo",
                schema: "app",
                table: "TaskTrainingBases",
                newName: "Section");

            migrationBuilder.RenameColumn(
                name: "Objetivo",
                schema: "app",
                table: "TaskTrainingBases",
                newName: "Description");

            migrationBuilder.RenameColumn(
                name: "NivelesColumnas",
                schema: "app",
                table: "TaskTrainingBases",
                newName: "Habilidades");

            migrationBuilder.AddColumn<int>(
                name: "DurationSeries",
                schema: "app",
                table: "TaskTrainingBases",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "DurationTotal",
                schema: "app",
                table: "TaskTrainingBases",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "FieldSpace",
                schema: "app",
                table: "TaskTrainingBases",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "GoalPeekersNumber",
                schema: "app",
                table: "TaskTrainingBases",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "Methodology",
                schema: "app",
                table: "TaskTrainingBases",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "MicrocicloId",
                schema: "app",
                table: "TaskTrainingBases",
                type: "character varying(36)",
                maxLength: 36,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PlayersNumber",
                schema: "app",
                table: "TaskTrainingBases",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "Points",
                schema: "app",
                table: "TaskTrainingBases",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "RestSeries",
                schema: "app",
                table: "TaskTrainingBases",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "Series",
                schema: "app",
                table: "TaskTrainingBases",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<TimeSpan>(
                name: "Time",
                schema: "app",
                table: "TaskTrainingBases",
                type: "interval",
                nullable: false,
                defaultValue: new TimeSpan(0, 0, 0, 0, 0));

            migrationBuilder.AddColumn<int>(
                name: "TouchesNumber",
                schema: "app",
                table: "TaskTrainingBases",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "WildCards",
                schema: "app",
                table: "TaskTrainingBases",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "GameZoneIdSesionA",
                schema: "app",
                table: "Microciclos",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "GameZoneIdSesionB",
                schema: "app",
                table: "Microciclos",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "ObjetivoSesionA",
                schema: "app",
                table: "Microciclos",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ObjetivoSesionB",
                schema: "app",
                table: "Microciclos",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "SesionAHabilidades",
                schema: "app",
                table: "Microciclos",
                type: "jsonb",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "SesionBHabilidades",
                schema: "app",
                table: "Microciclos",
                type: "jsonb",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "TaskTrainingBaseId",
                schema: "app",
                table: "Materials",
                type: "text",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ExerciseConditions",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    TaskTrainingBaseId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    Order = table.Column<int>(type: "integer", nullable: false),
                    Text = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExerciseConditions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ExerciseConditions_TaskTrainingBases_TaskTrainingBaseId",
                        column: x => x.TaskTrainingBaseId,
                        principalSchema: "app",
                        principalTable: "TaskTrainingBases",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ExerciseModelLinks",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    IsFoco = table.Column<bool>(type: "boolean", nullable: false),
                    SubSubPrincipioId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: true),
                    SubprincipioId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: true),
                    TaskTrainingBaseId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExerciseModelLinks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ExerciseModelLinks_SubSubPrincipios_SubSubPrincipioId",
                        column: x => x.SubSubPrincipioId,
                        principalSchema: "app",
                        principalTable: "SubSubPrincipios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ExerciseModelLinks_Subprincipios_SubprincipioId",
                        column: x => x.SubprincipioId,
                        principalSchema: "app",
                        principalTable: "Subprincipios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ExerciseModelLinks_TaskTrainingBases_TaskTrainingBaseId",
                        column: x => x.TaskTrainingBaseId,
                        principalSchema: "app",
                        principalTable: "TaskTrainingBases",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ExerciseTypes",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    Name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExerciseTypes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "MicrocicloSubprincipioLinks",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    MicrocicloId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    Session = table.Column<string>(type: "character varying(1)", maxLength: 1, nullable: false),
                    SubprincipioId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MicrocicloSubprincipioLinks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MicrocicloSubprincipioLinks_Microciclos_MicrocicloId",
                        column: x => x.MicrocicloId,
                        principalSchema: "app",
                        principalTable: "Microciclos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_MicrocicloSubprincipioLinks_Subprincipios_SubprincipioId",
                        column: x => x.SubprincipioId,
                        principalSchema: "app",
                        principalTable: "Subprincipios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "MicrocicloSubSubPrincipioLinks",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    MicrocicloId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    Session = table.Column<string>(type: "character varying(1)", maxLength: 1, nullable: false),
                    SubSubPrincipioId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MicrocicloSubSubPrincipioLinks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MicrocicloSubSubPrincipioLinks_Microciclos_MicrocicloId",
                        column: x => x.MicrocicloId,
                        principalSchema: "app",
                        principalTable: "Microciclos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_MicrocicloSubSubPrincipioLinks_SubSubPrincipios_SubSubPrinc~",
                        column: x => x.SubSubPrincipioId,
                        principalSchema: "app",
                        principalTable: "SubSubPrincipios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TaskTrainings",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    SessionTrainingId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    TaskTrainingBaseId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    Order = table.Column<int>(type: "integer", nullable: false),
                    Section = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TaskTrainings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TaskTrainings_SessionTrainings_SessionTrainingId",
                        column: x => x.SessionTrainingId,
                        principalSchema: "app",
                        principalTable: "SessionTrainings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TaskTrainings_TaskTrainingBases_TaskTrainingBaseId",
                        column: x => x.TaskTrainingBaseId,
                        principalSchema: "app",
                        principalTable: "TaskTrainingBases",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "TaskTrainingTypes",
                schema: "app",
                columns: table => new
                {
                    TaskTrainingBaseId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    ExerciseTypeId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TaskTrainingTypes", x => new { x.TaskTrainingBaseId, x.ExerciseTypeId });
                    table.ForeignKey(
                        name: "FK_TaskTrainingTypes_ExerciseTypes_ExerciseTypeId",
                        column: x => x.ExerciseTypeId,
                        principalSchema: "app",
                        principalTable: "ExerciseTypes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TaskTrainingTypes_TaskTrainingBases_TaskTrainingBaseId",
                        column: x => x.TaskTrainingBaseId,
                        principalSchema: "app",
                        principalTable: "TaskTrainingBases",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.UpdateData(
                schema: "app",
                table: "Materials",
                keyColumn: "Id",
                keyValue: 1,
                column: "TaskTrainingBaseId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "app",
                table: "Materials",
                keyColumn: "Id",
                keyValue: 2,
                column: "TaskTrainingBaseId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "app",
                table: "Materials",
                keyColumn: "Id",
                keyValue: 3,
                column: "TaskTrainingBaseId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "app",
                table: "Materials",
                keyColumn: "Id",
                keyValue: 4,
                column: "TaskTrainingBaseId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "app",
                table: "Materials",
                keyColumn: "Id",
                keyValue: 5,
                column: "TaskTrainingBaseId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "app",
                table: "Materials",
                keyColumn: "Id",
                keyValue: 6,
                column: "TaskTrainingBaseId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "app",
                table: "Materials",
                keyColumn: "Id",
                keyValue: 7,
                column: "TaskTrainingBaseId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "app",
                table: "Materials",
                keyColumn: "Id",
                keyValue: 8,
                column: "TaskTrainingBaseId",
                value: null);

            migrationBuilder.CreateIndex(
                name: "IX_TaskTrainingBases_MicrocicloId",
                schema: "app",
                table: "TaskTrainingBases",
                column: "MicrocicloId");

            migrationBuilder.CreateIndex(
                name: "IX_Materials_TaskTrainingBaseId",
                schema: "app",
                table: "Materials",
                column: "TaskTrainingBaseId");

            migrationBuilder.CreateIndex(
                name: "IX_ExerciseConditions_TaskTrainingBaseId",
                schema: "app",
                table: "ExerciseConditions",
                column: "TaskTrainingBaseId");

            migrationBuilder.CreateIndex(
                name: "IX_ExerciseModelLinks_SubprincipioId",
                schema: "app",
                table: "ExerciseModelLinks",
                column: "SubprincipioId");

            migrationBuilder.CreateIndex(
                name: "IX_ExerciseModelLinks_SubSubPrincipioId",
                schema: "app",
                table: "ExerciseModelLinks",
                column: "SubSubPrincipioId");

            migrationBuilder.CreateIndex(
                name: "IX_ExerciseModelLinks_TaskTrainingBaseId",
                schema: "app",
                table: "ExerciseModelLinks",
                column: "TaskTrainingBaseId");

            migrationBuilder.CreateIndex(
                name: "IX_ExerciseTypes_Name",
                schema: "app",
                table: "ExerciseTypes",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MicrocicloSubprincipioLinks_MicrocicloId_Session_Subprincip~",
                schema: "app",
                table: "MicrocicloSubprincipioLinks",
                columns: new[] { "MicrocicloId", "Session", "SubprincipioId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MicrocicloSubprincipioLinks_SubprincipioId",
                schema: "app",
                table: "MicrocicloSubprincipioLinks",
                column: "SubprincipioId");

            migrationBuilder.CreateIndex(
                name: "IX_MicrocicloSubSubPrincipioLinks_MicrocicloId_Session_SubSubP~",
                schema: "app",
                table: "MicrocicloSubSubPrincipioLinks",
                columns: new[] { "MicrocicloId", "Session", "SubSubPrincipioId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MicrocicloSubSubPrincipioLinks_SubSubPrincipioId",
                schema: "app",
                table: "MicrocicloSubSubPrincipioLinks",
                column: "SubSubPrincipioId");

            migrationBuilder.CreateIndex(
                name: "IX_TaskTrainings_SessionTrainingId",
                schema: "app",
                table: "TaskTrainings",
                column: "SessionTrainingId");

            migrationBuilder.CreateIndex(
                name: "IX_TaskTrainings_TaskTrainingBaseId",
                schema: "app",
                table: "TaskTrainings",
                column: "TaskTrainingBaseId");

            migrationBuilder.CreateIndex(
                name: "IX_TaskTrainingTypes_ExerciseTypeId",
                schema: "app",
                table: "TaskTrainingTypes",
                column: "ExerciseTypeId");

            migrationBuilder.AddForeignKey(
                name: "FK_Materials_TaskTrainingBases_TaskTrainingBaseId",
                schema: "app",
                table: "Materials",
                column: "TaskTrainingBaseId",
                principalSchema: "app",
                principalTable: "TaskTrainingBases",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_TaskTrainingBases_Microciclos_MicrocicloId",
                schema: "app",
                table: "TaskTrainingBases",
                column: "MicrocicloId",
                principalSchema: "app",
                principalTable: "Microciclos",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }
    }
}
