using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    /// <summary>
    /// Replaces the single opaque <c>Teams.RulesDocumentUrl</c> PDF column with structured
    /// <c>TeamRulesSets</c>/<c>TeamRules</c> tables. Seeds the one real team that currently holds
    /// the FEPE CADETE rules PDF (<c>Id = 'db380999-9dc8-47d9-8bc5-f90145543ca5'</c>, confirmed via
    /// a live query against the dev DB matching
    /// <c>RulesDocumentUrl = 'team-rules-documents/597fd359-01e1-4b29-b6e7-c56efd9fbd48.pdf'</c>)
    /// with its structured equivalent (see openspec change <c>structured-team-rules</c>,
    /// design.md Appendix A), then drops the old column. The data step is a no-op (not an error)
    /// if that team id doesn't exist in the target database (fresh/CI DBs).
    /// </summary>
    public partial class AddTeamRulesStructuredData : Migration
    {
        private const string SeedTeamId = "db380999-9dc8-47d9-8bc5-f90145543ca5";

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TeamRulesSets",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    TeamId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    Title = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Subtitle = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    IntroNote = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    ClosingNote = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    ApplicationNote = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TeamRulesSets", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TeamRulesSets_Teams_TeamId",
                        column: x => x.TeamId,
                        principalSchema: "app",
                        principalTable: "Teams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TeamRules",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    TeamRulesSetId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    Order = table.Column<int>(type: "integer", nullable: false),
                    ShortTitle = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Highlight = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    ViolationSummary = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    ConsequenceSummary = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    LongDescription = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    BulletPoints = table.Column<string>(type: "jsonb", nullable: true),
                    ConsequenceDetail = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TeamRules", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TeamRules_TeamRulesSets_TeamRulesSetId",
                        column: x => x.TeamRulesSetId,
                        principalSchema: "app",
                        principalTable: "TeamRulesSets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TeamRules_TeamRulesSetId_Order",
                schema: "app",
                table: "TeamRules",
                columns: new[] { "TeamRulesSetId", "Order" });

            migrationBuilder.CreateIndex(
                name: "IX_TeamRulesSets_TeamId",
                schema: "app",
                table: "TeamRulesSets",
                column: "TeamId",
                unique: true);

            // ── Data migration: seed the one real team's FEPE CADETE rules ────────────────
            // (openspec change structured-team-rules, design.md Appendix A). No-op if the team
            // doesn't exist in the target database.
            migrationBuilder.Sql($@"
                INSERT INTO app.""TeamRulesSets"" (""Id"", ""TeamId"", ""Title"", ""Subtitle"", ""IntroNote"", ""ClosingNote"", ""ApplicationNote"", ""UpdatedAt"")
                SELECT gen_random_uuid()::text, '{SeedTeamId}',
                    'NORMAS DE EQUIPO',
                    'Compromiso, respeto y equipo',
                    'Nota inicial: las consecuencias tendrán una finalidad educativa, se aplicarán con proporcionalidad y, cuando sea necesario, se comunicarán a las familias. Las aportaciones económicas serán simbólicas y destinadas al fondo del equipo.',
                    'Nota sobre aportaciones al fondo del equipo: si un jugador acumula 3€ pendientes y no los regulariza, no jugará el siguiente partido hasta resolver la situación. Esta medida se aplicará con comunicación previa a la familia y manteniendo siempre un criterio educativo y proporcional.',
                    'El incumplimiento de estas normas tendrá consecuencias educativas y/o deportivas, determinadas por el entrenador atendiendo a la gravedad, la reiteración, las circunstancias y la actitud del jugador. Las aportaciones económicas previstas expresamente serán de obligado cumplimiento. En los casos graves o reiterados se informará a las familias y, si procede, al club.',
                    now() at time zone 'utc'
                WHERE EXISTS (SELECT 1 FROM app.""Teams"" WHERE ""Id"" = '{SeedTeamId}')
                  AND NOT EXISTS (SELECT 1 FROM app.""TeamRulesSets"" WHERE ""TeamId"" = '{SeedTeamId}');
            ");

            migrationBuilder.Sql($@"
                INSERT INTO app.""TeamRules"" (""Id"", ""TeamRulesSetId"", ""Order"", ""ShortTitle"", ""Highlight"", ""ViolationSummary"", ""ConsequenceSummary"", ""LongDescription"", ""BulletPoints"", ""ConsequenceDetail"")
                SELECT gen_random_uuid()::text, trs.""Id"", 1,
                    'Asistencia y preparación',
                    'Entrenar suma preparación, compromiso y prioridad deportiva.',
                    'No entrenar, entrenar solo un día o faltar parte de la pretemporada.',
                    'Podrá afectar a la convocatoria, minutos o prioridad deportiva, según las circunstancias.',
                    'El equipo entrena dos días a la semana. Las faltas deben avisarse con antelación y justificarse. La asistencia regular ayuda a mejorar la preparación, el ritmo y el compromiso con el grupo.',
                    '[""Asistencia semanal: entrenar con regularidad podrá influir en la convocatoria, minutos o prioridad deportiva."",""Ausencias justificadas: no se considerarán falta de disciplina, pero podrán afectar a la preparación acumulada."",""Recuperación de prioridad: se valorará la asistencia posterior, la actitud y el compromiso mostrado en los entrenamientos.""]'::jsonb,
                    NULL
                FROM app.""TeamRulesSets"" trs WHERE trs.""TeamId"" = '{SeedTeamId}';

                INSERT INTO app.""TeamRules"" (""Id"", ""TeamRulesSetId"", ""Order"", ""ShortTitle"", ""Highlight"", ""ViolationSummary"", ""ConsequenceSummary"", ""LongDescription"", ""BulletPoints"", ""ConsequenceDetail"")
                SELECT gen_random_uuid()::text, trs.""Id"", 2,
                    'Compromiso con la convocatoria y el equipo',
                    'Ser convocado implica responsabilidad, asistencia y actitud de grupo.',
                    'No avisar, avisar tarde, plan familiar previsto o causa de fuerza mayor.',
                    'Podrá afectar a la siguiente convocatoria o participación, según las circunstancias.',
                    'El jugador convocado debe confirmar su disponibilidad cuando se le solicite, acudir con puntualidad y mantener una actitud positiva durante todo el partido, tanto si juega muchos minutos como si participa menos. Formar parte del equipo significa animar, respetar las decisiones del entrenador y estar preparado para ayudar cuando sea necesario.',
                    NULL,
                    'El incumplimiento podrá afectar a la siguiente convocatoria, titularidad o participación, siempre atendiendo a las circunstancias y a la comunicación realizada por la familia.'
                FROM app.""TeamRulesSets"" trs WHERE trs.""TeamId"" = '{SeedTeamId}';

                INSERT INTO app.""TeamRules"" (""Id"", ""TeamRulesSetId"", ""Order"", ""ShortTitle"", ""Highlight"", ""ViolationSummary"", ""ConsequenceSummary"", ""LongDescription"", ""BulletPoints"", ""ConsequenceDetail"")
                SELECT gen_random_uuid()::text, trs.""Id"", 3,
                    'Puntualidad',
                    'Llegar a tiempo es una muestra de respeto al equipo.',
                    'Llegar tarde sin justificación.',
                    'Aportar 1€ al fondo del equipo.',
                    'El jugador debe llegar a la hora indicada y preparado para empezar.',
                    NULL,
                    'Si llega tarde sin justificación, deberá aportar 1€ al fondo del equipo.'
                FROM app.""TeamRulesSets"" trs WHERE trs.""TeamId"" = '{SeedTeamId}';

                INSERT INTO app.""TeamRules"" (""Id"", ""TeamRulesSetId"", ""Order"", ""ShortTitle"", ""Highlight"", ""ViolationSummary"", ""ConsequenceSummary"", ""LongDescription"", ""BulletPoints"", ""ConsequenceDetail"")
                SELECT gen_random_uuid()::text, trs.""Id"", 4,
                    'Esfuerzo durante todo el entrenamiento',
                    'La actitud y la intensidad forman parte del compromiso.',
                    'Falta de atención, de intensidad o participación en una sesión.',
                    'Podrá aplicarse una medida deportiva o educativa según la actitud, gravedad o reiteración.',
                    'El jugador debe realizar los ejercicios con atención, intensidad y respeto al trabajo del grupo. Se valorará la actitud general, la participación y la respuesta a las indicaciones del entrenador.',
                    NULL,
                    'Cuando la falta de esfuerzo sea clara o reiterada, podrá aplicarse una medida deportiva o educativa según la actitud, la gravedad y la repetición de la conducta. Cuando proceda, también podrá implicar una aportación de 1€ al fondo del equipo.'
                FROM app.""TeamRulesSets"" trs WHERE trs.""TeamId"" = '{SeedTeamId}';

                INSERT INTO app.""TeamRules"" (""Id"", ""TeamRulesSetId"", ""Order"", ""ShortTitle"", ""Highlight"", ""ViolationSummary"", ""ConsequenceSummary"", ""LongDescription"", ""BulletPoints"", ""ConsequenceDetail"")
                SELECT gen_random_uuid()::text, trs.""Id"", 5,
                    'Respeto al entrenador, compañeros, rivales y árbitros',
                    'El respeto es obligatorio dentro y fuera del campo.',
                    'Faltar al respeto al entrenador, compañeros, rivales o árbitros.',
                    'Se aplicará la medida educativa o deportiva que corresponda según la gravedad y reiteración. Cuando proceda, aportación de 1€.',
                    'El jugador debe respetar al entrenador, compañeros, rivales y árbitros dentro y fuera del campo. No se permitirán insultos, burlas, protestas reiteradas, agresiones ni cualquier falta de respeto.',
                    NULL,
                    'Disculparse, apartarse de la actividad, banquillo, aportación de 1€ o desconvocatoria, según la gravedad o reincidencia.'
                FROM app.""TeamRulesSets"" trs WHERE trs.""TeamId"" = '{SeedTeamId}';

                INSERT INTO app.""TeamRules"" (""Id"", ""TeamRulesSetId"", ""Order"", ""ShortTitle"", ""Highlight"", ""ViolationSummary"", ""ConsequenceSummary"", ""LongDescription"", ""BulletPoints"", ""ConsequenceDetail"")
                SELECT gen_random_uuid()::text, trs.""Id"", 6,
                    'Imagen, higiene y hábitos del equipo',
                    'La imagen y la higiene también forman parte del respeto al grupo.',
                    'Material incorrecto, no ducharse o no acudir al partido con la indumentaria necesaria.',
                    'Podrá limitar la participación en entrenamiento o partido. Las aportaciones económicas se aplicarán cuando así se indique.',
                    'El jugador debe cuidar su imagen, su material personal y los hábitos de higiene del equipo.',
                    NULL,
                    NULL
                FROM app.""TeamRulesSets"" trs WHERE trs.""TeamId"" = '{SeedTeamId}';

                INSERT INTO app.""TeamRules"" (""Id"", ""TeamRulesSetId"", ""Order"", ""ShortTitle"", ""Highlight"", ""ViolationSummary"", ""ConsequenceSummary"", ""LongDescription"", ""BulletPoints"", ""ConsequenceDetail"")
                SELECT gen_random_uuid()::text, trs.""Id"", 7,
                    'Uso responsable del móvil',
                    'Durante la actividad, la atención debe estar en el equipo.',
                    'Usar el móvil sin permiso durante entrenamientos, charlas o partidos.',
                    'Aportar 1€ al fondo del equipo.',
                    'Durante entrenamientos, charlas y partidos, el móvil debe estar guardado salvo permiso del entrenador.',
                    NULL,
                    'Si un jugador usa el móvil sin permiso durante la actividad, deberá aportar 1€ al fondo del equipo.'
                FROM app.""TeamRulesSets"" trs WHERE trs.""TeamId"" = '{SeedTeamId}';

                INSERT INTO app.""TeamRules"" (""Id"", ""TeamRulesSetId"", ""Order"", ""ShortTitle"", ""Highlight"", ""ViolationSummary"", ""ConsequenceSummary"", ""LongDescription"", ""BulletPoints"", ""ConsequenceDetail"")
                SELECT gen_random_uuid()::text, trs.""Id"", 8,
                    'Cuidado del material y de las instalaciones',
                    'El material y los espacios son responsabilidad de todos.',
                    'Perder material, dejar el vestuario sucio o romper material de forma intencionada.',
                    'Reparar, limpiar y si procede, aportar 1€ al fondo del equipo.',
                    'Balones, petos, conos, porterías, banquillos y vestuarios son responsabilidad de todos.',
                    '[""Balón perdido sin responsable claro: si se pierde un balón durante el entrenamiento, todo el equipo dedicará 5 minutos al final de la sesión a buscarlo y recoger el material, y cada jugador deberá aportar 1€ al fondo del equipo si no se encuentra."",""Vestuario sucio o desordenado: si el vestuario queda sucio, desordenado o con basura al salir, todo el equipo lo dejará limpio y ordenado antes de marcharse, y cada jugador deberá aportar 1€ al fondo del equipo."",""Acción individual intencionada: si un jugador rompe material a propósito la consecuencia será individual: quedará fuera del siguiente ejercicio y partido de entrenamiento y deberá aportar 1€ al fondo del equipo. Si hay rotura o pérdida de material, la familia deberá hacerse cargo de la reposición o reparación cuando corresponda.""]'::jsonb,
                    NULL
                FROM app.""TeamRulesSets"" trs WHERE trs.""TeamId"" = '{SeedTeamId}';

                INSERT INTO app.""TeamRules"" (""Id"", ""TeamRulesSetId"", ""Order"", ""ShortTitle"", ""Highlight"", ""ViolationSummary"", ""ConsequenceSummary"", ""LongDescription"", ""BulletPoints"", ""ConsequenceDetail"")
                SELECT gen_random_uuid()::text, trs.""Id"", 9,
                    'Indumentaria completa en fotos del equipo',
                    'La imagen del equipo en redes debe cuidarse entre todos.',
                    'Aparecer en fotos del equipo sin la ropa completa del club.',
                    'La foto no podrá subirse a redes y el jugador deberá aportar 1€ al fondo del equipo.',
                    'En las fotos oficiales o de equipo, los jugadores deberán llevar la ropa completa del club para mantener una imagen uniforme y cuidada.',
                    NULL,
                    'Si un jugador aparece sin la ropa completa del club, la foto del equipo no podrá subirse a redes y deberá aportar 1€ al fondo del equipo.'
                FROM app.""TeamRulesSets"" trs WHERE trs.""TeamId"" = '{SeedTeamId}';

                INSERT INTO app.""TeamRules"" (""Id"", ""TeamRulesSetId"", ""Order"", ""ShortTitle"", ""Highlight"", ""ViolationSummary"", ""ConsequenceSummary"", ""LongDescription"", ""BulletPoints"", ""ConsequenceDetail"")
                SELECT gen_random_uuid()::text, trs.""Id"", 10,
                    'Comunicación y sinceridad con el entrenador',
                    'Avisar a tiempo ayuda a cuidar al jugador y al equipo.',
                    'No comunicar molestias, lesiones, disponibilidad o situaciones importantes para el equipo.',
                    'Podrá afectar a la participación, convocatoria o medida educativa según las circunstancias. Cuando proceda, aportación de 1€.',
                    'El jugador debe comunicar al entrenador cualquier molestia, lesión, problema de disponibilidad o situación importante que pueda afectar al entrenamiento, al partido o al equipo.',
                    NULL,
                    'No comunicarlo podrá afectar a la participación, convocatoria o medida educativa según las circunstancias. Cuando proceda, también podrá implicar una aportación de 1€ al fondo del equipo.'
                FROM app.""TeamRulesSets"" trs WHERE trs.""TeamId"" = '{SeedTeamId}';
            ");

            migrationBuilder.DropColumn(
                name: "RulesDocumentUrl",
                schema: "app",
                table: "Teams");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "RulesDocumentUrl",
                schema: "app",
                table: "Teams",
                type: "text",
                nullable: true);

            migrationBuilder.DropTable(
                name: "TeamRules",
                schema: "app");

            migrationBuilder.DropTable(
                name: "TeamRulesSets",
                schema: "app");
        }
    }
}
