using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTeamInjuryProtocol : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TeamInjuryProtocols",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    TeamId = table.Column<string>(type: "text", nullable: false),
                    Content = table.Column<string>(type: "text", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedByUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TeamInjuryProtocols", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TeamInjuryProtocols_Teams_TeamId",
                        column: x => x.TeamId,
                        principalSchema: "app",
                        principalTable: "Teams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TeamInjuryProtocolAttachments",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    ProtocolId = table.Column<string>(type: "text", nullable: false),
                    FileName = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    StorageUrl = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    ContentType = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    UploadedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TeamInjuryProtocolAttachments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TeamInjuryProtocolAttachments_TeamInjuryProtocols_ProtocolId",
                        column: x => x.ProtocolId,
                        principalSchema: "app",
                        principalTable: "TeamInjuryProtocols",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TeamInjuryProtocolAttachments_ProtocolId",
                schema: "app",
                table: "TeamInjuryProtocolAttachments",
                column: "ProtocolId");

            migrationBuilder.CreateIndex(
                name: "IX_TeamInjuryProtocols_TeamId",
                schema: "app",
                table: "TeamInjuryProtocols",
                column: "TeamId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TeamInjuryProtocolAttachments",
                schema: "app");

            migrationBuilder.DropTable(
                name: "TeamInjuryProtocols",
                schema: "app");
        }
    }
}
