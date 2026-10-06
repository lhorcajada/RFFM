using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSubtipoToExercises : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Subtipo",
                schema: "app",
                table: "TaskTrainingBases",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            // Subtipo inferido a partir del título/objetivo/descripción de los ejercicios ya
            // existentes en la base de datos. En una BD sin esos ids no actualiza nada.
            foreach (var (subtipo, ids) in ExistingExerciseSubtipos)
            {
                var idList = string.Join(", ", ids.Select(id => $"'{id}'"));
                migrationBuilder.Sql(
                    $"UPDATE \"app\".\"TaskTrainingBases\" SET \"Subtipo\" = '{subtipo}' WHERE \"Id\" IN ({idList});");
            }
        }

        private static readonly (string Subtipo, string[] Ids)[] ExistingExerciseSubtipos =
        {
            ("RuedasDePase", new[]
            {
                "b5915738-e1a4-49c6-9301-9442e1213b44", // Rueda - Ataque por banda con lateral y desborde diagonal
                "8a14f41e-b376-4709-9316-2968cb0fb1a9", // Rueda de pases - Entrada de segunda línea
                "b440ddb1-0adb-4560-87e6-51a7d5293b62", // Percepción de superioridad simulada
            }),
            ("Rondos", new[]
            {
                "9e404d3a-3d0d-4238-b45a-2bc41322394a", // Calentamiento (robar antes de que saque el balón del cuadrado)
                "6f030746-e453-4a4b-ab98-3dbef82b23cf", // Rondo con porterías centrales
                "ee48f468-f8f7-4605-88c4-cc731272a396", // Rondo posicional - Vigilancia ofensiva
            }),
            ("AtaqueOrganizado", new[]
            {
                "4ee7c9e8-6808-4e38-a7db-bd78bc73a0c1", // Ataque organizado - Desordenar al rival
                "1d9f39ed-fa45-4e11-9dd4-1466dd8d4bb2", // Ataque organizado - gatillo de superioridad
                "fd199dcd-a2aa-488d-90a9-fec4b2cdf5aa", // Ataque por banda (Situacional)
                "e673a4cd-b784-4c8a-b88e-e9e3e6b0b23e", // Ataque por banda con lateral
                "44d2342d-a736-4bc6-b450-5bb2732c7287", // Ataque por banda con lateral y presing tras pérdida
                "f7a8d7f3-612f-4233-817b-9a85159efc1d", // Partido ataque organizado - Desordenar rival
                "391deb0d-193a-4b49-b3b0-387e168a7073", // Zona de creación - Ataque organizado - entrar por banda
                "0ffc9ea4-78cf-45b3-84fb-98e4a1aec84c", // Zona de finalización - Desorganizar al rival
            }),
            ("DefensaOrganizada", new[]
            {
                "d790241c-21b0-4a82-9de6-47a14f92c71a", // Defensa organizada, bloque medio
                "9626c443-384c-4b1d-8c79-77d8842a0f56", // Evitar que nos superen por carriles centrales
                "04e730eb-fc91-4c3b-9095-b8edf2d7c4dc", // Def. Organizada - Activación tras superar primera línea
                "b9f2273c-5460-4bef-a6bf-3064383408c1", // Zona Finalización - No permitir superar primera línea
            }),
            ("TransicionDefensaAtaque", new[]
            {
                "85f86bbb-38c6-4e1b-8b43-f12e79d333b8", // Transición defensa-ataque: balón atrás y presión/repliegue
                "e6eca490-9362-4e5f-9df9-ead33548b444", // Zona Finalización - Finalizar rápido tras robo
            }),
            ("TransicionAtaqueDefensa", new[]
            {
                "3d727f5f-39db-4c6a-8ae1-1758465b6d88", // Técnica para temporizar (temporizar y replegar)
                "5ab69ede-928a-4933-9f42-4db463c4e10f", // Vigilancia ofensiva de pivotes cuando se ataca
                "a79af8b0-a552-43c4-b783-c3b246250054", // Zona de finalización - Pressing tras pérdida
            }),
            ("Posesion", new[]
            {
                "5a813e33-ff9b-4fef-ac66-9e8de8619516", // Posesión buscando alejar el balón del peligro
            }),
            ("Mantenimiento", new[]
            {
                "eb2e98fa-8759-4983-afa8-e90e653fed49", // Calentamiento carrera continua, sprint y rotacionales
                "d0d30fd3-ee02-4cc5-acd1-c80ffc061ea7", // Carrera de resistencia intermitente
            }),
            ("JuegosLudicos", new[]
            {
                "bab34b0d-3319-470e-8646-b44a4c738281", // El balón no toca el suelo
                "4b541a52-cef3-4c9f-8360-8f66f2cb6040", // Policías y ladrones 11vs11
                "1341795b-1529-48f0-88e9-5824e1dc1b76", // Reto de toques y cierre
                "4eef1e5c-de5e-4cc9-a8ab-fc95715f7926", // Tres en raya con acordeón
            }),
            ("Circuito", new[]
            {
                "e230e33e-2c73-461d-be60-be8f8fcdb2fd", // Circuito físico preseason
            }),
            ("PartidoCondicionado", new[]
            {
                "3f3a11d7-eb6c-4ca5-a7fe-bdff77528ecc", // Ataque por banda (Global 11v11 con puntuación)
                "570460c5-1668-45cd-aa3b-8d7e4146f5a2", // Partido condicionado - Percibir superioridad en ataque
                "18c1a0ea-8ae4-4815-bfa2-c05f9355577d", // Partido condicionado a vigilancias ofensivas
                "61de8619-db11-4a47-814e-08b94ea65003", // Zona creación rival - Def. Organizada - Partido
            }),
        };

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Subtipo",
                schema: "app",
                table: "TaskTrainingBases");
        }
    }
}
