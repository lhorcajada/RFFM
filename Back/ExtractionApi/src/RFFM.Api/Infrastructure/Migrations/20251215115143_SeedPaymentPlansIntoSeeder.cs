using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class SeedPaymentPlansIntoSeeder : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PaymentPlans",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    PriceCents = table.Column<int>(type: "int", nullable: false),
                    BillingPeriod = table.Column<int>(type: "int", nullable: false),
                    AllowedClubs = table.Column<int>(type: "int", nullable: false),
                    AllowedTeams = table.Column<int>(type: "int", nullable: false),
                    AllowedUsers = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PaymentPlans", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Subscriptions",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: false),
                    PaymentPlanId = table.Column<int>(type: "int", nullable: false),
                    StartDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EndDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Subscriptions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Subscriptions_PaymentPlans_PaymentPlanId",
                        column: x => x.PaymentPlanId,
                        principalSchema: "app",
                        principalTable: "PaymentPlans",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

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

            migrationBuilder.CreateIndex(
                name: "IX_PaymentPlans_Name",
                schema: "app",
                table: "PaymentPlans",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_Subscriptions_PaymentPlanId",
                schema: "app",
                table: "Subscriptions",
                column: "PaymentPlanId");

            migrationBuilder.CreateIndex(
                name: "IX_Subscriptions_UserId",
                schema: "app",
                table: "Subscriptions",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Subscriptions",
                schema: "app");

            migrationBuilder.DropTable(
                name: "PaymentPlans",
                schema: "app");

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
        }
    }
}
