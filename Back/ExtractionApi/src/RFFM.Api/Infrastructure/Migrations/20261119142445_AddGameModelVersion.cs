using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddGameModelVersion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "Version",
                schema: "app",
                table: "GameModels",
                type: "uuid",
                nullable: true);

            migrationBuilder.Sql(@"
                UPDATE app.""GameModels"" SET ""Version"" = gen_random_uuid() WHERE ""Version"" IS NULL;
            ");

            migrationBuilder.AlterColumn<Guid>(
                name: "Version",
                schema: "app",
                table: "GameModels",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Version",
                schema: "app",
                table: "GameModels");
        }
    }
}
