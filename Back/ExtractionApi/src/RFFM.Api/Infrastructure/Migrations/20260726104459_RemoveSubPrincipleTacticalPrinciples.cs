using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RemoveSubPrincipleTacticalPrinciples : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SubPrincipleTacticalPrinciples",
                schema: "app");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SubPrincipleTacticalPrinciples",
                schema: "app",
                columns: table => new
                {
                    SubPrincipleId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    TechnicalGoalId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SubPrincipleTacticalPrinciples", x => new { x.SubPrincipleId, x.TechnicalGoalId });
                    table.ForeignKey(
                        name: "FK_SubPrincipleTacticalPrinciples_SubPrinciples_SubPrincipleId",
                        column: x => x.SubPrincipleId,
                        principalSchema: "app",
                        principalTable: "SubPrinciples",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });
        }
    }
}
