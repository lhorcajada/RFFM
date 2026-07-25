using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddExerciseTypesManyToMany : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // ── Data migration (must run before the old TPH columns are dropped) ──────
            //
            // Under the old TPH model, "TouchesNumber"/"WildCards" were shared plain
            // columns written to only by TacticalTaskTraining rows, while
            // TechnicalTaskTraining rows wrote to separate
            // "TechnicalTaskTraining_TouchesNumber"/"TechnicalTaskTraining_WildCards"
            // columns (EF Core disambiguates same-named properties declared on sibling
            // TPH subclasses this way). Both sets of columns must be folded into the new
            // single merged "TouchesNumber"/"WildCards" columns before the
            // Technical-prefixed ones are dropped below, or existing Technical exercises
            // would silently lose their touches/wildcards data.
            migrationBuilder.Sql(@"
                UPDATE app.""TaskTrainingBases""
                SET ""TouchesNumber"" = COALESCE(""TechnicalTaskTraining_TouchesNumber"", ""TouchesNumber"", 0),
                    ""WildCards"" = COALESCE(""TechnicalTaskTraining_WildCards"", ""WildCards"", 0)
                WHERE ""Discriminator"" = 'Technical';
            ");

            // Fill any remaining NULLs (e.g. Physical/Tactical rows that never touched
            // these fields) so the columns can be safely altered to NOT NULL below.
            migrationBuilder.Sql(@"
                UPDATE app.""TaskTrainingBases""
                SET ""Series"" = COALESCE(""Series"", 0),
                    ""DurationSeries"" = COALESCE(""DurationSeries"", 0),
                    ""RestSeries"" = COALESCE(""RestSeries"", 0),
                    ""Time"" = COALESCE(""Time"", INTERVAL '0'),
                    ""TouchesNumber"" = COALESCE(""TouchesNumber"", 0),
                    ""WildCards"" = COALESCE(""WildCards"", 0);
            ");

            // Create the new catalog/join tables up front so the data migration below can
            // reference them.
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

            migrationBuilder.CreateIndex(
                name: "IX_ExerciseTypes_Name",
                schema: "app",
                table: "ExerciseTypes",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TaskTrainingTypes_ExerciseTypeId",
                schema: "app",
                table: "TaskTrainingTypes",
                column: "ExerciseTypeId");

            // Seed the 6 exercise types here too (in addition to ExerciseTypesSeeder,
            // which runs on every app startup but only against an *empty* table — this
            // migration needs the rows to exist immediately in order to backfill
            // TaskTrainingTypes for pre-existing exercises further down). Using
            // gen_random_uuid() (built into Postgres 13+, matches Testcontainers'
            // postgres:16 image and the project's minimum supported Postgres version) so
            // ids are in the same lowercase-with-dashes text format BaseEntity.Id uses
            // (Guid.NewGuid().ToString()).
            migrationBuilder.Sql(@"
                INSERT INTO app.""ExerciseTypes"" (""Id"", ""Name"") VALUES
                    (gen_random_uuid()::text, 'Physical'),
                    (gen_random_uuid()::text, 'Technical'),
                    (gen_random_uuid()::text, 'Tactical'),
                    (gen_random_uuid()::text, 'Game'),
                    (gen_random_uuid()::text, 'Cognitive'),
                    (gen_random_uuid()::text, 'Psychological')
                ON CONFLICT (""Name"") DO NOTHING;
            ");

            // Every pre-existing exercise (one row per Discriminator value) gets exactly
            // one row in the new join table, preserving its original single type.
            migrationBuilder.Sql(@"
                INSERT INTO app.""TaskTrainingTypes"" (""TaskTrainingBaseId"", ""ExerciseTypeId"")
                SELECT tb.""Id"", et.""Id""
                FROM app.""TaskTrainingBases"" tb
                JOIN app.""ExerciseTypes"" et ON et.""Name"" = tb.""Discriminator""
                WHERE tb.""Discriminator"" IN ('Physical', 'Technical', 'Tactical');
            ");

            // ── Schema cleanup — drop the TPH artifacts now that data is preserved ─────
            migrationBuilder.DropColumn(
                name: "Discriminator",
                schema: "app",
                table: "TaskTrainingBases");

            migrationBuilder.DropColumn(
                name: "TechnicalTaskTraining_TouchesNumber",
                schema: "app",
                table: "TaskTrainingBases");

            migrationBuilder.DropColumn(
                name: "TechnicalTaskTraining_WildCards",
                schema: "app",
                table: "TaskTrainingBases");

            migrationBuilder.AlterColumn<int>(
                name: "WildCards",
                schema: "app",
                table: "TaskTrainingBases",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "TouchesNumber",
                schema: "app",
                table: "TaskTrainingBases",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.AlterColumn<TimeSpan>(
                name: "Time",
                schema: "app",
                table: "TaskTrainingBases",
                type: "interval",
                nullable: false,
                defaultValue: new TimeSpan(0, 0, 0, 0, 0),
                oldClrType: typeof(TimeSpan),
                oldType: "interval",
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "Series",
                schema: "app",
                table: "TaskTrainingBases",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "RestSeries",
                schema: "app",
                table: "TaskTrainingBases",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "DurationSeries",
                schema: "app",
                table: "TaskTrainingBases",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Discriminator",
                schema: "app",
                table: "TaskTrainingBases",
                type: "character varying(13)",
                maxLength: 13,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "TechnicalTaskTraining_TouchesNumber",
                schema: "app",
                table: "TaskTrainingBases",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TechnicalTaskTraining_WildCards",
                schema: "app",
                table: "TaskTrainingBases",
                type: "integer",
                nullable: true);

            // Recreate the discriminator from TaskTrainingTypes. The old model only
            // supported a single type per exercise, so if a row somehow has more than one
            // type associated (only possible for exercises created/edited after this
            // change), the first one (arbitrary but deterministic order) is used and the
            // rest are lost — this is an inherent, documented limitation of downgrading
            // past a multi-type-capable schema.
            migrationBuilder.Sql(@"
                UPDATE app.""TaskTrainingBases"" tb
                SET ""Discriminator"" = COALESCE((
                    SELECT et.""Name""
                    FROM app.""TaskTrainingTypes"" ttt
                    JOIN app.""ExerciseTypes"" et ON et.""Id"" = ttt.""ExerciseTypeId""
                    WHERE ttt.""TaskTrainingBaseId"" = tb.""Id""
                      AND et.""Name"" IN ('Physical', 'Technical', 'Tactical')
                    ORDER BY et.""Name""
                    LIMIT 1
                ), 'Base');
            ");

            migrationBuilder.Sql(@"
                UPDATE app.""TaskTrainingBases""
                SET ""TechnicalTaskTraining_TouchesNumber"" = ""TouchesNumber"",
                    ""TechnicalTaskTraining_WildCards"" = ""WildCards""
                WHERE ""Discriminator"" = 'Technical';
            ");

            migrationBuilder.DropTable(
                name: "TaskTrainingTypes",
                schema: "app");

            migrationBuilder.DropTable(
                name: "ExerciseTypes",
                schema: "app");

            migrationBuilder.AlterColumn<int>(
                name: "WildCards",
                schema: "app",
                table: "TaskTrainingBases",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AlterColumn<int>(
                name: "TouchesNumber",
                schema: "app",
                table: "TaskTrainingBases",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AlterColumn<TimeSpan>(
                name: "Time",
                schema: "app",
                table: "TaskTrainingBases",
                type: "interval",
                nullable: true,
                oldClrType: typeof(TimeSpan),
                oldType: "interval");

            migrationBuilder.AlterColumn<int>(
                name: "Series",
                schema: "app",
                table: "TaskTrainingBases",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AlterColumn<int>(
                name: "RestSeries",
                schema: "app",
                table: "TaskTrainingBases",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AlterColumn<int>(
                name: "DurationSeries",
                schema: "app",
                table: "TaskTrainingBases",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");
        }
    }
}
