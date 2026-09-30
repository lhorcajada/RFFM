using RFFM.Api.Domain.Aggregates.Assistances;

namespace RFFM.Api.Features.Coaches.Players.Services
{
    /// <summary>
    /// Convierte las filas de convocatorias y participaciones de un jugador en las entradas de
    /// Estado de forma/Rodaje (<see cref="DailyLoadModel"/>) y Cansancio
    /// (<see cref="PlayerFatigueCalculator"/>) vistas desde <c>asOf</c>. Compartido por las
    /// estadísticas de plantilla y la evolución física diaria para que ambas calculen igual.
    /// See openspec/changes/player-physical-evolution/design.md → D4.
    /// </summary>
    public static class PlayerLoadInputsBuilder
    {
        public record TrainingConvocationRow(
            string EventId, DateTime Date, IReadOnlyList<string> TrainingTypes,
            int? AssistanceTypeId, int? ConvocationStatusId, int? ExcuseTypeId);

        // Partido del equipo (Liga/Amistoso/Torneo) con alguna participación `finished`.
        public record TeamMatchRow(string EventId, DateTime Date, int EventTypeId);

        public record MatchConvocationRow(string EventId, int? AssistanceTypeId, int? ConvocationStatusId, int? ExcuseTypeId);

        public record MatchParticipationRow(string EventId, DateTime Date, int EventTypeId, int MinutesPlayed);

        public static List<DailyLoadModel.TrainingInput> Trainings(IEnumerable<TrainingConvocationRow> rows, DateTime asOf) =>
            rows
                .Where(r => r.Date <= asOf)
                .Select(r => new DailyLoadModel.TrainingInput(
                    r.EventId,
                    r.Date,
                    r.TrainingTypes,
                    FormStatusOutcome.Classify(r.AssistanceTypeId, r.ConvocationStatusId, r.ExcuseTypeId),
                    FormStatusOutcome.ReasonFor(r.AssistanceTypeId, r.ExcuseTypeId)))
                .ToList();

        public static List<DailyLoadModel.MatchInput> Matches(
            IEnumerable<TeamMatchRow> teamMatches,
            IReadOnlyDictionary<string, int> minutesByEvent,
            IReadOnlyDictionary<string, MatchConvocationRow> convocationByEvent,
            DateTime joinedDate,
            DateTime? leftDate,
            DateTime asOf) =>
            teamMatches
                .Where(m => m.Date <= asOf
                            && (minutesByEvent.ContainsKey(m.EventId)
                                || (m.Date.Date >= joinedDate.Date && (leftDate is null || m.Date <= leftDate))))
                .Select(m => new DailyLoadModel.MatchInput(
                    m.EventId,
                    m.Date,
                    m.EventTypeId,
                    minutesByEvent.TryGetValue(m.EventId, out var minutes) ? minutes : 0,
                    MissedReason(convocationByEvent, m.EventId)))
                .ToList();

        public static List<(string EventId, DateTime? EventDate, int DaysAgo, IReadOnlyList<string> TrainingTypes)> FatigueTrainings(
            IEnumerable<TrainingConvocationRow> rows, DateTime asOf) =>
            rows
                .Where(r => (r.AssistanceTypeId == AssistanceType.Attendance.Id || r.AssistanceTypeId == AssistanceType.LateArrival.Id)
                            && InFatigueWindow(r.Date, asOf))
                .GroupBy(r => r.EventId)
                .Select(g => g.First())
                .Select(r => (r.EventId, (DateTime?)r.Date, DaysAgo(r.Date, asOf), r.TrainingTypes))
                .ToList();

        public static List<(string EventId, DateTime? EventDate, int DaysAgo, int MinutesPlayed, int EventTypeId)> FatigueMatches(
            IEnumerable<MatchParticipationRow> participations, DateTime asOf) =>
            participations
                .Where(p => InFatigueWindow(p.Date, asOf))
                .Select(p => (p.EventId, (DateTime?)p.Date, DaysAgo(p.Date, asOf), p.MinutesPlayed, p.EventTypeId))
                .ToList();

        private static bool InFatigueWindow(DateTime date, DateTime asOf) =>
            date >= asOf.AddDays(-PlayerFatigueCalculator.WindowDays) && date.Date <= asOf.Date;

        private static int DaysAgo(DateTime date, DateTime asOf) => (int)(asOf.Date - date.Date).TotalDays;

        // Motivo informativo de un partido del equipo sin minutos para el jugador.
        private static string MissedReason(IReadOnlyDictionary<string, MatchConvocationRow> convocationByEvent, string eventId)
        {
            if (!convocationByEvent.TryGetValue(eventId, out var conv))
                return "No convocado";
            return FormStatusOutcome.Classify(conv.AssistanceTypeId, conv.ConvocationStatusId, conv.ExcuseTypeId) == ParticipationOutcome.Attended
                ? "Convocado sin jugar"
                : FormStatusOutcome.ReasonFor(conv.AssistanceTypeId, conv.ExcuseTypeId);
        }
    }
}
