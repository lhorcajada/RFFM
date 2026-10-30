using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities.Teams;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Quiniela
{
    /// <summary>
    /// Liquidación y apertura de jornadas, compartidas por los endpoints del entrenador y por el cierre automático.
    /// See openspec/changes/quiniela-auto-settle-history/design.md → D1.
    /// </summary>
    internal static class QuinielaLifecycle
    {
        public const decimal TicketPrice = 1m;

        /// <summary>Puntúa los boletos, liquida la jornada y aporta al fondo del equipo; persiste con un único SaveChanges.</summary>
        public static async Task<QuinielaSettlementDto> SettleAsync(
            AppDbContext db, QuinielaJornada jornada, QuinielaRound round, DateTime nowUtc, CancellationToken ct)
        {
            if (jornada.Status == QuinielaJornadaStatus.Settled)
                throw new DomainException("Quiniela", "La quiniela de esta jornada ya está liquidada.", ErrorCodes.QuinielaAlreadySettled);

            var tickets = await db.QuinielaTickets.Where(t => t.JornadaId == jornada.Id).ToListAsync(ct);
            var result = QuinielaScoring.Score(round.ToMatchInfos(), tickets, jornada.Price, jornada.PrizePercent, jornada.CarryIn);

            foreach (var score in result.Tickets)
                tickets.Single(t => t.Id == score.TicketId).ApplyResult(score.Hits, score.Category, score.Prize);
            jornada.Settle(result.CarryOut, nowUtc);

            if (result.FundAmount > 0m)
                db.TeamFundMovements.Add(TeamFundMovement.Create(
                    jornada.TeamId, result.FundAmount, TeamFundMovementSource.QuinielaFund, null, nowUtc,
                    $"Quiniela jornada {round.Number}"));

            try
            {
                await db.SaveChangesAsync(ct);
            }
            catch (DbUpdateConcurrencyException)
            {
                db.ChangeTracker.Clear();
                throw new DomainException("Quiniela", "La quiniela de esta jornada ya está liquidada.", ErrorCodes.QuinielaAlreadySettled);
            }

            return new QuinielaSettlementDto(
                result.Collected, result.PrizePool, result.FundAmount, result.CarryOut,
                result.Tickets.Select(t => new QuinielaTicketResultDto(t.TicketId, t.Hits, t.Category.Name, t.Prize)).ToList());
        }

        /// <summary>
        /// Abre la quiniela de la siguiente jornada RFFM con partidos válidos pendientes. Devuelve null si no hay ninguna;
        /// lanza <see cref="ConflictException"/> si el equipo no tiene liga o ya tiene una quiniela abierta.
        /// </summary>
        public static async Task<QuinielaJornadaDto?> OpenNextAsync(
            AppDbContext db, FederationDbContext federationDb, string teamId, DateTime nowUtc, CancellationToken ct)
        {
            var groupId = await db.Teams.AsNoTracking()
                .Where(t => t.Id == teamId && t.RffmCompetitionId != null)
                .Select(t => t.RffmGroupId)
                .SingleOrDefaultAsync(ct);
            if (groupId is null)
                throw new ConflictException("El equipo no tiene una competición RFFM configurada.", ErrorCodes.QuinielaTeamWithoutLeague);

            var existing = await db.QuinielaJornadas.AsNoTracking()
                .Where(j => j.TeamId == teamId)
                .Select(j => new { j.RffmRoundId, j.Status, j.CarryOut, j.SettledAt })
                .ToListAsync(ct);
            if (existing.Any(j => j.Status == QuinielaJornadaStatus.Open))
                throw new ConflictException("Ya hay una quiniela abierta: liquídala antes de abrir la siguiente.", ErrorCodes.QuinielaAlreadyOpen);

            var openedRoundIds = existing.Select(j => j.RffmRoundId).ToHashSet();
            var groupCode = groupId.Value.ToString();
            var rounds = await federationDb.RffmRounds.AsNoTracking()
                .Where(r => r.GroupCode == groupCode)
                .OrderBy(r => r.Number)
                .ToListAsync(ct);

            var highestOpenedNumber = rounds.Where(r => openedRoundIds.Contains(r.Id)).Select(r => r.Number).DefaultIfEmpty(0).Max();
            var candidateIds = rounds.Where(r => r.Number > highestOpenedNumber).Select(r => r.Id).ToList();
            var matches = (await federationDb.RffmMatches.AsNoTracking()
                    .Where(m => candidateIds.Contains(m.RffmRoundId))
                    .ToListAsync(ct))
                .ToLookup(m => m.RffmRoundId);

            var next = rounds
                .Where(r => r.Number > highestOpenedNumber)
                .FirstOrDefault(r => matches[r.Id].Any(m => QuinielaMatchValidity.IsValid(m) && !m.IsFinal));
            if (next is null)
                return null;

            var carryIn = existing.Where(j => j.Status == QuinielaJornadaStatus.Settled)
                .OrderByDescending(j => j.SettledAt)
                .Select(j => j.CarryOut)
                .FirstOrDefault() ?? 0m;

            var fundPercent = await db.QuinielaTeamSettings.AsNoTracking()
                .Where(s => s.TeamId == teamId)
                .Select(s => (decimal?)s.FundPercent)
                .SingleOrDefaultAsync(ct) ?? QuinielaTeamSettings.DefaultFundPercent;

            var jornada = QuinielaJornada.Create(teamId, next.Id, carryIn, TicketPrice, 100m - fundPercent);
            db.QuinielaJornadas.Add(jornada);
            await db.SaveChangesAsync(ct);

            var round = new QuinielaRound(next, matches[next.Id].ToList());
            return QuinielaSupport.ToDto(jornada, round, nowUtc);
        }
    }
}
