using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddQuinielaTeamPool : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "QuinielaJornadas",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    TeamId = table.Column<string>(type: "text", nullable: false),
                    RffmRoundId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    Price = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    PrizePercent = table.Column<decimal>(type: "numeric(5,2)", nullable: false),
                    CarryIn = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    SettledAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CarryOut = table.Column<decimal>(type: "numeric(10,2)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuinielaJornadas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_QuinielaJornadas_Teams_TeamId",
                        column: x => x.TeamId,
                        principalSchema: "app",
                        principalTable: "Teams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "QuinielaTickets",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    JornadaId = table.Column<string>(type: "text", nullable: false),
                    ApplicationUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    PlenoHome = table.Column<int>(type: "integer", nullable: false),
                    PlenoAway = table.Column<int>(type: "integer", nullable: false),
                    PaymentStatus = table.Column<int>(type: "integer", nullable: false),
                    PaidAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    PaymentMethod = table.Column<int>(type: "integer", nullable: true),
                    Hits = table.Column<int>(type: "integer", nullable: true),
                    Category = table.Column<int>(type: "integer", nullable: true),
                    Prize = table.Column<decimal>(type: "numeric(10,2)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuinielaTickets", x => x.Id);
                    table.ForeignKey(
                        name: "FK_QuinielaTickets_QuinielaJornadas_JornadaId",
                        column: x => x.JornadaId,
                        principalSchema: "app",
                        principalTable: "QuinielaJornadas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "QuinielaPicks",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    RecordCode = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Sign = table.Column<int>(type: "integer", nullable: false),
                    TicketId = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuinielaPicks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_QuinielaPicks_QuinielaTickets_TicketId",
                        column: x => x.TicketId,
                        principalSchema: "app",
                        principalTable: "QuinielaTickets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_QuinielaJornadas_TeamId_RffmRoundId",
                schema: "app",
                table: "QuinielaJornadas",
                columns: new[] { "TeamId", "RffmRoundId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_QuinielaPicks_TicketId",
                schema: "app",
                table: "QuinielaPicks",
                column: "TicketId");

            migrationBuilder.CreateIndex(
                name: "IX_QuinielaTickets_JornadaId_ApplicationUserId",
                schema: "app",
                table: "QuinielaTickets",
                columns: new[] { "JornadaId", "ApplicationUserId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "QuinielaPicks",
                schema: "app");

            migrationBuilder.DropTable(
                name: "QuinielaTickets",
                schema: "app");

            migrationBuilder.DropTable(
                name: "QuinielaJornadas",
                schema: "app");
        }
    }
}
