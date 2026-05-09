using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTrainingExerciseLinks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_SessionTrainings_SportEvents_SportEventId",
                schema: "app",
                table: "SessionTrainings");

            migrationBuilder.DropForeignKey(
                name: "FK_TaskTrainings_TaskTrainingBases_Id",
                schema: "app",
                table: "TaskTrainings");

            migrationBuilder.AlterColumn<string>(
                name: "SessionTrainingId",
                schema: "app",
                table: "TaskTrainings",
                type: "character varying(36)",
                maxLength: 36,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AddColumn<string>(
                name: "TaskTrainingBaseId",
                schema: "app",
                table: "TaskTrainings",
                type: "character varying(36)",
                maxLength: 36,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ClubId",
                schema: "app",
                table: "TaskTrainingBases",
                type: "character varying(36)",
                maxLength: 36,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "SubSubPrincipleId",
                schema: "app",
                table: "TaskTrainingBases",
                type: "character varying(36)",
                maxLength: 36,
                nullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "SportEventId",
                schema: "app",
                table: "SessionTrainings",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.Sql(@"
                DO $$ BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_schema = 'app' AND table_name = 'EssentialSkills' AND column_name = 'MasteredAt'
                    ) THEN
                        ALTER TABLE app.""EssentialSkills"" ADD COLUMN ""MasteredAt"" timestamp with time zone;
                    END IF;
                END $$;
            ");

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
                name: "IX_TaskTrainings_TaskTrainingBaseId",
                schema: "app",
                table: "TaskTrainings",
                column: "TaskTrainingBaseId");

            migrationBuilder.CreateIndex(
                name: "IX_TaskTrainingBases_ClubId",
                schema: "app",
                table: "TaskTrainingBases",
                column: "ClubId");

            migrationBuilder.CreateIndex(
                name: "IX_TaskTrainingBases_SubSubPrincipleId",
                schema: "app",
                table: "TaskTrainingBases",
                column: "SubSubPrincipleId");

            migrationBuilder.CreateIndex(
                name: "IX_TaskTrainingSkills_EssentialSkillId",
                schema: "app",
                table: "TaskTrainingSkills",
                column: "EssentialSkillId");

            migrationBuilder.AddForeignKey(
                name: "FK_SessionTrainings_SportEvents_SportEventId",
                schema: "app",
                table: "SessionTrainings",
                column: "SportEventId",
                principalSchema: "app",
                principalTable: "SportEvents",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_TaskTrainingBases_Clubs_ClubId",
                schema: "app",
                table: "TaskTrainingBases",
                column: "ClubId",
                principalSchema: "app",
                principalTable: "Clubs",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_TaskTrainingBases_SubSubPrinciples_SubSubPrincipleId",
                schema: "app",
                table: "TaskTrainingBases",
                column: "SubSubPrincipleId",
                principalSchema: "app",
                principalTable: "SubSubPrinciples",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_TaskTrainings_TaskTrainingBases_TaskTrainingBaseId",
                schema: "app",
                table: "TaskTrainings",
                column: "TaskTrainingBaseId",
                principalSchema: "app",
                principalTable: "TaskTrainingBases",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_SessionTrainings_SportEvents_SportEventId",
                schema: "app",
                table: "SessionTrainings");

            migrationBuilder.DropForeignKey(
                name: "FK_TaskTrainingBases_Clubs_ClubId",
                schema: "app",
                table: "TaskTrainingBases");

            migrationBuilder.DropForeignKey(
                name: "FK_TaskTrainingBases_SubSubPrinciples_SubSubPrincipleId",
                schema: "app",
                table: "TaskTrainingBases");

            migrationBuilder.DropForeignKey(
                name: "FK_TaskTrainings_TaskTrainingBases_TaskTrainingBaseId",
                schema: "app",
                table: "TaskTrainings");

            migrationBuilder.DropTable(
                name: "TaskTrainingSkills",
                schema: "app");

            migrationBuilder.DropIndex(
                name: "IX_TaskTrainings_TaskTrainingBaseId",
                schema: "app",
                table: "TaskTrainings");

            migrationBuilder.DropIndex(
                name: "IX_TaskTrainingBases_ClubId",
                schema: "app",
                table: "TaskTrainingBases");

            migrationBuilder.DropIndex(
                name: "IX_TaskTrainingBases_SubSubPrincipleId",
                schema: "app",
                table: "TaskTrainingBases");

            migrationBuilder.DropColumn(
                name: "TaskTrainingBaseId",
                schema: "app",
                table: "TaskTrainings");

            migrationBuilder.DropColumn(
                name: "ClubId",
                schema: "app",
                table: "TaskTrainingBases");

            migrationBuilder.DropColumn(
                name: "SubSubPrincipleId",
                schema: "app",
                table: "TaskTrainingBases");

            migrationBuilder.Sql(@"ALTER TABLE app.""EssentialSkills"" DROP COLUMN IF EXISTS ""MasteredAt"";");

            migrationBuilder.AlterColumn<string>(
                name: "SessionTrainingId",
                schema: "app",
                table: "TaskTrainings",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(36)",
                oldMaxLength: 36);

            migrationBuilder.AlterColumn<string>(
                name: "SportEventId",
                schema: "app",
                table: "SessionTrainings",
                type: "text",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_SessionTrainings_SportEvents_SportEventId",
                schema: "app",
                table: "SessionTrainings",
                column: "SportEventId",
                principalSchema: "app",
                principalTable: "SportEvents",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_TaskTrainings_TaskTrainingBases_Id",
                schema: "app",
                table: "TaskTrainings",
                column: "Id",
                principalSchema: "app",
                principalTable: "TaskTrainingBases",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
