using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class SeasonPlanContentBoard_SessionTargetsAndNullableSchedule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "MicrocicloSubprincipiosObjetivo",
                schema: "app");

            migrationBuilder.AlterColumn<TimeSpan>(
                name: "StartTime",
                schema: "app",
                table: "SessionTrainings",
                type: "interval",
                nullable: true,
                oldClrType: typeof(TimeSpan),
                oldType: "interval");

            migrationBuilder.AlterColumn<DateTime>(
                name: "Date",
                schema: "app",
                table: "SessionTrainings",
                type: "timestamp with time zone",
                nullable: true,
                oldClrType: typeof(DateTime),
                oldType: "timestamp with time zone");

            migrationBuilder.CreateTable(
                name: "TrainingSessionSubSubPrincipios",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    TrainingSessionId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    SubSubPrincipioId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TrainingSessionSubSubPrincipios", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TrainingSessionSubSubPrincipios_SessionTrainings_TrainingSe~",
                        column: x => x.TrainingSessionId,
                        principalSchema: "app",
                        principalTable: "SessionTrainings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TrainingSessionSubSubPrincipios_SubSubPrincipios_SubSubPrin~",
                        column: x => x.SubSubPrincipioId,
                        principalSchema: "app",
                        principalTable: "SubSubPrincipios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TrainingSessionSubSubPrincipios_SubSubPrincipioId",
                schema: "app",
                table: "TrainingSessionSubSubPrincipios",
                column: "SubSubPrincipioId");

            migrationBuilder.CreateIndex(
                name: "IX_TrainingSessionSubSubPrincipios_TrainingSessionId",
                schema: "app",
                table: "TrainingSessionSubSubPrincipios",
                column: "TrainingSessionId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TrainingSessionSubSubPrincipios",
                schema: "app");

            migrationBuilder.AlterColumn<TimeSpan>(
                name: "StartTime",
                schema: "app",
                table: "SessionTrainings",
                type: "interval",
                nullable: false,
                defaultValue: new TimeSpan(0, 0, 0, 0, 0),
                oldClrType: typeof(TimeSpan),
                oldType: "interval",
                oldNullable: true);

            migrationBuilder.AlterColumn<DateTime>(
                name: "Date",
                schema: "app",
                table: "SessionTrainings",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified),
                oldClrType: typeof(DateTime),
                oldType: "timestamp with time zone",
                oldNullable: true);

            migrationBuilder.CreateTable(
                name: "MicrocicloSubprincipiosObjetivo",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    MicrocicloId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    SubprincipioId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MicrocicloSubprincipiosObjetivo", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MicrocicloSubprincipiosObjetivo_Microciclos_MicrocicloId",
                        column: x => x.MicrocicloId,
                        principalSchema: "app",
                        principalTable: "Microciclos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_MicrocicloSubprincipiosObjetivo_Subprincipios_SubprincipioId",
                        column: x => x.SubprincipioId,
                        principalSchema: "app",
                        principalTable: "Subprincipios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_MicrocicloSubprincipiosObjetivo_MicrocicloId",
                schema: "app",
                table: "MicrocicloSubprincipiosObjetivo",
                column: "MicrocicloId");

            migrationBuilder.CreateIndex(
                name: "IX_MicrocicloSubprincipiosObjetivo_SubprincipioId",
                schema: "app",
                table: "MicrocicloSubprincipiosObjetivo",
                column: "SubprincipioId");
        }
    }
}
