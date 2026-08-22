using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddMicrocicloSubprincipioObjetivo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
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

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "MicrocicloSubprincipiosObjetivo",
                schema: "app");
        }
    }
}
