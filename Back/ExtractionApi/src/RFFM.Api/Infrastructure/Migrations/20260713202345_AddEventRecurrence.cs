using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddEventRecurrence : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "EventRecurrences",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    FrequencyId = table.Column<int>(type: "integer", nullable: false),
                    EndDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    MasterEventId = table.Column<string>(type: "text", nullable: false),
                    InstanceCount = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EventRecurrences", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EventRecurrences_SportEvents_MasterEventId",
                        column: x => x.MasterEventId,
                        principalSchema: "app",
                        principalTable: "SportEvents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.AddColumn<string>(
                name: "RecurrenceId",
                schema: "app",
                table: "SportEvents",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsRecurrenceMaster",
                schema: "app",
                table: "SportEvents",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "IX_EventRecurrences_MasterEventId",
                schema: "app",
                table: "EventRecurrences",
                column: "MasterEventId");

            migrationBuilder.CreateIndex(
                name: "IX_SportEvents_RecurrenceId",
                schema: "app",
                table: "SportEvents",
                column: "RecurrenceId");

            migrationBuilder.AddForeignKey(
                name: "FK_SportEvents_EventRecurrences_RecurrenceId",
                schema: "app",
                table: "SportEvents",
                column: "RecurrenceId",
                principalSchema: "app",
                principalTable: "EventRecurrences",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_SportEvents_EventRecurrences_RecurrenceId",
                schema: "app",
                table: "SportEvents");

            migrationBuilder.DropTable(
                name: "EventRecurrences",
                schema: "app");

            migrationBuilder.DropIndex(
                name: "IX_SportEvents_RecurrenceId",
                schema: "app",
                table: "SportEvents");

            migrationBuilder.DropColumn(
                name: "RecurrenceId",
                schema: "app",
                table: "SportEvents");

            migrationBuilder.DropColumn(
                name: "IsRecurrenceMaster",
                schema: "app",
                table: "SportEvents");
        }
    }
}
