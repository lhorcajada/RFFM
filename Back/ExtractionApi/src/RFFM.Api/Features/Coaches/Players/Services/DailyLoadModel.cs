namespace RFFM.Api.Features.Coaches.Players.Services
{
    /// <summary>
    /// Motor puro de carga diaria compartido por Estado de forma y Rodaje: reproduce día a día un
    /// valor 0-100 que sube con cada día de actividad con saturación exponencial
    /// (v = 100 − (100 − v)·e^(−k·L)) y, tras <see cref="Parameters.GraceRestDays"/> días seguidos
    /// sin actividad, baja min(step·n, max) puntos el n-ésimo día. La saturación exponencial hace
    /// que el resultado de una racha activa dependa solo de la carga total, no de su reparto.
    /// See openspec/changes/player-form-readiness-daily-load-model/design.md → Decisión 1.
    /// </summary>
    public static class DailyLoadModel
    {
        public const string StepKindActivity = "Activity";
        public const string StepKindDecay = "Decay";

        public record Parameters(double GainRate, int GraceRestDays, double DecayStepPerDay, double DecayMaxPerDay);

        public record LoadEvent(
            string EventId, DateTime Date, int EventTypeId, IReadOnlyList<string> TrainingTypes,
            int MinutesPlayed, double TypeWeight, double Load);

        public record Step(
            DateTime Date, DateTime? EndDate, string Kind,
            double Load, double ValueBefore, double ValueAfter, LoadEvent[] Events);

        public record Result(double Value, int CurrentRestStreakDays, Step[] Steps);

        public const int ReplayDays = 84;
        public const int MaxMissedEvents = 10;

        // Un partido de los minutos de referencia equivale a 1.5 entrenos de peso 1.00: es el
        // mayor estímulo de la semana. Ver design.md → Decisión 2.
        public const double MatchLoadPerReferenceMatch = 1.5;

        public record TrainingInput(
            string EventId, DateTime Date, IReadOnlyList<string> TrainingTypes, ParticipationOutcome Outcome, string? Reason);

        public record MatchInput(string EventId, DateTime Date, int EventTypeId, int MinutesPlayed, string? Reason);

        public record MissedEvent(string EventId, DateTime Date, int EventTypeId, string Reason);

        public record MetricResult(
            int? Value,
            Result? Model,
            Parameters Parameters,
            DateTime StartDate,
            double ReferenceMatchMinutes,
            int TrainingsAttended,
            int MatchesPlayed,
            int MatchMinutesPlayed,
            MissedEvent[] MissedEvents);

        /// <summary>
        /// Convierte entrenos asistidos y partidos con minutos en eventos de carga y reproduce el
        /// modelo. Sin ninguna actividad en la reproducción el valor es null.
        /// </summary>
        public static MetricResult Evaluate(
            IReadOnlyList<TrainingInput> trainings,
            IReadOnlyList<MatchInput> matches,
            int trainingEventTypeId,
            DateTime startDate,
            DateTime today,
            Parameters p,
            Func<IReadOnlyList<string>, double> trainingTypeWeight,
            Func<int, double> matchTypeWeight,
            double referenceMatchMinutes)
        {
            var start = startDate.Date;
            var end = today.Date;
            bool InReplay(DateTime date) => date.Date >= start && date.Date <= end;

            var trainingsInReplay = trainings.Where(t => InReplay(t.Date)).ToList();
            var matchesInReplay = matches.Where(m => InReplay(m.Date)).ToList();
            var attended = trainingsInReplay.Where(t => t.Outcome == ParticipationOutcome.Attended).ToList();
            var played = matchesInReplay.Where(m => m.MinutesPlayed > 0).ToList();

            var events = attended
                .Select(t =>
                {
                    var w = trainingTypeWeight(t.TrainingTypes);
                    return new LoadEvent(t.EventId, t.Date, trainingEventTypeId, t.TrainingTypes, 0, w, w);
                })
                .Concat(played.Select(m =>
                {
                    var w = matchTypeWeight(m.EventTypeId);
                    var load = MatchLoadPerReferenceMatch * m.MinutesPlayed / referenceMatchMinutes * w;
                    return new LoadEvent(m.EventId, m.Date, m.EventTypeId, Array.Empty<string>(), m.MinutesPlayed, w, load);
                }))
                .ToList();

            var missed = trainingsInReplay
                .Where(t => t.Outcome != ParticipationOutcome.Attended)
                .Select(t => new MissedEvent(t.EventId, t.Date, trainingEventTypeId, t.Reason ?? "Sin motivo registrado"))
                .Concat(matchesInReplay
                    .Where(m => m.MinutesPlayed <= 0)
                    .Select(m => new MissedEvent(m.EventId, m.Date, m.EventTypeId, m.Reason ?? "Sin minutos")))
                .OrderByDescending(m => m.Date)
                .Take(MaxMissedEvents)
                .ToArray();

            var model = events.Count == 0 ? null : Simulate(start, end, events, p);
            int? value = model is null
                ? null
                : Math.Clamp((int)Math.Round(model.Value, MidpointRounding.AwayFromZero), 0, 100);

            return new MetricResult(
                value, model, p, start, referenceMatchMinutes,
                attended.Count, played.Count, played.Sum(m => m.MinutesPlayed), missed);
        }

        public static Result Simulate(DateTime startDate, DateTime today, IReadOnlyList<LoadEvent> events, Parameters p)
        {
            var start = startDate.Date;
            var eventsByDay = events
                .Where(e => e.Date.Date >= start && e.Date.Date <= today.Date)
                .GroupBy(e => e.Date.Date)
                .ToDictionary(g => g.Key, g => g.ToArray());
            // Hoy solo cuenta si ya ha habido actividad: un día sin terminar no es un día de descanso.
            var end = eventsByDay.ContainsKey(today.Date) ? today.Date : today.Date.AddDays(-1);

            var steps = new List<Step>();
            // Se guarda el hueco hasta 100 en lugar del valor: con 100 − (100 − v)·e^(−kL) el valor
            // se queda atascado en 100 − 1 ulp y un 99.5 exacto acabaría redondeando a 99.
            var gap = 100d;
            var value = 0d;
            var restStreak = 0;
            DateTime? decayStart = null;
            var valueBeforeDecay = 0d;

            void CloseDecay(DateTime lastDay)
            {
                if (decayStart is null) return;
                steps.Add(new Step(decayStart.Value, lastDay, StepKindDecay, 0d, valueBeforeDecay, value, Array.Empty<LoadEvent>()));
                decayStart = null;
            }

            for (var day = start; day <= end; day = day.AddDays(1))
            {
                if (eventsByDay.TryGetValue(day, out var dayEvents))
                {
                    CloseDecay(day.AddDays(-1));
                    restStreak = 0;
                    var load = dayEvents.Sum(e => e.Load);
                    var before = value;
                    gap *= Math.Exp(-p.GainRate * load);
                    value = 100d - gap;
                    steps.Add(new Step(day, null, StepKindActivity, load, before, value, dayEvents));
                    continue;
                }

                restStreak++;
                if (restStreak <= p.GraceRestDays) continue;

                var n = restStreak - p.GraceRestDays;
                if (decayStart is null)
                {
                    decayStart = day;
                    valueBeforeDecay = value;
                }
                gap = Math.Min(100d, gap + Math.Min(p.DecayStepPerDay * n, p.DecayMaxPerDay));
                value = 100d - gap;
            }
            CloseDecay(end);

            // Una racha que empieza ya en 0 no pierde nada: no se muestra como paso.
            var visibleSteps = steps
                .Where(s => s.Kind == StepKindActivity || s.ValueBefore > s.ValueAfter)
                .Reverse()
                .ToArray();

            return new Result(value, restStreak, visibleSteps);
        }
    }
}
