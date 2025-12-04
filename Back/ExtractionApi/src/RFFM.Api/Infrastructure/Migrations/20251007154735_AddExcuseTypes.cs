using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddExcuseTypes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Convocations_ConvocationStatuses_ConvocationStatusId",
                schema: "app",
                table: "Convocations");

            migrationBuilder.DropColumn(
                name: "CreatedBy",
                schema: "app",
                table: "Convocations");

            migrationBuilder.AlterColumn<DateTime>(
                name: "EndTime",
                schema: "app",
                table: "SportEvents",
                type: "datetime2",
                nullable: true,
                oldClrType: typeof(DateTime),
                oldType: "datetime2");

            migrationBuilder.AlterColumn<string>(
                name: "UrlImage",
                schema: "app",
                table: "SessionTrainings",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(500)",
                oldMaxLength: 500);

            migrationBuilder.AlterColumn<string>(
                name: "Location",
                schema: "app",
                table: "SessionTrainings",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(500)",
                oldMaxLength: 500);

            migrationBuilder.AlterColumn<TimeSpan>(
                name: "EndTime",
                schema: "app",
                table: "SessionTrainings",
                type: "time",
                nullable: true,
                oldClrType: typeof(TimeSpan),
                oldType: "time");

            migrationBuilder.AlterColumn<int>(
                name: "ConvocationStatusId",
                schema: "app",
                table: "Convocations",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AddColumn<int>(
                name: "ExcuseTypeId",
                schema: "app",
                table: "Convocations",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ExcuseTypes",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExcuseTypes", x => x.Id);
                });

            migrationBuilder.InsertData(
                schema: "app",
                table: "ExcuseTypes",
                columns: new[] { "Id", "Name" },
                values: new object[,]
                {
                    { 1, "Injury" },
                    { 2, "Study" },
                    { 3, "Ill" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_Convocations_ExcuseTypeId",
                schema: "app",
                table: "Convocations",
                column: "ExcuseTypeId");

            migrationBuilder.AddForeignKey(
                name: "FK_Convocations_ConvocationStatuses_ConvocationStatusId",
                schema: "app",
                table: "Convocations",
                column: "ConvocationStatusId",
                principalSchema: "app",
                principalTable: "ConvocationStatuses",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Convocations_ExcuseTypes_ExcuseTypeId",
                schema: "app",
                table: "Convocations",
                column: "ExcuseTypeId",
                principalSchema: "app",
                principalTable: "ExcuseTypes",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Convocations_ConvocationStatuses_ConvocationStatusId",
                schema: "app",
                table: "Convocations");

            migrationBuilder.DropForeignKey(
                name: "FK_Convocations_ExcuseTypes_ExcuseTypeId",
                schema: "app",
                table: "Convocations");

            migrationBuilder.DropTable(
                name: "ExcuseTypes",
                schema: "app");

            migrationBuilder.DropIndex(
                name: "IX_Convocations_ExcuseTypeId",
                schema: "app",
                table: "Convocations");

            migrationBuilder.DropColumn(
                name: "ExcuseTypeId",
                schema: "app",
                table: "Convocations");

            migrationBuilder.AlterColumn<DateTime>(
                name: "EndTime",
                schema: "app",
                table: "SportEvents",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified),
                oldClrType: typeof(DateTime),
                oldType: "datetime2",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "UrlImage",
                schema: "app",
                table: "SessionTrainings",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "nvarchar(500)",
                oldMaxLength: 500,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "Location",
                schema: "app",
                table: "SessionTrainings",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "nvarchar(500)",
                oldMaxLength: 500,
                oldNullable: true);

            migrationBuilder.AlterColumn<TimeSpan>(
                name: "EndTime",
                schema: "app",
                table: "SessionTrainings",
                type: "time",
                nullable: false,
                defaultValue: new TimeSpan(0, 0, 0, 0, 0),
                oldClrType: typeof(TimeSpan),
                oldType: "time",
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "ConvocationStatusId",
                schema: "app",
                table: "Convocations",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CreatedBy",
                schema: "app",
                table: "Convocations",
                type: "nvarchar(256)",
                maxLength: 256,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddForeignKey(
                name: "FK_Convocations_ConvocationStatuses_ConvocationStatusId",
                schema: "app",
                table: "Convocations",
                column: "ConvocationStatusId",
                principalSchema: "app",
                principalTable: "ConvocationStatuses",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
