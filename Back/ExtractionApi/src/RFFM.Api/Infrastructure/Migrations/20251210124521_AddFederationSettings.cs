using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddFederationSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "FederationSettings",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    UserId = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: false),
                    CompetitionId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    CompetitionName = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    GroupId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    GroupName = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    TeamId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    TeamName = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    CreatedAt = table.Column<long>(type: "bigint", nullable: false),
                    IsPrimary = table.Column<bool>(type: "bit", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FederationSettings", x => x.Id);
                });

            migrationBuilder.UpdateData(
                schema: "app",
                table: "Memberships",
                keyColumn: "Id",
                keyValue: 1,
                column: "Name",
                value: "RoleDirective");

            migrationBuilder.UpdateData(
                schema: "app",
                table: "Memberships",
                keyColumn: "Id",
                keyValue: 2,
                column: "Name",
                value: "RoleCoach");

            migrationBuilder.UpdateData(
                schema: "app",
                table: "Memberships",
                keyColumn: "Id",
                keyValue: 3,
                column: "Name",
                value: "RoleClubMember");

            migrationBuilder.UpdateData(
                schema: "app",
                table: "Memberships",
                keyColumn: "Id",
                keyValue: 4,
                column: "Name",
                value: "RolePlayer");

            migrationBuilder.UpdateData(
                schema: "app",
                table: "Memberships",
                keyColumn: "Id",
                keyValue: 5,
                column: "Name",
                value: "RoleFamilyPlayer");

            migrationBuilder.UpdateData(
                schema: "app",
                table: "Memberships",
                keyColumn: "Id",
                keyValue: 6,
                column: "Name",
                value: "RoleFollower");

            migrationBuilder.UpdateData(
                schema: "app",
                table: "SportEventTypes",
                keyColumn: "Id",
                keyValue: 1,
                column: "Name",
                value: "Partido");

            migrationBuilder.UpdateData(
                schema: "app",
                table: "SportEventTypes",
                keyColumn: "Id",
                keyValue: 2,
                column: "Name",
                value: "Entrenamiento");

            migrationBuilder.UpdateData(
                schema: "app",
                table: "SportEventTypes",
                keyColumn: "Id",
                keyValue: 3,
                column: "Name",
                value: "Reunión");

            migrationBuilder.UpdateData(
                schema: "app",
                table: "SportEventTypes",
                keyColumn: "Id",
                keyValue: 4,
                column: "Name",
                value: "Amistoso");

            migrationBuilder.CreateIndex(
                name: "IX_FederationSettings_UserId",
                schema: "app",
                table: "FederationSettings",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_FederationSettings_UserId_IsPrimary",
                schema: "app",
                table: "FederationSettings",
                columns: new[] { "UserId", "IsPrimary" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FederationSettings",
                schema: "app");

            migrationBuilder.UpdateData(
                schema: "app",
                table: "Memberships",
                keyColumn: "Id",
                keyValue: 1,
                column: "Name",
                value: "Directive");

            migrationBuilder.UpdateData(
                schema: "app",
                table: "Memberships",
                keyColumn: "Id",
                keyValue: 2,
                column: "Name",
                value: "Coach");

            migrationBuilder.UpdateData(
                schema: "app",
                table: "Memberships",
                keyColumn: "Id",
                keyValue: 3,
                column: "Name",
                value: "Club member");

            migrationBuilder.UpdateData(
                schema: "app",
                table: "Memberships",
                keyColumn: "Id",
                keyValue: 4,
                column: "Name",
                value: "Player");

            migrationBuilder.UpdateData(
                schema: "app",
                table: "Memberships",
                keyColumn: "Id",
                keyValue: 5,
                column: "Name",
                value: "FamilyMembers player");

            migrationBuilder.UpdateData(
                schema: "app",
                table: "Memberships",
                keyColumn: "Id",
                keyValue: 6,
                column: "Name",
                value: "Follower");

            migrationBuilder.UpdateData(
                schema: "app",
                table: "SportEventTypes",
                keyColumn: "Id",
                keyValue: 1,
                column: "Name",
                value: "Match");

            migrationBuilder.UpdateData(
                schema: "app",
                table: "SportEventTypes",
                keyColumn: "Id",
                keyValue: 2,
                column: "Name",
                value: "Training");

            migrationBuilder.UpdateData(
                schema: "app",
                table: "SportEventTypes",
                keyColumn: "Id",
                keyValue: 3,
                column: "Name",
                value: "Meeting");

            migrationBuilder.UpdateData(
                schema: "app",
                table: "SportEventTypes",
                keyColumn: "Id",
                keyValue: 4,
                column: "Name",
                value: "FriendlyMatch");
        }
    }
}
