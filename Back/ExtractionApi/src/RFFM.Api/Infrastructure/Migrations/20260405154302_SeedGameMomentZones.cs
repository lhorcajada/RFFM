using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class SeedGameMomentZones : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                INSERT INTO app.""GameMoments"" (""Id"", ""Name"", ""Order"", ""IsActive"") VALUES
                    (1, 'Defensa Organizada',        1, true),
                    (2, 'Ataque Organizado',         2, true),
                    (3, 'Transición Defensa-Ataque', 3, true),
                    (4, 'Transición Ataque-Defensa', 4, true),
                    (5, 'Balón Parado',              5, true)
                ON CONFLICT (""Id"") DO NOTHING;
            ");

            migrationBuilder.Sql(@"
                INSERT INTO app.""GameZones"" (""Id"", ""Name"", ""Order"", ""IsActive"") VALUES
                    (1, 'Zona de Iniciación',             1, true),
                    (2, 'Zona de Creación Campo Propio',  2, true),
                    (3, 'Zona de Creación Campo Rival',   3, true),
                    (4, 'Zona de Finalización',           4, true)
                ON CONFLICT (""Id"") DO NOTHING;
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"DELETE FROM app.""GameMoments"" WHERE ""Id"" IN (1,2,3,4,5);");
            migrationBuilder.Sql(@"DELETE FROM app.""GameZones"" WHERE ""Id"" IN (1,2,3,4);");
        }
    }
}
