using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Federation.Results;
using RFFM.Api.Domain.Entities.Teams;
using RFFM.Api.Domain.Services;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Quiniela
{
    public record QuinielaJornadaDto(
        string Id, string TeamId, string RffmRoundId, int RoundNumber, string RoundName, decimal Price, string Status,
        decimal CarryIn, DateTime? FirstKickoffUtc, DateTime? PaymentDeadlineUtc, bool PicksClosed);

    public record QuinielaMatchDto(
        string RecordCode, string HomeTeam, string AwayTeam, DateTime? KickoffUtc, bool IsValid, bool IsPleno,
        int? HomeGoals, int? AwayGoals, bool IsFinal);

    public record QuinielaPickDto(string RecordCode, string Sign);

    public record QuinielaTicketDto(
        string Id, IReadOnlyList<QuinielaPickDto> Picks, int PlenoHome, int PlenoAway, string PaymentStatus,
        DateTime? PaymentDeadlineUtc, int? Hits, string? Category, decimal? Prize);

    public record QuinielaPoolDto(int Participants, int PaidTickets, decimal Collected, decimal PrizePool, decimal PossiblePrizePool);

    public record QuinielaWinnerDto(string UserName, string Category, int Hits, decimal Prize);

    public record QuinielaPreviousDto(
        string JornadaId, int RoundNumber, DateTime SettledAt, decimal CarryOut, int? MyHits, string? MyCategory, decimal? MyPrize,
        IReadOnlyList<QuinielaWinnerDto> Winners);

    public record QuinielaCurrentDto(
        bool IsOpen, QuinielaJornadaDto? Jornada, IReadOnlyList<QuinielaMatchDto> Matches, QuinielaTicketDto? MyTicket,
        QuinielaPoolDto? Pool, QuinielaPreviousDto? Previous, bool CanManage);

    public record QuinielaPaymentTicketDto(
        string Id, string UserId, string UserName, string Role, string PaymentStatus, string? PaymentMethod,
        DateTime? PaidAt, int? Hits, string? Category, decimal? Prize,
        IReadOnlyList<QuinielaPickDto> Picks, int PlenoHome, int PlenoAway);

    public record QuinielaTotalsDto(
        decimal Collected, decimal Pending, decimal PrizePool, decimal FundAmount, decimal CarryIn, decimal? CarryOut, decimal Prizes,
        decimal PrizePercent, decimal PossiblePrizePool);

    public record QuinielaSettingsDto(decimal FundPercent);

    public record QuinielaFundMovementDto(string Id, decimal Amount, DateTime OccurredAt, string? Description);

    public record QuinielaPaymentsDto(
        QuinielaJornadaDto Jornada, IReadOnlyList<QuinielaPaymentTicketDto> Tickets, QuinielaTotalsDto Totals,
        IReadOnlyList<QuinielaFundMovementDto> Movements, IReadOnlyList<QuinielaMatchDto> Matches);

    public record QuinielaTicketResultDto(string TicketId, int Hits, string Category, decimal Prize);

    public record QuinielaSettlementDto(
        decimal Collected, decimal PrizePool, decimal FundAmount, decimal CarryOut, IReadOnlyList<QuinielaTicketResultDto> Tickets);

    internal static class QuinielaConstants
    {
        public const string Tag = "Quiniela";
        public const string BaseRoute = "/api/teams/{teamId}/quiniela";
    }

    /// <summary>Partidos de una jornada RFFM interpretados para la quiniela (validez, horarios, Pleno y plazo de pago).</summary>
    internal sealed class QuinielaRound(RffmRound round, IReadOnlyList<RffmMatch> matches)
    {
        public int Number { get; } = round.Number;
        public string Name { get; } = round.Name;

        public IReadOnlyList<RffmMatch> Matches { get; } = matches
            .OrderBy(m => m.HasSchedule ? QuinielaSchedule.KickoffUtc(m.MatchDate!.Value, m.KickoffTime!.Value) : DateTime.MaxValue)
            .ThenBy(m => m.SortOrder)
            .ToList();

        public IReadOnlyList<RffmMatch> ValidMatches => Matches.Where(QuinielaMatchValidity.IsValid).ToList();

        public static DateTime? KickoffOf(RffmMatch match) =>
            match.HasSchedule ? QuinielaSchedule.KickoffUtc(match.MatchDate!.Value, match.KickoffTime!.Value) : null;

        public DateTime? FirstValidKickoffUtc => ValidMatches.Select(KickoffOf).Where(k => k.HasValue).Min();

        /// <summary>Plazo de pago (viernes 23:59 de Madrid de la semana del primer partido); null si ningún partido tiene fecha.</summary>
        public DateTime? PaymentDeadlineUtc
        {
            get
            {
                var firstDate = ValidMatches.Where(m => m.MatchDate.HasValue).Select(m => m.MatchDate!.Value).Cast<DateOnly?>().Min();
                return firstDate.HasValue ? QuinielaSchedule.PaymentDeadlineUtc(firstDate.Value) : null;
            }
        }

        public IReadOnlyList<QuinielaScoring.MatchInfo> ToMatchInfos() => Matches
            .Select((m, index) => new QuinielaScoring.MatchInfo(
                m.RecordCode, QuinielaMatchValidity.IsValid(m), KickoffOf(m), index,
                m.IsFinal && int.TryParse(m.LocalGoals, out var home) ? home : null,
                m.IsFinal && int.TryParse(m.VisitorGoals, out var away) ? away : null))
            .ToList();

        public IReadOnlyList<QuinielaMatchDto> ToMatchDtos()
        {
            var plenoCode = PlenoRecordCode;
            return Matches
                .Select(m => new QuinielaMatchDto(
                    m.RecordCode, m.LocalTeamName, m.VisitorTeamName, KickoffOf(m), QuinielaMatchValidity.IsValid(m),
                    m.RecordCode == plenoCode,
                    m.IsFinal && int.TryParse(m.LocalGoals, out var home) ? home : null,
                    m.IsFinal && int.TryParse(m.VisitorGoals, out var away) ? away : null,
                    m.IsFinal))
                .ToList();
        }

        public string? PlenoRecordCode
        {
            get
            {
                var valid = ToMatchInfos().Where(m => m.IsValid).ToList();
                return valid.Count == 0 ? null : QuinielaScoring.PlenoMatch(valid).RecordCode;
            }
        }
    }

    /// <summary>
    /// Autorización por pertenencia al equipo (<see cref="UserTeam"/>/<see cref="Membership"/>), carga y mapeo
    /// compartidos por los endpoints de quiniela. See openspec/changes/quiniela-team-pool/design.md → D7.
    /// </summary>
    internal static class QuinielaSupport
    {
        public static readonly Membership[] ParticipantRoles = [Membership.Coach, Membership.Player, Membership.FamilyPlayer];
        public static readonly Membership[] CoachOnly = [Membership.Coach];

        public static async Task RequireRoleAsync(
            AppDbContext db, ICurrentUserService currentUser, string teamId, Membership[] allowed, CancellationToken ct)
        {
            if (!currentUser.IsAuthenticated || string.IsNullOrEmpty(currentUser.UserId))
                throw new UnauthorizedAccessException("No autenticado.");

            var allowedIds = allowed.Select(m => m.Id).ToArray();
            var userId = currentUser.UserId;
            var hasTeamRole = await db.UserTeams.AsNoTracking()
                .AnyAsync(ut => ut.ApplicationUserId == userId && ut.TeamId == teamId && allowedIds.Contains(ut.RoleId), ct);
            var hasRole = hasTeamRole || (allowedIds.Contains(Membership.Coach.Id) && await IsClubManagerAsync(db, userId, teamId, ct));
            if (!hasRole)
                throw new ForbiddenAccessException("No tienes permiso para esta acción de la quiniela del equipo.");
        }

        /// <summary>Entrenador del equipo (UserTeams) o entrenador/directivo del club del equipo (UserClubs).</summary>
        public static async Task<bool> IsCoachAsync(AppDbContext db, string userId, string teamId, CancellationToken ct) =>
            await db.UserTeams.AsNoTracking()
                .AnyAsync(ut => ut.ApplicationUserId == userId && ut.TeamId == teamId && ut.RoleId == Membership.Coach.Id, ct)
            || await IsClubManagerAsync(db, userId, teamId, ct);

        private static Task<bool> IsClubManagerAsync(AppDbContext db, string userId, string teamId, CancellationToken ct) =>
            db.UserClubs.AsNoTracking().AnyAsync(uc =>
                uc.ApplicationUserId == userId
                && (uc.RoleId == Membership.Coach.Id || uc.RoleId == Membership.Directive.Id)
                && db.Teams.Any(t => t.Id == teamId && t.ClubId == uc.ClubId), ct);

        public static async Task<QuinielaJornada> LoadJornadaAsync(
            AppDbContext db, string teamId, string jornadaId, CancellationToken ct, bool tracking = true)
        {
            var query = tracking ? db.QuinielaJornadas : db.QuinielaJornadas.AsNoTracking();
            return await query.SingleOrDefaultAsync(j => j.Id == jornadaId && j.TeamId == teamId, ct)
                ?? throw new NotFoundException($"Quiniela '{jornadaId}' Not Found", ErrorCodes.QuinielaNotFound);
        }

        public static async Task<QuinielaRound> LoadRoundAsync(FederationDbContext fed, string rffmRoundId, CancellationToken ct)
        {
            var round = await fed.RffmRounds.AsNoTracking().SingleOrDefaultAsync(r => r.Id == rffmRoundId, ct)
                ?? throw new NotFoundException($"RffmRound '{rffmRoundId}' Not Found", ErrorCodes.QuinielaNotFound);
            var matches = await fed.RffmMatches.AsNoTracking().Where(m => m.RffmRoundId == rffmRoundId).ToListAsync(ct);
            return new QuinielaRound(round, matches);
        }

        public static QuinielaJornadaDto ToDto(QuinielaJornada jornada, QuinielaRound round, DateTime nowUtc) => new(
            jornada.Id, jornada.TeamId, jornada.RffmRoundId, round.Number, round.Name, jornada.Price, jornada.Status.Name,
            jornada.CarryIn, round.FirstValidKickoffUtc, round.PaymentDeadlineUtc,
            jornada.Status == QuinielaJornadaStatus.Settled
            || (round.FirstValidKickoffUtc is { } kickoff && nowUtc >= kickoff));

        public static QuinielaTicketDto ToDto(QuinielaTicket ticket, QuinielaRound round, DateTime nowUtc) => new(
            ticket.Id,
            ticket.Picks.Select(p => new QuinielaPickDto(p.RecordCode, p.Sign.Name)).OrderBy(p => p.RecordCode).ToList(),
            ticket.PlenoHome, ticket.PlenoAway, EffectiveStatus(ticket, round, nowUtc).Name, round.PaymentDeadlineUtc,
            ticket.Hits, ticket.Category?.Name, ticket.Prize);

        public static QuinielaPaymentStatus EffectiveStatus(QuinielaTicket ticket, QuinielaRound round, DateTime nowUtc) =>
            round.PaymentDeadlineUtc is { } deadline ? ticket.EffectiveStatus(deadline, nowUtc) : ticket.PaymentStatus;

        public sealed record Participant(string Name, string Role);

        /// <summary>Nombre (datos personales) y rol en el equipo de cada usuario con boleto.</summary>
        public static async Task<Dictionary<string, Participant>> LoadParticipantsAsync(
            AppDbContext db, string teamId, IReadOnlyCollection<string> userIds, CancellationToken ct)
        {
            var roles = await db.UserTeams.AsNoTracking()
                .Where(ut => ut.TeamId == teamId && userIds.Contains(ut.ApplicationUserId))
                .Select(ut => new { ut.ApplicationUserId, ut.RoleId })
                .ToListAsync(ct);
            var names = await db.UserPersonalData.AsNoTracking()
                .Where(d => userIds.Contains(d.ApplicationUserId))
                .Select(d => new { d.ApplicationUserId, d.FirstName, d.LastName })
                .ToListAsync(ct);

            var familyNames = await db.TeamPlayerFamilyMembers.AsNoTracking()
                .Where(f => f.LinkedUserId != null && userIds.Contains(f.LinkedUserId) && f.TeamPlayer.TeamId == teamId)
                .Select(f => new { UserId = f.LinkedUserId!, f.Name, f.LastName })
                .ToListAsync(ct);

            return userIds.ToDictionary(
                id => id,
                id =>
                {
                    var name = names.FirstOrDefault(n => n.ApplicationUserId == id);
                    var familyName = familyNames.FirstOrDefault(f => f.UserId == id);
                    var role = roles.FirstOrDefault(r => r.ApplicationUserId == id);
                    var fullName = name is not null
                        ? $"{name.FirstName} {name.LastName}".Trim()
                        : familyName is not null && $"{familyName.Name} {familyName.LastName}".Trim() is { Length: > 0 } familyFullName
                            ? familyFullName
                            : "Sin nombre";
                    return new Participant(fullName, role is null ? string.Empty : Membership.GetById(role.RoleId)?.Key ?? string.Empty);
                });
        }

        public static QuinielaPaymentTicketDto ToPaymentDto(
            QuinielaTicket ticket, IReadOnlyDictionary<string, Participant> participants, QuinielaPaymentStatus status)
        {
            var participant = participants.GetValueOrDefault(ticket.ApplicationUserId) ?? new Participant("Sin nombre", string.Empty);
            return new QuinielaPaymentTicketDto(
                ticket.Id, ticket.ApplicationUserId, participant.Name, participant.Role, status.Name,
                ticket.PaymentMethod?.Name, ticket.PaidAt, ticket.Hits, ticket.Category?.Name, ticket.Prize,
                ticket.Picks.Select(p => new QuinielaPickDto(p.RecordCode, p.Sign.Name)).OrderBy(p => p.RecordCode).ToList(),
                ticket.PlenoHome, ticket.PlenoAway);
        }

        /// <summary>Bolsa de premios estimada con lo cobrado hasta ahora: cobrado × % de premios (truncado al céntimo) + bote arrastrado.</summary>
        public static (decimal PrizeBase, decimal FundAmount) SplitCollected(decimal collected, decimal prizePercent)
        {
            var prizeBase = Math.Floor(collected * prizePercent / 100m * 100m) / 100m;
            return (prizeBase, collected - prizeBase);
        }
    }

    public static class QuinielaServiceCollectionExtensions
    {
        /// <summary>Registro explícito de validadores: el proyecto no escanea el ensamblado.</summary>
        public static IServiceCollection AddQuinielaValidators(this IServiceCollection services)
        {
            services.AddScoped<IValidator<OpenQuiniela.Command>, OpenQuiniela.Validator>();
            services.AddScoped<IValidator<SaveQuinielaTicket.Command>, SaveQuinielaTicket.Validator>();
            services.AddScoped<IValidator<SetQuinielaTicketPayment.Command>, SetQuinielaTicketPayment.Validator>();
            services.AddScoped<IValidator<SettleQuiniela.Command>, SettleQuiniela.Validator>();
            services.AddScoped<IValidator<DeleteQuinielaTicket.Command>, DeleteQuinielaTicket.Validator>();
            services.AddScoped<IValidator<DeleteMyQuinielaTicket.Command>, DeleteMyQuinielaTicket.Validator>();
            services.AddScoped<IValidator<ResetQuiniela.Command>, ResetQuiniela.Validator>();
            services.AddScoped<IValidator<UpdateQuinielaSettings.Command>, UpdateQuinielaSettings.Validator>();
            return services;
        }
    }
}
