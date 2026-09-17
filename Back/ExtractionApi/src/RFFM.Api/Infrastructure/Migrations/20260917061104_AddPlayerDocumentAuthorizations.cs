using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPlayerDocumentAuthorizations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "DocumentTypes",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DocumentTypes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PlayerDocuments",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    TeamPlayerId = table.Column<string>(type: "text", nullable: false),
                    DocumentTypeId = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    FileName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    StorageUrl = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    ContentType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    UploadedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UploadedByUserId = table.Column<string>(type: "text", nullable: false),
                    UploadedOnBehalf = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    ReviewedByUserId = table.Column<string>(type: "text", nullable: true),
                    ReviewedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ReviewNote = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlayerDocuments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PlayerDocuments_DocumentTypes_DocumentTypeId",
                        column: x => x.DocumentTypeId,
                        principalSchema: "app",
                        principalTable: "DocumentTypes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PlayerDocuments_TeamPlayers_TeamPlayerId",
                        column: x => x.TeamPlayerId,
                        principalSchema: "app",
                        principalTable: "TeamPlayers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PlayerDocuments_DocumentTypeId",
                schema: "app",
                table: "PlayerDocuments",
                column: "DocumentTypeId");

            migrationBuilder.CreateIndex(
                name: "IX_PlayerDocuments_TeamPlayerId_DocumentTypeId",
                schema: "app",
                table: "PlayerDocuments",
                columns: new[] { "TeamPlayerId", "DocumentTypeId" },
                unique: true);

            migrationBuilder.Sql(@"
                INSERT INTO app.""DocumentTypes"" (""Id"", ""Name"", ""Description"", ""IsActive"") VALUES
                    ('11111111-1111-1111-1111-111111111111',
                     'Autorización para realizar físico fuera de las instalaciones',
                     'Autorización firmada por el jugador o su familia para entrenar/preparar físico fuera de las instalaciones del club.',
                     true)
                ON CONFLICT (""Id"") DO NOTHING;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"DELETE FROM app.""DocumentTypes"" WHERE ""Id"" = '11111111-1111-1111-1111-111111111111';");

            migrationBuilder.DropTable(
                name: "PlayerDocuments",
                schema: "app");

            migrationBuilder.DropTable(
                name: "DocumentTypes",
                schema: "app");
        }
    }
}
