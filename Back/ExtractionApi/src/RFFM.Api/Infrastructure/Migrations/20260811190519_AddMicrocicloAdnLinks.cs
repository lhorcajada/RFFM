using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddMicrocicloAdnLinks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "SesionAHabilidades",
                schema: "app",
                table: "Microciclos",
                type: "jsonb",
                nullable: false,
                defaultValueSql: "'[]'::jsonb");

            migrationBuilder.AddColumn<string>(
                name: "SesionBHabilidades",
                schema: "app",
                table: "Microciclos",
                type: "jsonb",
                nullable: false,
                defaultValueSql: "'[]'::jsonb");

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
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "MicrocicloSubprincipioLinks",
                schema: "app");

            migrationBuilder.DropTable(
                name: "MicrocicloSubSubPrincipioLinks",
                schema: "app");

            migrationBuilder.DropColumn(
                name: "SesionAHabilidades",
                schema: "app",
                table: "Microciclos");

            migrationBuilder.DropColumn(
                name: "SesionBHabilidades",
                schema: "app",
                table: "Microciclos");
        }
    }
}
