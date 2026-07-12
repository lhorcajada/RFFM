using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    [DbContext(typeof(RFFM.Api.Infrastructure.Persistence.AppDbContext))]
    [Migration("20260712110341_RoleBasedRegistrationFlows")]
    public partial class RoleBasedRegistrationFlows : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ClubJoinRequests",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    ApplicationUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    ClubId = table.Column<string>(type: "text", nullable: false),
                    MembershipId = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    RequestedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    DecidedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    DecidedByUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClubJoinRequests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ClubJoinRequests_Clubs_ClubId",
                        column: x => x.ClubId,
                        principalSchema: "app",
                        principalTable: "Clubs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ClubJoinRequests_Memberships_MembershipId",
                        column: x => x.MembershipId,
                        principalSchema: "app",
                        principalTable: "Memberships",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ClubSeatCharges",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ClubId = table.Column<string>(type: "text", nullable: false),
                    ChargedUserId = table.Column<string>(type: "text", nullable: false),
                    PriceCents = table.Column<int>(type: "integer", nullable: false),
                    ChargedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClubSeatCharges", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ClubSeatCharges_Clubs_ClubId",
                        column: x => x.ClubId,
                        principalSchema: "app",
                        principalTable: "Clubs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.AddColumn<string>(
                name: "LinkedTeamPlayerId",
                schema: "app",
                table: "UserTeams",
                type: "text",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ClubJoinRequests_ClubId_Status",
                schema: "app",
                table: "ClubJoinRequests",
                columns: new[] { "ClubId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_ClubJoinRequests_ApplicationUserId",
                schema: "app",
                table: "ClubJoinRequests",
                column: "ApplicationUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ClubJoinRequests_MembershipId",
                schema: "app",
                table: "ClubJoinRequests",
                column: "MembershipId");

            migrationBuilder.CreateIndex(
                name: "IX_ClubSeatCharges_ChargedUserId",
                schema: "app",
                table: "ClubSeatCharges",
                column: "ChargedUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ClubSeatCharges_ClubId",
                schema: "app",
                table: "ClubSeatCharges",
                column: "ClubId");

            migrationBuilder.CreateIndex(
                name: "IX_UserTeams_LinkedTeamPlayerId",
                schema: "app",
                table: "UserTeams",
                column: "LinkedTeamPlayerId",
                unique: true,
                filter: "\"LinkedTeamPlayerId\" IS NOT NULL AND \"RoleId\" = 4");

            migrationBuilder.AddForeignKey(
                name: "FK_UserTeams_TeamPlayers_LinkedTeamPlayerId",
                schema: "app",
                table: "UserTeams",
                column: "LinkedTeamPlayerId",
                principalSchema: "app",
                principalTable: "TeamPlayers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_UserTeams_TeamPlayers_LinkedTeamPlayerId",
                schema: "app",
                table: "UserTeams");

            migrationBuilder.DropIndex(
                name: "IX_UserTeams_LinkedTeamPlayerId",
                schema: "app",
                table: "UserTeams");

            migrationBuilder.DropColumn(
                name: "LinkedTeamPlayerId",
                schema: "app",
                table: "UserTeams");

            migrationBuilder.DropTable(
                name: "ClubSeatCharges",
                schema: "app");

            migrationBuilder.DropTable(
                name: "ClubJoinRequests",
                schema: "app");
        }
    }
}
