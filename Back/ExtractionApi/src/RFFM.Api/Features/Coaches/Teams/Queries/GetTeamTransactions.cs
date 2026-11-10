using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain.Entities.Teams;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.Quiniela;
using RFFM.Api.Features.Coaches.Teams;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Teams.Queries
{
    /// <summary>
    /// GET /api/catalog/team/{teamId}/transactions. Merges the team's sanctions, lottery books, quiniela tickets,
    /// quiniela fund movements and quiniela wallet top-ups and charges into one read-only list, each with a
    /// Pending or Paid status computed at query time. See openspec/changes/team-transactions-window/design.md.
    /// </summary>
    public class GetTeamTransactions : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/catalog/team/{teamId}/transactions",
                    async (string teamId, string? status, string? type, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var errors = new Dictionary<string, string[]>();
                        if (!TryParseFilter<TransactionStatus>(status, out var statusFilter))
                            errors[nameof(status)] = new[] { $"Estado de transacción desconocido: '{status}'." };
                        if (!TryParseFilter<TransactionType>(type, out var typeFilter))
                            errors[nameof(type)] = new[] { $"Tipo de transacción desconocido: '{type}'." };
                        if (errors.Count > 0)
                            return Results.ValidationProblem(errors);

                        var result = await mediator.Send(new TeamTransactionsQuery(teamId, statusFilter, typeFilter), cancellationToken);
                        return Results.Ok(result);
                    })
                .WithName(nameof(GetTeamTransactions))
                .WithTags(TeamConstants.TeamFeature)
                .Produces<IReadOnlyList<TeamTransactionDto>>()
                .ProducesValidationProblem()
                .ProducesProblem(StatusCodes.Status401Unauthorized)
                .ProducesProblem(StatusCodes.Status403Forbidden)
                .RequireAuthorization();
        }

        private static bool TryParseFilter<TEnum>(string? value, out TEnum? filter) where TEnum : struct, Enum
        {
            filter = null;
            if (string.IsNullOrWhiteSpace(value))
                return true;

            var name = Enum.GetNames<TEnum>().FirstOrDefault(n => string.Equals(n, value, StringComparison.OrdinalIgnoreCase));
            if (name is null)
                return false;

            filter = Enum.Parse<TEnum>(name);
            return true;
        }

        public enum TransactionType { Sanction, Lottery, Quiniela, WalletTopUp, WalletCharge }

        public enum TransactionStatus { Pending, Paid }

        public record TeamTransactionsQuery(string TeamId, TransactionStatus? Status, TransactionType? Type)
            : IQueryApp<IReadOnlyList<TeamTransactionDto>>;

        public record TeamTransactionDto(
            string Id, string Type, string? PersonName, decimal Amount, decimal? PendingAmount, DateTime? Date,
            string Description, string Status);

        public class Handler(AppDbContext db, FederationDbContext fed, ICurrentUserService currentUser, IdentityDbContext identityDb)
            : IRequestHandler<TeamTransactionsQuery, IReadOnlyList<TeamTransactionDto>>
        {
            private sealed record Row(
                string Id, TransactionType Type, string? PersonName, decimal Amount, decimal? PendingAmount,
                DateTime? Date, string Description, TransactionStatus Status);

            private sealed record TicketSource(
                string Id, string UserId, decimal Price, QuinielaPaymentStatus PaymentStatus, DateTime? PaidAt, string RffmRoundId);

            private sealed record WalletSource(
                string Id, string UserId, decimal Amount, QuinielaWalletMovementType Type, DateTime OccurredAt, string? Description);

            public async ValueTask<IReadOnlyList<TeamTransactionDto>> Handle(
                TeamTransactionsQuery request, CancellationToken cancellationToken = default)
            {
                await QuinielaSupport.RequireRoleAsync(db, currentUser, request.TeamId, QuinielaSupport.ParticipantRoles, cancellationToken);

                var teamId = request.TeamId;
                var userId = currentUser.UserId!;
                var seesWholeTeam = await QuinielaSupport.IsCoachAsync(db, userId, teamId, cancellationToken);
                var ownTeamPlayerIds = seesWholeTeam
                    ? null
                    : await LoadOwnTeamPlayerIdsAsync(teamId, userId, cancellationToken);
                var ownUserId = seesWholeTeam ? null : userId;

                var rows = new List<Row>();
                if (IsRequested(request.Type, TransactionType.Sanction))
                    rows.AddRange(await LoadSanctionsAsync(teamId, ownTeamPlayerIds, cancellationToken));
                if (IsRequested(request.Type, TransactionType.Lottery))
                    rows.AddRange(await LoadLotteryBooksAsync(teamId, ownTeamPlayerIds, cancellationToken));

                var tickets = new List<TicketSource>();
                if (IsRequested(request.Type, TransactionType.Quiniela))
                {
                    tickets = await LoadTicketsAsync(teamId, ownUserId, cancellationToken);
                    if (seesWholeTeam)
                        rows.AddRange(await LoadFundMovementsAsync(teamId, cancellationToken));
                }

                var walletMovements = new List<WalletSource>();
                var wantsWallet = IsRequested(request.Type, TransactionType.WalletTopUp) || IsRequested(request.Type, TransactionType.WalletCharge);
                if (wantsWallet)
                    walletMovements = await LoadWalletMovementsAsync(teamId, ownUserId, cancellationToken);

                var participantUserIds = tickets.Select(t => t.UserId).Concat(walletMovements.Select(m => m.UserId)).ToList();
                var participants = participantUserIds.Count == 0
                    ? new Dictionary<string, QuinielaSupport.Participant>()
                    : await QuinielaSupport.LoadParticipantsAsync(db, teamId, participantUserIds, cancellationToken, identityDb);
                var unpaidRoundIds = tickets
                    .Where(t => t.PaymentStatus == QuinielaPaymentStatus.Pending || t.PaidAt is null)
                    .Select(t => t.RffmRoundId)
                    .Distinct()
                    .ToList();
                var deadlines = await LoadPaymentDeadlinesAsync(unpaidRoundIds, cancellationToken);

                rows.AddRange(tickets.Select(t => TicketRow(t, participants, deadlines)));
                rows.AddRange(walletMovements.Select(m => WalletRow(m, participants)));

                return rows
                    .Where(row => request.Status is null || row.Status == request.Status)
                    .Where(row => request.Type is null || row.Type == request.Type)
                    .OrderBy(row => row.Date is null)
                    .ThenByDescending(row => row.Date)
                    .ThenBy(row => row.Type)
                    .ThenBy(row => row.Id, StringComparer.Ordinal)
                    .Select(row => new TeamTransactionDto(row.Id, row.Type.ToString(), row.PersonName, row.Amount,
                        row.PendingAmount, row.Date, row.Description, row.Status.ToString()))
                    .ToList();
            }

            private static bool IsRequested(TransactionType? filter, TransactionType type) => filter is null || filter == type;

            private async Task<List<string>> LoadOwnTeamPlayerIdsAsync(string teamId, string userId, CancellationToken ct)
            {
                var linked = await db.UserTeams.AsNoTracking()
                    .Where(ut => ut.TeamId == teamId && ut.ApplicationUserId == userId && ut.LinkedTeamPlayerId != null)
                    .Select(ut => ut.LinkedTeamPlayerId!)
                    .ToListAsync(ct);
                var asFamily = await db.TeamPlayerFamilyMembers.AsNoTracking()
                    .Where(f => f.LinkedUserId == userId && f.TeamPlayer.TeamId == teamId)
                    .Select(f => f.TeamPlayerId)
                    .ToListAsync(ct);
                return linked.Concat(asFamily).Distinct().ToList();
            }

            private async Task<List<Row>> LoadSanctionsAsync(string teamId, IReadOnlyCollection<string>? teamPlayerIds, CancellationToken ct)
            {
                var sanctions = await db.TeamPlayerSanctions.AsNoTracking()
                    .Where(s => s.TeamPlayer.TeamId == teamId && s.Fine > 0
                                && (teamPlayerIds == null || teamPlayerIds.Contains(s.TeamPlayerId)))
                    .Select(s => new
                    {
                        s.Id, s.StartDate, s.Fine, s.AmountPaid, s.Description, s.SanctionType,
                        s.TeamPlayer.Player.Name, s.TeamPlayer.Player.LastName
                    })
                    .ToListAsync(ct);

                return sanctions.Select(s =>
                {
                    var fine = s.Fine!.Value;
                    var amountPaid = s.AmountPaid ?? 0m;
                    var paid = amountPaid >= fine;
                    return new Row($"sanction:{s.Id}", TransactionType.Sanction, FullName(s.Name, s.LastName), fine,
                        paid ? null : fine - amountPaid, s.StartDate,
                        Describe(s.Description ?? s.SanctionType, TransactionType.Sanction),
                        paid ? TransactionStatus.Paid : TransactionStatus.Pending);
                }).ToList();
            }

            private async Task<List<Row>> LoadLotteryBooksAsync(string teamId, IReadOnlyCollection<string>? teamPlayerIds, CancellationToken ct)
            {
                var books = await (
                        from book in db.LotteryBooks.AsNoTracking()
                        join campaign in db.LotteryCampaigns.AsNoTracking() on book.LotteryCampaignId equals campaign.Id
                        join teamPlayer in db.TeamPlayers.AsNoTracking() on book.TeamPlayerId equals teamPlayer.Id
                        where campaign.TeamId == teamId && (teamPlayerIds == null || teamPlayerIds.Contains(book.TeamPlayerId))
                        select new
                        {
                            book.Id, book.DeliveredOn, book.ReturnedOn, book.AmountReturned,
                            campaign.TicketPrice, campaign.TicketsPerBook, teamPlayer.Player.Name, teamPlayer.Player.LastName
                        })
                    .ToListAsync(ct);

                return books.Select(book =>
                {
                    var returned = book.AmountReturned is not null;
                    var amount = book.AmountReturned ?? book.TicketPrice * book.TicketsPerBook;
                    var date = (book.ReturnedOn ?? book.DeliveredOn).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
                    return new Row($"lottery:{book.Id}", TransactionType.Lottery, FullName(book.Name, book.LastName), amount,
                        returned ? null : amount, date, Describe(null, TransactionType.Lottery),
                        returned ? TransactionStatus.Paid : TransactionStatus.Pending);
                }).ToList();
            }

            private async Task<List<TicketSource>> LoadTicketsAsync(string teamId, string? ownUserId, CancellationToken ct) =>
                await (
                        from ticket in db.QuinielaTickets.AsNoTracking()
                        join jornada in db.QuinielaJornadas.AsNoTracking() on ticket.JornadaId equals jornada.Id
                        where jornada.TeamId == teamId && (ownUserId == null || ticket.ApplicationUserId == ownUserId)
                        select new TicketSource(ticket.Id, ticket.ApplicationUserId, jornada.Price, ticket.PaymentStatus,
                            ticket.PaidAt, jornada.RffmRoundId))
                    .ToListAsync(ct);

            private async Task<List<Row>> LoadFundMovementsAsync(string teamId, CancellationToken ct)
            {
                var movements = await db.TeamFundMovements.AsNoTracking()
                    .Where(m => m.TeamId == teamId
                                && (m.Source == TeamFundMovementSource.QuinielaFund || m.Source == TeamFundMovementSource.QuinielaDonation))
                    .Select(m => new { m.Id, m.Amount, m.OccurredAt, m.Description })
                    .ToListAsync(ct);

                return movements.Select(m => new Row($"quiniela-fund:{m.Id}", TransactionType.Quiniela, null, Math.Abs(m.Amount), null,
                    m.OccurredAt, Describe(m.Description, TransactionType.Quiniela), TransactionStatus.Paid)).ToList();
            }

            private async Task<List<WalletSource>> LoadWalletMovementsAsync(string teamId, string? ownUserId, CancellationToken ct) =>
                await (
                        from movement in db.QuinielaWalletMovements.AsNoTracking()
                        join wallet in db.QuinielaWallets.AsNoTracking() on movement.WalletId equals wallet.Id
                        where wallet.TeamId == teamId && (ownUserId == null || wallet.ApplicationUserId == ownUserId)
                              && (movement.Type == QuinielaWalletMovementType.TopUp || movement.Type == QuinielaWalletMovementType.TicketCharge)
                        select new WalletSource(movement.Id, wallet.ApplicationUserId, movement.Amount, movement.Type,
                            movement.OccurredAt, movement.Description))
                    .ToListAsync(ct);

            private async Task<Dictionary<string, DateTime?>> LoadPaymentDeadlinesAsync(IReadOnlyCollection<string> roundIds, CancellationToken ct)
            {
                if (roundIds.Count == 0)
                    return new Dictionary<string, DateTime?>();

                var rounds = await fed.RffmRounds.AsNoTracking()
                    .Include(r => r.Matches)
                    .Where(r => roundIds.Contains(r.Id))
                    .ToListAsync(ct);
                return rounds.ToDictionary(r => r.Id, r => new QuinielaRound(r, r.Matches.ToList()).PaymentDeadlineUtc);
            }

            private static Row TicketRow(TicketSource ticket, IReadOnlyDictionary<string, QuinielaSupport.Participant> participants,
                IReadOnlyDictionary<string, DateTime?> deadlines)
            {
                var paid = ticket.PaymentStatus == QuinielaPaymentStatus.Paid;
                return new Row($"quiniela:{ticket.Id}", TransactionType.Quiniela, participants[ticket.UserId].Name, ticket.Price,
                    paid ? null : ticket.Price,
                    (paid ? ticket.PaidAt : null) ?? deadlines.GetValueOrDefault(ticket.RffmRoundId),
                    Describe(null, TransactionType.Quiniela),
                    paid ? TransactionStatus.Paid : TransactionStatus.Pending);
            }

            private static Row WalletRow(WalletSource movement, IReadOnlyDictionary<string, QuinielaSupport.Participant> participants)
            {
                var topUp = movement.Type == QuinielaWalletMovementType.TopUp;
                var type = topUp ? TransactionType.WalletTopUp : TransactionType.WalletCharge;
                var prefix = topUp ? "wallet-topup" : "wallet-charge";
                return new Row($"{prefix}:{movement.Id}", type, participants[movement.UserId].Name, Math.Abs(movement.Amount), null,
                    movement.OccurredAt, Describe(movement.Description, type), TransactionStatus.Paid);
            }

            private static string FullName(string? name, string? lastName) => $"{name} {lastName}".Trim();

            private static string Describe(string? text, TransactionType type) =>
                string.IsNullOrWhiteSpace(text) ? Label(type) : text;

            private static string Label(TransactionType type) => type switch
            {
                TransactionType.Sanction => "Sanción",
                TransactionType.Lottery => "Lotería",
                TransactionType.Quiniela => "Quiniela",
                TransactionType.WalletTopUp => "Recarga del monedero",
                TransactionType.WalletCharge => "Cobro del monedero",
                _ => type.ToString()
            };
        }
    }
}
