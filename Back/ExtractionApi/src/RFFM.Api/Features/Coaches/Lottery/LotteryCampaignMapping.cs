using FluentValidation;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Entities.Teams;
using RFFM.Api.Domain.Services;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Lottery
{
    public record LotteryCampaignSummaryDto(string Id, string Name, DateOnly DrawDate);

    public record LotteryBookDto(
        string Id, string? TeamPlayerId, int BookNumber, int FirstTicketNumber, int LastTicketNumber, string Status,
        DateOnly? DeliveredOn, DateOnly? ReturnedOn, decimal? AmountReturned, DateOnly? ClubDeliveredOn,
        int? TicketsSold, int? TicketsUnsold);

    public record LotteryTotalsDto(
        int BooksDelivered, int BooksReturned, int BooksPending,
        int TicketsDelivered, int TicketsSold, int TicketsUnsold, int TicketsPending,
        decimal AmountCollected, decimal AmountPending);

    /// <summary>Resumen de la entrega al club calculado con los tacos devueltos al entrenador.</summary>
    public record LotteryClubDeliveryDto(
        int BooksDelivered, int BooksPending, decimal AmountDelivered, decimal AmountPending, DateOnly? LastDeliveredOn);

    public record LotteryCampaignDto(
        string Id, string TeamId, string Name, DateOnly DrawDate, decimal TicketPrice, int TicketsPerBook,
        DateOnly ClubDeliveryFrom, DateOnly ClubDeliveryTo, LotteryClubDeliveryDto ClubDelivery,
        LotteryTotalsDto Totals, IReadOnlyList<LotteryBookDto> Books, bool CanEdit);

    internal static class LotteryConstants
    {
        public const string Tag = "Lottery";
        public const string BaseRoute = "/api/teams/{teamId}/lottery-campaigns";
        public const string Read = "Read";
        public const string ReadWrite = "ReadWrite";
    }

    /// <summary>
    /// Carga, comprobaciones y mapeo compartidos por los endpoints de lotería.
    /// See openspec/changes/team-lottery/design.md → D3.
    /// </summary>
    internal static class LotteryCampaignMapping
    {
        private static readonly string[] EditorRoles =
        {
            AppRoles.Administrator.Name, AppRoles.Coach.Name, AppRoles.ClubDirector.Name, AppRoles.Federation.Name
        };

        public static DateOnly Today() => DateOnly.FromDateTime(DateTime.UtcNow);

        public static async Task<LotteryCampaign> LoadAsync(AppDbContext db, string teamId, string campaignId, CancellationToken ct, bool tracking = true)
        {
            var query = db.LotteryCampaigns.Include(c => c.Books).AsQueryable();
            if (!tracking)
                query = query.AsNoTracking();

            return await query.SingleOrDefaultAsync(c => c.Id == campaignId && c.TeamId == teamId, ct)
                ?? throw new NotFoundException($"LotteryCampaign '{campaignId}' Not Found", ErrorCodes.LotteryCampaignNotFound);
        }

        public static async Task EnsurePlayerInTeamAsync(AppDbContext db, string teamId, string teamPlayerId, CancellationToken ct)
        {
            var belongs = await db.TeamPlayers.AsNoTracking().AnyAsync(tp => tp.Id == teamPlayerId && tp.TeamId == teamId, ct);
            if (!belongs)
                throw new NotFoundException($"TeamPlayer '{teamPlayerId}' Not Found", ErrorCodes.TeamPlayerNotFound);
        }

        /// <summary>Player y FamilyMember solo ven los tacos de su jugador vinculado y no pueden editar.</summary>
        public static async Task<LotteryCampaignDto> ToDtoAsync(
            AppDbContext db, ICurrentUserService currentUser, LotteryCampaign campaign, CancellationToken ct)
        {
            var canEdit = (currentUser.Roles ?? Enumerable.Empty<string>())
                .Any(r => EditorRoles.Contains(r, StringComparer.OrdinalIgnoreCase));
            if (canEdit)
                return ToDto(campaign, campaign.Books, canEdit: true);

            var linkedTeamPlayerIds = await db.Set<UserTeam>()
                .AsNoTracking()
                .Where(ut => ut.ApplicationUserId == currentUser.UserId && ut.TeamId == campaign.TeamId && ut.LinkedTeamPlayerId != null)
                .Select(ut => ut.LinkedTeamPlayerId!)
                .ToListAsync(ct);

            var ownBooks = campaign.Books
                .Where(b => b.TeamPlayerId is not null && linkedTeamPlayerIds.Contains(b.TeamPlayerId))
                .ToList();
            return ToDto(campaign, ownBooks, canEdit: false);
        }

        private static LotteryCampaignDto ToDto(LotteryCampaign campaign, IEnumerable<LotteryBook> visibleBooks, bool canEdit)
        {
            var books = visibleBooks.OrderBy(b => b.BookNumber).ToList();
            var delivered = books.Where(b => b.HasBeenDeliveredToPlayer).ToList();
            var returned = books.Where(b => b.HasBeenReturned).ToList();
            var pending = delivered.Where(b => !b.HasBeenReturned).ToList();
            var ticketsSold = returned.Sum(b => campaign.TicketsSold(b) ?? 0);

            var totals = new LotteryTotalsDto(
                BooksDelivered: delivered.Count,
                BooksReturned: returned.Count,
                BooksPending: pending.Count,
                TicketsDelivered: delivered.Sum(b => b.TicketCount),
                TicketsSold: ticketsSold,
                TicketsUnsold: returned.Sum(b => b.TicketCount) - ticketsSold,
                TicketsPending: pending.Sum(b => b.TicketCount),
                AmountCollected: returned.Sum(b => b.AmountReturned ?? 0m),
                AmountPending: pending.Sum(b => b.TicketCount) * campaign.TicketPrice);

            return new LotteryCampaignDto(
                campaign.Id, campaign.TeamId, campaign.Name, campaign.DrawDate, campaign.TicketPrice, campaign.TicketsPerBook,
                campaign.ClubDeliveryFrom, campaign.ClubDeliveryTo, ToClubDeliveryDto(returned),
                totals,
                books.Select(b => new LotteryBookDto(
                        b.Id, b.TeamPlayerId, b.BookNumber, b.FirstTicketNumber, b.LastTicketNumber, b.Status.ToString(),
                        b.DeliveredOn, b.ReturnedOn, b.AmountReturned, b.ClubDeliveredOn,
                        campaign.TicketsSold(b), campaign.TicketsUnsold(b)))
                    .ToList(),
                canEdit);
        }

        private static LotteryClubDeliveryDto ToClubDeliveryDto(IReadOnlyCollection<LotteryBook> returnedBooks)
        {
            var toClub = returnedBooks.Where(b => b.Status == LotteryBookStatus.DeliveredToClub).ToList();
            var awaitingClub = returnedBooks.Where(b => b.Status == LotteryBookStatus.ReturnedToCoach).ToList();
            return new LotteryClubDeliveryDto(
                BooksDelivered: toClub.Count,
                BooksPending: awaitingClub.Count,
                AmountDelivered: toClub.Sum(b => b.AmountReturned ?? 0m),
                AmountPending: awaitingClub.Sum(b => b.AmountReturned ?? 0m),
                LastDeliveredOn: toClub.Max(b => b.ClubDeliveredOn));
        }
    }

    public static class LotteryServiceCollectionExtensions
    {
        /// <summary>Registro explícito de validadores: el proyecto no escanea el ensamblado.</summary>
        public static IServiceCollection AddLotteryValidators(this IServiceCollection services)
        {
            services.AddScoped<IValidator<CreateLotteryCampaign.Command>, CreateLotteryCampaign.Validator>();
            services.AddScoped<IValidator<UpdateLotteryCampaign.Command>, UpdateLotteryCampaign.Validator>();
            services.AddScoped<IValidator<CreateLotteryBooks.Command>, CreateLotteryBooks.Validator>();
            services.AddScoped<IValidator<AssignLotteryBook.Command>, AssignLotteryBook.Validator>();
            services.AddScoped<IValidator<UpdateLotteryBook.Command>, UpdateLotteryBook.Validator>();
            services.AddScoped<IValidator<AdvanceLotteryBookStatus.Command>, AdvanceLotteryBookStatus.Validator>();
            return services;
        }
    }
}
