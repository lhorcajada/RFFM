using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ChangeCategories : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Categories_CategoryGroups_CategoryGroupId",
                schema: "app",
                table: "Categories");

            migrationBuilder.DropTable(
                name: "CategoryGroups",
                schema: "app");

            migrationBuilder.DropIndex(
                name: "IX_Categories_CategoryGroupId",
                schema: "app",
                table: "Categories");

            migrationBuilder.DeleteData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 10);

            migrationBuilder.DeleteData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 11);

            migrationBuilder.DeleteData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 12);

            migrationBuilder.DeleteData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 13);

            migrationBuilder.DeleteData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 14);

            migrationBuilder.DeleteData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 15);

            migrationBuilder.DeleteData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 16);

            migrationBuilder.DeleteData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 17);

            migrationBuilder.DeleteData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 18);

            migrationBuilder.DeleteData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 19);

            migrationBuilder.DeleteData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 20);

            migrationBuilder.DeleteData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 21);

            migrationBuilder.DeleteData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 22);

            migrationBuilder.DeleteData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 23);

            migrationBuilder.DeleteData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 24);

            migrationBuilder.DeleteData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 25);

            migrationBuilder.DeleteData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 26);

            migrationBuilder.DeleteData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 27);

            migrationBuilder.DeleteData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 28);

            migrationBuilder.DeleteData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 29);

            migrationBuilder.DeleteData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 30);

            migrationBuilder.DeleteData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 31);

            migrationBuilder.DeleteData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 32);

            migrationBuilder.DeleteData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 33);

            migrationBuilder.DeleteData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 34);

            migrationBuilder.DeleteData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 35);

            migrationBuilder.DeleteData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 36);

            migrationBuilder.DeleteData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 37);

            migrationBuilder.DeleteData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 38);

            migrationBuilder.DeleteData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 39);

            migrationBuilder.DeleteData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 40);

            migrationBuilder.DeleteData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 41);

            migrationBuilder.DeleteData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 42);

            migrationBuilder.DeleteData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 43);

            migrationBuilder.DeleteData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 44);

            migrationBuilder.DeleteData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 45);

            migrationBuilder.DeleteData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 46);

            migrationBuilder.DeleteData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 47);

            migrationBuilder.DeleteData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 48);

            migrationBuilder.DeleteData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 49);

            migrationBuilder.DeleteData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 50);

            migrationBuilder.DropColumn(
                name: "CategoryGroupId",
                schema: "app",
                table: "Categories");


            migrationBuilder.AddColumn<int>(
                name: "LeagueId",
                schema: "app",
                table: "Teams",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Leagues",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    CategoryId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Leagues", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Leagues_Categories_CategoryId",
                        column: x => x.CategoryId,
                        principalSchema: "app",
                        principalTable: "Categories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.UpdateData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 1,
                column: "Name",
                value: "Categoría Nacional");

            migrationBuilder.UpdateData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 2,
                column: "Name",
                value: "Aficionados");

            migrationBuilder.UpdateData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 3,
                column: "Name",
                value: "Juveniles");

            migrationBuilder.UpdateData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 4,
                column: "Name",
                value: "Cadetes");

            migrationBuilder.UpdateData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 5,
                column: "Name",
                value: "Infantiles");

            migrationBuilder.UpdateData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 6,
                column: "Name",
                value: "Alevines");

            migrationBuilder.UpdateData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 7,
                column: "Name",
                value: "Benjamines");

            migrationBuilder.UpdateData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 8,
                column: "Name",
                value: "Prebenjamines");

            migrationBuilder.UpdateData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 9,
                column: "Name",
                value: "Debutantes");

            migrationBuilder.InsertData(
                schema: "app",
                table: "Leagues",
                columns: new[] { "Id", "CategoryId", "Name" },
                values: new object[,]
                {
                    { 1, 1, "COPA RFEF FASE AUTONÓMICA" },
                    { 2, 1, "FINAL COPA RFEF FASE AUTONÓMICA" },
                    { 3, 1, "PLAY OFF TERCERA FEDERACION" },
                    { 4, 1, "TERCERA FEDERACION RFEF" },
                    { 5, 2, "COPA RFFM PRIMERA DIVISION AUTONOMICA AFICIONADOS" },
                    { 6, 2, "FASE FINAL COPA DE AFICIONADOS RFFM TEMP 2024/25" },
                    { 7, 2, "FINAL COPA PRIMERA DIVISION AUTONOMICA AFICIONADO RFFM" },
                    { 8, 2, "PRIMERA DIVISION AUTONOMICA AFICIONADO" },
                    { 9, 2, "PREFERENTE AFICIONADO" },
                    { 10, 2, "PRIMERA AFICIONADO" },
                    { 11, 2, "COPA DE AFICIONADOS RFFM TEMP 24/25" },
                    { 12, 2, "SEGUNDA AFICIONADO" },
                    { 13, 3, "NACIONAL JUVENIL" },
                    { 14, 3, "FINAL CAMPEON PRIMERA DIVISION AUTONOMICA JUVENIL" },
                    { 15, 3, "PRIMERA DIVISION AUTONOMICA JUVENIL" },
                    { 16, 3, "PREFERENTE JUVENIL" },
                    { 17, 3, "PRIMERA JUVENIL" },
                    { 18, 3, "SEGUNDA JUVENIL" },
                    { 19, 4, "SUPERLIGA CADETE" },
                    { 20, 4, "DIVISION DE HONOR CADETE" },
                    { 21, 4, "PRIMERA DIVISION AUTONOMICA CADETE" },
                    { 22, 4, "PREFERENTE CADETE" },
                    { 23, 4, "PRIMERA CADETE" },
                    { 24, 4, "SEGUNDA CADETE" },
                    { 25, 5, "SUPERLIGA INFANTIL" },
                    { 26, 5, "DIVISION DE HONOR INFANTIL" },
                    { 27, 5, "PRIMERA DIVISION AUTONOMICA INFANTIL" },
                    { 28, 5, "PREFERENTE INFANTIL" },
                    { 29, 5, "PRIMERA INFANTIL" },
                    { 30, 5, "SEGUNDA INFANTIL" },
                    { 31, 6, "SUPERLIGA ALEVIN" },
                    { 32, 6, "DIVISION DE HONOR ALEVIN" },
                    { 33, 6, "PRIMERA DIVISION AUTONOMICA ALEVIN" },
                    { 34, 6, "PREFERENTE ALEVIN" },
                    { 35, 6, "PRIMERA ALEVIN" },
                    { 36, 7, "VETERANOS MASCULINO F11" },
                    { 37, 7, "PRIMERA DIVISION AUTONÓMICA FEMENINO" },
                    { 38, 7, "PREFERENTE FUTBOL FEMENINO" },
                    { 39, 7, "PRIMERA FUTBOL FEMENINO" },
                    { 40, 7, "PRIMERA DIVISION AUTONOMICA FEMENINO JUVENIL" },
                    { 41, 7, "PREFERENTE FEMENINO JUVENIL" },
                    { 42, 7, "PRIMERA FEMENINO JUVENIL" },
                    { 43, 7, "PRIMERA DIVISION AUTONOMICA FEMENINO CADETE" },
                    { 44, 7, "PREFERENTE FEMENINO CADETE" },
                    { 45, 7, "PRIMERA FEMENINO CADETE" },
                    { 46, 8, "CAMPEONATO NACIONAL DE SELECCIONES TERRITORIALES SUB-14" },
                    { 47, 8, "CAMPEONATO NACIONAL DE SELECCIONES TERRITORIALES SUB-16" },
                    { 48, 8, "CAMPEONATO UNIVERSITARIO FEMENINO" },
                    { 49, 8, "CAMPEONATO UNIVERSITARIO MASCULINO" },
                    { 50, 8, "CAMPEONATO UNIVERSITARIO MASCULINO 2ª FASE F11" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_Teams_LeagueId",
                schema: "app",
                table: "Teams",
                column: "LeagueId");

            migrationBuilder.CreateIndex(
                name: "IX_Leagues_CategoryId",
                schema: "app",
                table: "Leagues",
                column: "CategoryId");

            migrationBuilder.AddForeignKey(
                name: "FK_Teams_Leagues_LeagueId",
                schema: "app",
                table: "Teams",
                column: "LeagueId",
                principalSchema: "app",
                principalTable: "Leagues",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Teams_Leagues_LeagueId",
                schema: "app",
                table: "Teams");

            migrationBuilder.DropTable(
                name: "Leagues",
                schema: "app");

            migrationBuilder.DropIndex(
                name: "IX_Teams_LeagueId",
                schema: "app",
                table: "Teams");

            migrationBuilder.DropColumn(
                name: "LeagueId",
                schema: "app",
                table: "Teams");

            migrationBuilder.RenameColumn(
                name: "UrlPhoto",
                schema: "app",
                table: "Teams",
                newName: "PhotoFile");

            migrationBuilder.RenameColumn(
                name: "UrlPhoto",
                schema: "app",
                table: "Players",
                newName: "PhotoFile");

            migrationBuilder.AddColumn<int>(
                name: "CategoryGroupId",
                schema: "app",
                table: "Categories",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "CategoryGroups",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CategoryGroups", x => x.Id);
                });

            migrationBuilder.UpdateData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 1,
                columns: new[] { "CategoryGroupId", "Name" },
                values: new object[] { 1, "COPA RFEF FASE AUTONÓMICA" });

            migrationBuilder.UpdateData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 2,
                columns: new[] { "CategoryGroupId", "Name" },
                values: new object[] { 1, "FINAL COPA RFEF FASE AUTONÓMICA" });

            migrationBuilder.UpdateData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 3,
                columns: new[] { "CategoryGroupId", "Name" },
                values: new object[] { 1, "PLAY OFF TERCERA FEDERACION" });

            migrationBuilder.UpdateData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 4,
                columns: new[] { "CategoryGroupId", "Name" },
                values: new object[] { 1, "TERCERA FEDERACION RFEF" });

            migrationBuilder.UpdateData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 5,
                columns: new[] { "CategoryGroupId", "Name" },
                values: new object[] { 2, "COPA RFFM PRIMERA DIVISION AUTONOMICA AFICIONADOS" });

            migrationBuilder.UpdateData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 6,
                columns: new[] { "CategoryGroupId", "Name" },
                values: new object[] { 2, "FASE FINAL COPA DE AFICIONADOS RFFM TEMP 2024/25" });

            migrationBuilder.UpdateData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 7,
                columns: new[] { "CategoryGroupId", "Name" },
                values: new object[] { 2, "FINAL COPA PRIMERA DIVISION AUTONOMICA AFICIONADO RFFM" });

            migrationBuilder.UpdateData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 8,
                columns: new[] { "CategoryGroupId", "Name" },
                values: new object[] { 2, "PRIMERA DIVISION AUTONOMICA AFICIONADO" });

            migrationBuilder.UpdateData(
                schema: "app",
                table: "Categories",
                keyColumn: "Id",
                keyValue: 9,
                columns: new[] { "CategoryGroupId", "Name" },
                values: new object[] { 2, "PREFERENTE AFICIONADO" });

            migrationBuilder.InsertData(
                schema: "app",
                table: "CategoryGroups",
                columns: new[] { "Id", "Name" },
                values: new object[,]
                {
                    { 1, "Categoría Nacional" },
                    { 2, "Aficionados" },
                    { 3, "Juveniles" },
                    { 4, "Cadetes" },
                    { 5, "Infantiles" },
                    { 6, "Alevines" },
                    { 7, "Benjamines" },
                    { 8, "Prebenjamines" },
                    { 9, "Debutantes" }
                });

            migrationBuilder.InsertData(
                schema: "app",
                table: "Categories",
                columns: new[] { "Id", "CategoryGroupId", "Name" },
                values: new object[,]
                {
                    { 10, 2, "PRIMERA AFICIONADO" },
                    { 11, 2, "COPA DE AFICIONADOS RFFM TEMP 24/25" },
                    { 12, 2, "SEGUNDA AFICIONADO" },
                    { 13, 3, "NACIONAL JUVENIL" },
                    { 14, 3, "FINAL CAMPEON PRIMERA DIVISION AUTONOMICA JUVENIL" },
                    { 15, 3, "PRIMERA DIVISION AUTONOMICA JUVENIL" },
                    { 16, 3, "PREFERENTE JUVENIL" },
                    { 17, 3, "PRIMERA JUVENIL" },
                    { 18, 3, "SEGUNDA JUVENIL" },
                    { 19, 4, "SUPERLIGA CADETE" },
                    { 20, 4, "DIVISION DE HONOR CADETE" },
                    { 21, 4, "PRIMERA DIVISION AUTONOMICA CADETE" },
                    { 22, 4, "PREFERENTE CADETE" },
                    { 23, 4, "PRIMERA CADETE" },
                    { 24, 4, "SEGUNDA CADETE" },
                    { 25, 5, "SUPERLIGA INFANTIL" },
                    { 26, 5, "DIVISION DE HONOR INFANTIL" },
                    { 27, 5, "PRIMERA DIVISION AUTONOMICA INFANTIL" },
                    { 28, 5, "PREFERENTE INFANTIL" },
                    { 29, 5, "PRIMERA INFANTIL" },
                    { 30, 5, "SEGUNDA INFANTIL" },
                    { 31, 6, "SUPERLIGA ALEVIN" },
                    { 32, 6, "DIVISION DE HONOR ALEVIN" },
                    { 33, 6, "PRIMERA DIVISION AUTONOMICA ALEVIN" },
                    { 34, 6, "PREFERENTE ALEVIN" },
                    { 35, 6, "PRIMERA ALEVIN" },
                    { 36, 7, "VETERANOS MASCULINO F11" },
                    { 37, 7, "PRIMERA DIVISION AUTONÓMICA FEMENINO" },
                    { 38, 7, "PREFERENTE FUTBOL FEMENINO" },
                    { 39, 7, "PRIMERA FUTBOL FEMENINO" },
                    { 40, 7, "PRIMERA DIVISION AUTONOMICA FEMENINO JUVENIL" },
                    { 41, 7, "PREFERENTE FEMENINO JUVENIL" },
                    { 42, 7, "PRIMERA FEMENINO JUVENIL" },
                    { 43, 7, "PRIMERA DIVISION AUTONOMICA FEMENINO CADETE" },
                    { 44, 7, "PREFERENTE FEMENINO CADETE" },
                    { 45, 7, "PRIMERA FEMENINO CADETE" },
                    { 46, 8, "CAMPEONATO NACIONAL DE SELECCIONES TERRITORIALES SUB-14" },
                    { 47, 8, "CAMPEONATO NACIONAL DE SELECCIONES TERRITORIALES SUB-16" },
                    { 48, 8, "CAMPEONATO UNIVERSITARIO FEMENINO" },
                    { 49, 8, "CAMPEONATO UNIVERSITARIO MASCULINO" },
                    { 50, 8, "CAMPEONATO UNIVERSITARIO MASCULINO 2ª FASE F11" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_Categories_CategoryGroupId",
                schema: "app",
                table: "Categories",
                column: "CategoryGroupId");

            migrationBuilder.AddForeignKey(
                name: "FK_Categories_CategoryGroups_CategoryGroupId",
                schema: "app",
                table: "Categories",
                column: "CategoryGroupId",
                principalSchema: "app",
                principalTable: "CategoryGroups",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
