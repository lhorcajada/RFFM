using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddMemberships : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                schema: "app",
                table: "Memberships",
                columns: new[] { "Id", "Key", "Name" },
                values: new object[,]
                {
                    { 1, "Directive", "Directive" },
                    { 2, "Coach", "Coach" },
                    { 3, "ClubMember", "Club member" },
                    { 4, "Player", "Player" },
                    { 5, "FamilyPlayer", "Family player" },
                    { 6, "Follower", "Follower" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                schema: "app",
                table: "Memberships",
                keyColumn: "Id",
                keyValue: 1);

            migrationBuilder.DeleteData(
                schema: "app",
                table: "Memberships",
                keyColumn: "Id",
                keyValue: 2);

            migrationBuilder.DeleteData(
                schema: "app",
                table: "Memberships",
                keyColumn: "Id",
                keyValue: 3);

            migrationBuilder.DeleteData(
                schema: "app",
                table: "Memberships",
                keyColumn: "Id",
                keyValue: 4);

            migrationBuilder.DeleteData(
                schema: "app",
                table: "Memberships",
                keyColumn: "Id",
                keyValue: 5);

            migrationBuilder.DeleteData(
                schema: "app",
                table: "Memberships",
                keyColumn: "Id",
                keyValue: 6);
        }
    }
}
