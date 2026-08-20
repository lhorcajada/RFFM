using RFFM.Api.Domain.Aggregates.GameModels;

namespace RFFM.Api.Domain.Aggregates.SeasonPlans
{
    /// <summary>
    /// One training week within a Mesociclo. With two weekly sessions, each Microciclo
    /// groups the four phases into two connected pairs: Defensa organizada + Transición
    /// defensa-ataque (ObjetivoSesionA) and Ataque organizado + Transición ataque-defensa
    /// (ObjetivoSesionB). Each session additionally carries optional links to concrete
    /// Subprincipio/SubSubPrincipio nodes from the team's current GameModel, plus a set of
    /// Habilidad names drawn from the closed 15-value vocabulary — see the "Amendment" section
    /// of the season-plan design doc.
    ///
    /// Each session also carries its own field zone (<see cref="GameZoneIdSesionA"/>/
    /// <see cref="GameZoneIdSesionB"/>). Unlike <see cref="Mesociclo.GameZoneId"/> (one zone for
    /// the whole Mesociclo), the real "Plan de Temporada" frequently trains Sesión A and Sesión B
    /// of the same week in different zones (e.g. Sesión A in Creación Propia, Sesión B in
    /// Creación Rival), so zone must be tracked per session at the Microciclo level.
    /// </summary>
    public class Microciclo : BaseEntity
    {
        /// <summary>Session identifier for Sesión A (Defensa organizada + Transición defensa-ataque).</summary>
        public const string SessionA = "A";
        /// <summary>Session identifier for Sesión B (Ataque organizado + Transición ataque-defensa).</summary>
        public const string SessionB = "B";

        public string MesocicloId { get; private set; } = null!;
        public int Order { get; private set; }
        public string WeekLabel { get; private set; } = null!;
        public DateOnly StartDate { get; private set; }
        public DateOnly EndDate { get; private set; }
        public string ObjetivoSesionA { get; private set; } = null!;
        public string ObjetivoSesionB { get; private set; } = null!;
        /// <summary>Field zone for Sesión A (Defensa organizada + Transición defensa-ataque).</summary>
        public int GameZoneIdSesionA { get; private set; }
        /// <summary>Field zone for Sesión B (Ataque organizado + Transición ataque-defensa).</summary>
        public int GameZoneIdSesionB { get; private set; }
        public List<string> SesionAHabilidades { get; private set; } = new();
        public List<string> SesionBHabilidades { get; private set; } = new();

        public List<MicrocicloSubprincipioLink> SubprincipioLinks { get; private set; } = new();
        public List<MicrocicloSubSubPrincipioLink> SubSubPrincipioLinks { get; private set; } = new();

        private Microciclo() { }

        public Microciclo(string mesocicloId, int order, string weekLabel, DateOnly startDate, DateOnly endDate,
            string objetivoSesionA, string objetivoSesionB)
        {
            if (string.IsNullOrWhiteSpace(mesocicloId))
                throw new ArgumentException("MesocicloId cannot be empty.", nameof(mesocicloId));
            MesocicloId = mesocicloId;
            UpdateOrder(order);
            UpdateWeekLabel(weekLabel);
            Reschedule(startDate, endDate);
            UpdateObjectives(objetivoSesionA, objetivoSesionB);
        }

        public void UpdateOrder(int order) => Order = order;

        public void UpdateWeekLabel(string weekLabel)
        {
            if (string.IsNullOrWhiteSpace(weekLabel))
                throw new ArgumentException("WeekLabel cannot be empty.", nameof(weekLabel));
            WeekLabel = weekLabel.Trim();
        }

        public void Reschedule(DateOnly startDate, DateOnly endDate)
        {
            if (endDate < startDate)
                throw new ArgumentException("EndDate cannot be before StartDate.", nameof(endDate));
            StartDate = startDate;
            EndDate = endDate;
        }

        public void UpdateObjectives(string objetivoSesionA, string objetivoSesionB)
        {
            if (string.IsNullOrWhiteSpace(objetivoSesionA))
                throw new ArgumentException("ObjetivoSesionA cannot be empty.", nameof(objetivoSesionA));
            if (string.IsNullOrWhiteSpace(objetivoSesionB))
                throw new ArgumentException("ObjetivoSesionB cannot be empty.", nameof(objetivoSesionB));
            ObjetivoSesionA = objetivoSesionA.Trim();
            ObjetivoSesionB = objetivoSesionB.Trim();
        }

        /// <summary>
        /// Sets each session's field zone independently. Not required by the constructor (kept
        /// out of it deliberately, to avoid breaking the many existing call sites that build a
        /// Microciclo without a zone) — callers that care about session zones (currently just
        /// <see cref="RFFM.Api.Infrastructure.Services.SeasonPlanImporter"/>) call this explicitly
        /// after construction.
        /// </summary>
        public void UpdateZones(int gameZoneIdSesionA, int gameZoneIdSesionB)
        {
            if (gameZoneIdSesionA <= 0)
                throw new ArgumentException("GameZoneIdSesionA must be a positive catalog id.", nameof(gameZoneIdSesionA));
            if (gameZoneIdSesionB <= 0)
                throw new ArgumentException("GameZoneIdSesionB must be a positive catalog id.", nameof(gameZoneIdSesionB));
            GameZoneIdSesionA = gameZoneIdSesionA;
            GameZoneIdSesionB = gameZoneIdSesionB;
        }

        public void UpdateSesionAHabilidades(IEnumerable<string>? habilidades) => SesionAHabilidades = ValidateHabilidades(habilidades);

        public void UpdateSesionBHabilidades(IEnumerable<string>? habilidades) => SesionBHabilidades = ValidateHabilidades(habilidades);

        public void ReplaceSubprincipioLinks(string session, IEnumerable<string>? subprincipioIds)
        {
            ValidateSession(session);
            SubprincipioLinks.RemoveAll(l => l.Session == session);
            foreach (var subprincipioId in (subprincipioIds ?? Enumerable.Empty<string>()).Distinct())
                SubprincipioLinks.Add(new MicrocicloSubprincipioLink(Id, session, subprincipioId));
        }

        public void ReplaceSubSubPrincipioLinks(string session, IEnumerable<string>? subSubPrincipioIds)
        {
            ValidateSession(session);
            SubSubPrincipioLinks.RemoveAll(l => l.Session == session);
            foreach (var subSubPrincipioId in (subSubPrincipioIds ?? Enumerable.Empty<string>()).Distinct())
                SubSubPrincipioLinks.Add(new MicrocicloSubSubPrincipioLink(Id, session, subSubPrincipioId));
        }

        private static List<string> ValidateHabilidades(IEnumerable<string>? habilidades)
        {
            var list = (habilidades ?? Enumerable.Empty<string>()).ToList();
            foreach (var habilidad in list)
            {
                if (!Habilidad.Vocabulary.Contains(habilidad))
                    throw new ArgumentException(
                        $"'{habilidad}' is not a valid Habilidad name. Must be one of the 15-value closed vocabulary.",
                        nameof(habilidades));
            }
            return list;
        }

        private static void ValidateSession(string session)
        {
            if (session != SessionA && session != SessionB)
                throw new ArgumentException($"Session must be '{SessionA}' or '{SessionB}'.", nameof(session));
        }
    }
}
