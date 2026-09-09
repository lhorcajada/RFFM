using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Players.Services
{
    /// <summary>
    /// Advances a player's persisted Forma física/Cansancio (<see cref="TeamPlayerCondition"/>)
    /// day by day, from the last stored checkpoint up to <c>asOfDateUtc</c>, applying
    /// <see cref="PlayerConditionDayEffect"/> based on the real events (training convocations,
    /// match participations) that happened each day. Idempotent: calling it again with a date
    /// already covered by the checkpoint is a no-op.
    /// See openspec/changes/player-physical-condition-fatigue/design.md → Decisión 3.
    /// </summary>
    public class PlayerConditionRecalculationService(AppDbContext db)
    {
        private static readonly int TrainingEventTypeId = SportEventType.FromName("Entrenamiento").Id;
        private static readonly int InjuryExcuseTypeId = ExcuseTypes.FromId(1)!.Id;

        public async Task<TeamPlayerCondition> RecalculateAsync(
            string teamPlayerId, DateTime asOfDateUtc, CancellationToken ct)
        {
            var asOfDate = asOfDateUtc.Date;
            var condition = await db.TeamPlayerConditions
                .FirstOrDefaultAsync(c => c.TeamPlayerId == teamPlayerId, ct);

            if (condition is null)
            {
                var joinedDate = await db.TeamPlayers
                    .Where(tp => tp.Id == teamPlayerId)
                    .Select(tp => tp.JoinedDate)
                    .FirstAsync(ct);
                condition = TeamPlayerCondition.CreateInitial(teamPlayerId, joinedDate.Date);
                db.TeamPlayerConditions.Add(condition);
            }

            if (condition.LastCalculatedDate.Date >= asOfDate) return condition; // ya al día

            var dayEvents = await LoadDayEventsAsync(teamPlayerId, condition.LastCalculatedDate.Date.AddDays(1), asOfDate, ct);

            for (var day = condition.LastCalculatedDate.Date.AddDays(1); day <= asOfDate; day = day.AddDays(1))
            {
                dayEvents.TryGetValue(day, out var dayEvent); // default = Rest si no hay entrada
                var (fitnessDelta, fatigueDelta) = PlayerConditionDayEffect.Calculate(dayEvent);
                condition.Advance(fitnessDelta, fatigueDelta, day);
            }

            await db.SaveChangesAsync(ct);

            return condition;
        }

        private async Task<Dictionary<DateTime, PlayerConditionDayEffect.DayEvent>> LoadDayEventsAsync(
            string teamPlayerId, DateTime fromDateInclusive, DateTime toDateInclusive, CancellationToken ct)
        {
            // Partidos: MatchParticipation "finished" del jugador, unidos a SportEvents para
            // obtener la fecha, agrupados por fecha (suma minutos si hay más de una participación
            // el mismo día).
            var matchParticipations = await (
                from mp in db.MatchParticipations.AsNoTracking()
                join se in db.SportEvents.AsNoTracking() on mp.EventId equals se.Id
                where mp.TeamPlayerId == teamPlayerId && mp.MatchPhase == "finished"
                      && se.EveDateTime != null
                select new { Date = se.EveDateTime!.Value.Date, mp.MinutesPlayed })
                .ToListAsync(ct);

            var matchDays = matchParticipations
                .Where(x => x.Date >= fromDateInclusive && x.Date <= toDateInclusive)
                .GroupBy(x => x.Date)
                .ToDictionary(
                    g => g.Key,
                    g => new PlayerConditionDayEffect.DayEvent(
                        PlayerConditionDayEffect.DayOutcome.Match, g.Sum(x => x.MinutesPlayed)));

            // Entrenamientos: Convocations de SportEvents de tipo "Entrenamiento" del jugador.
            var trainingConvocations = await (
                from c in db.Convocations.AsNoTracking()
                join se in db.SportEvents.AsNoTracking() on c.SportEventId equals se.Id
                where c.TeamPlayerId == teamPlayerId && se.EventTypeId == TrainingEventTypeId
                      && se.EveDateTime != null
                select new { Date = se.EveDateTime!.Value.Date, c.AssistanceTypeId, c.ExcuseTypeId })
                .ToListAsync(ct);

            var trainingDays = new Dictionary<DateTime, PlayerConditionDayEffect.DayEvent>();
            foreach (var convocation in trainingConvocations)
            {
                if (convocation.Date < fromDateInclusive || convocation.Date > toDateInclusive) continue;

                if (convocation.ExcuseTypeId == InjuryExcuseTypeId)
                {
                    trainingDays[convocation.Date] = new PlayerConditionDayEffect.DayEvent(PlayerConditionDayEffect.DayOutcome.InjuryAbsence);
                }
                else if (convocation.AssistanceTypeId == AssistanceType.Attendance.Id || convocation.AssistanceTypeId == AssistanceType.LateArrival.Id)
                {
                    if (!trainingDays.ContainsKey(convocation.Date))
                        trainingDays[convocation.Date] = new PlayerConditionDayEffect.DayEvent(PlayerConditionDayEffect.DayOutcome.Training);
                }
            }

            // Un día con partido gana sobre entrenamiento/lesión ese mismo día.
            foreach (var (date, dayEvent) in matchDays)
                trainingDays[date] = dayEvent;

            return trainingDays;
        }
    }
}
