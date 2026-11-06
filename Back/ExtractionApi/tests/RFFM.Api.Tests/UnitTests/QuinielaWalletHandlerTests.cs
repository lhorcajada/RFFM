#nullable enable
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Teams;
using RFFM.Api.Features.Coaches.Quiniela;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;
using static RFFM.Api.Tests.UnitTests.QuinielaTestSupport;

namespace RFFM.Api.Tests.UnitTests
{
    /// <summary>Datos de monedero para los tests de quiniela.</summary>
    internal static class QuinielaWalletTestSupport
    {
        public static async Task<QuinielaWallet> SeedWalletAsync(PostgresContainerFixture fixture, string teamId, string userId, decimal balance)
        {
            await using var db = fixture.CreateDbContext();
            var wallet = QuinielaWallet.Create(teamId, userId);
            db.QuinielaWallets.Add(wallet);
            if (balance > 0m)
                db.QuinielaWalletMovements.Add(wallet.TopUp(balance, "seed", null, BeforeKickoff));
            await db.SaveChangesAsync();
            return wallet;
        }

        public static async Task<decimal> BalanceOfAsync(PostgresContainerFixture fixture, string teamId, string userId)
        {
            await using var db = fixture.CreateDbContext();
            var wallet = await db.QuinielaWallets.AsNoTracking().SingleOrDefaultAsync(w => w.TeamId == teamId && w.ApplicationUserId == userId);
            return wallet?.Balance ?? 0m;
        }

        public static async Task<List<QuinielaWalletMovement>> MovementsOfAsync(PostgresContainerFixture fixture, string teamId, string userId)
        {
            await using var db = fixture.CreateDbContext();
            return await db.QuinielaWalletMovements.AsNoTracking()
                .Where(m => db.QuinielaWallets.Any(w => w.Id == m.WalletId && w.TeamId == teamId && w.ApplicationUserId == userId))
                .OrderBy(m => m.OccurredAt)
                .ToListAsync();
        }
    }

    [Collection(PostgresCollection.Name)]
    public class QuinielaWalletHandlerTests(PostgresContainerFixture fixture)
    {
        private static TopUpQuinielaWallet.Handler TopUp(AppDbContext db, string? userId) => new(db, User(userId), ClockAt(BeforeKickoff));
        private static AdjustQuinielaWallet.Handler Adjust(AppDbContext db, string? userId) => new(db, User(userId), ClockAt(BeforeKickoff));
        private static DonateFromQuinielaWallet.Handler Donate(AppDbContext db, string? userId) => new(db, User(userId), ClockAt(BeforeKickoff));
        private static GetQuinielaWallet.Handler Get(AppDbContext db, string? userId) => new(db, User(userId));
        private static GetQuinielaWallets.Handler List(AppDbContext db, string? userId) => new(db, User(userId));

        // ---- Recarga ----

        [Fact]
        public async Task TopUp_ByTheCoach_CreatesTheWalletAndRecordsTheMovement()
        {
            var seed = await SeedTeamAsync(fixture);
            await using var db = fixture.CreateDbContext();

            var result = await TopUp(db, seed.CoachId).Handle(new TopUpQuinielaWallet.Command(seed.TeamId, seed.PlayerId, 5m, "Bizum"), CancellationToken.None);

            Assert.Equal(5m, result.Balance);
            Assert.Equal("TopUp", result.Movement.Type);
            Assert.Equal(5m, result.Movement.Amount);
            Assert.Equal(5m, await QuinielaWalletTestSupport.BalanceOfAsync(fixture, seed.TeamId, seed.PlayerId));
            var movements = await QuinielaWalletTestSupport.MovementsOfAsync(fixture, seed.TeamId, seed.PlayerId);
            Assert.Single(movements);
            Assert.Equal(seed.CoachId, movements[0].CreatedByUserId);
        }

        [Fact]
        public async Task TopUp_OnAnExistingWallet_AddsToTheBalance()
        {
            var seed = await SeedTeamAsync(fixture);
            await QuinielaWalletTestSupport.SeedWalletAsync(fixture, seed.TeamId, seed.PlayerId, 2m);
            await using var db = fixture.CreateDbContext();

            var result = await TopUp(db, seed.CoachId).Handle(new TopUpQuinielaWallet.Command(seed.TeamId, seed.PlayerId, 5m, null), CancellationToken.None);

            Assert.Equal(7m, result.Balance);
        }

        [Fact]
        public async Task TopUp_TheCoachCanTopUpHimself()
        {
            var seed = await SeedTeamAsync(fixture);
            await using var db = fixture.CreateDbContext();

            var result = await TopUp(db, seed.CoachId).Handle(new TopUpQuinielaWallet.Command(seed.TeamId, seed.CoachId, 3m, null), CancellationToken.None);

            Assert.Equal(3m, result.Balance);
        }

        [Fact]
        public async Task TopUp_ForAUserOutsideTheTeam_ThrowsNotFound()
        {
            var seed = await SeedTeamAsync(fixture);
            await using var db = fixture.CreateDbContext();

            var ex = await Assert.ThrowsAsync<NotFoundException>(() =>
                TopUp(db, seed.CoachId).Handle(new TopUpQuinielaWallet.Command(seed.TeamId, seed.OutsiderId, 5m, null), CancellationToken.None).AsTask());

            Assert.Equal(ErrorCodes.QuinielaWalletUserNotInTeam, ex.Code);
        }

        [Fact]
        public async Task TopUp_ForAFollower_ThrowsNotFound()
        {
            var seed = await SeedTeamAsync(fixture);
            await using var db = fixture.CreateDbContext();

            await Assert.ThrowsAsync<NotFoundException>(() =>
                TopUp(db, seed.CoachId).Handle(new TopUpQuinielaWallet.Command(seed.TeamId, seed.FollowerId, 5m, null), CancellationToken.None).AsTask());
        }

        [Theory]
        [InlineData("player")]
        [InlineData("family")]
        [InlineData("follower")]
        public async Task TopUp_ByANonCoach_ThrowsForbidden(string who)
        {
            var seed = await SeedTeamAsync(fixture);
            var userId = who switch { "player" => seed.PlayerId, "family" => seed.FamilyId, _ => seed.FollowerId };
            await using var db = fixture.CreateDbContext();

            await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
                TopUp(db, userId).Handle(new TopUpQuinielaWallet.Command(seed.TeamId, seed.PlayerId, 5m, null), CancellationToken.None).AsTask());

            Assert.Equal(0m, await QuinielaWalletTestSupport.BalanceOfAsync(fixture, seed.TeamId, seed.PlayerId));
        }

        [Theory]
        [InlineData("0")]
        [InlineData("-1")]
        [InlineData("10.01")]
        [InlineData("1.005")]
        public void TopUpValidator_RejectsInvalidAmounts(string amount)
        {
            var result = new TopUpQuinielaWallet.Validator().Validate(
                new TopUpQuinielaWallet.Command("t", "u", decimal.Parse(amount, System.Globalization.CultureInfo.InvariantCulture), null));

            Assert.False(result.IsValid);
        }

        [Fact]
        public void TopUpValidator_AcceptsTheMaximum()
        {
            var result = new TopUpQuinielaWallet.Validator().Validate(new TopUpQuinielaWallet.Command("t", "u", 10m, null));

            Assert.True(result.IsValid);
        }

        // ---- Ajuste ----

        [Fact]
        public async Task Adjust_WithinTheBalance_SubtractsAndRecordsTheReason()
        {
            var seed = await SeedTeamAsync(fixture);
            await QuinielaWalletTestSupport.SeedWalletAsync(fixture, seed.TeamId, seed.PlayerId, 5m);
            await using var db = fixture.CreateDbContext();

            var result = await Adjust(db, seed.CoachId).Handle(new AdjustQuinielaWallet.Command(seed.TeamId, seed.PlayerId, 3m, "Error de recarga"), CancellationToken.None);

            Assert.Equal(2m, result.Balance);
            Assert.Equal("Adjustment", result.Movement.Type);
            Assert.Equal(-3m, result.Movement.Amount);
            Assert.Equal("Error de recarga", result.Movement.Description);
        }

        [Fact]
        public async Task Adjust_AboveTheBalance_ThrowsConflictAndKeepsTheBalance()
        {
            var seed = await SeedTeamAsync(fixture);
            await QuinielaWalletTestSupport.SeedWalletAsync(fixture, seed.TeamId, seed.PlayerId, 5m);
            await using var db = fixture.CreateDbContext();

            var ex = await Assert.ThrowsAsync<ConflictException>(() =>
                Adjust(db, seed.CoachId).Handle(new AdjustQuinielaWallet.Command(seed.TeamId, seed.PlayerId, 6m, "motivo"), CancellationToken.None).AsTask());

            Assert.Equal(ErrorCodes.QuinielaWalletInsufficientBalance, ex.Code);
            Assert.Equal(5m, await QuinielaWalletTestSupport.BalanceOfAsync(fixture, seed.TeamId, seed.PlayerId));
        }

        [Fact]
        public async Task Adjust_WithoutAWallet_ThrowsConflict()
        {
            var seed = await SeedTeamAsync(fixture);
            await using var db = fixture.CreateDbContext();

            var ex = await Assert.ThrowsAsync<ConflictException>(() =>
                Adjust(db, seed.CoachId).Handle(new AdjustQuinielaWallet.Command(seed.TeamId, seed.PlayerId, 1m, "motivo"), CancellationToken.None).AsTask());

            Assert.Equal(ErrorCodes.QuinielaWalletInsufficientBalance, ex.Code);
        }

        [Fact]
        public async Task Adjust_ByAPlayer_ThrowsForbidden()
        {
            var seed = await SeedTeamAsync(fixture);
            await QuinielaWalletTestSupport.SeedWalletAsync(fixture, seed.TeamId, seed.PlayerId, 5m);
            await using var db = fixture.CreateDbContext();

            await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
                Adjust(db, seed.PlayerId).Handle(new AdjustQuinielaWallet.Command(seed.TeamId, seed.PlayerId, 1m, "motivo"), CancellationToken.None).AsTask());
        }

        [Fact]
        public void AdjustValidator_RequiresAReasonAndAValidAmount()
        {
            var validator = new AdjustQuinielaWallet.Validator();

            Assert.False(validator.Validate(new AdjustQuinielaWallet.Command("t", "u", 1m, "")).IsValid);
            Assert.False(validator.Validate(new AdjustQuinielaWallet.Command("t", "u", 0m, "motivo")).IsValid);
            Assert.False(validator.Validate(new AdjustQuinielaWallet.Command("t", "u", 10.01m, "motivo")).IsValid);
            Assert.True(validator.Validate(new AdjustQuinielaWallet.Command("t", "u", 10m, "motivo")).IsValid);
        }

        // ---- Consulta propia ----

        [Fact]
        public async Task Get_OwnWalletWithoutMovements_ReturnsZeroAndEmptyHistory()
        {
            var seed = await SeedTeamAsync(fixture);
            await using var db = fixture.CreateDbContext();

            var dto = await Get(db, seed.PlayerId).Handle(new GetQuinielaWallet.Query(seed.TeamId, null, 25, 0), CancellationToken.None);

            Assert.Equal(0m, dto.Balance);
            Assert.Empty(dto.Movements);
            Assert.Equal(seed.PlayerId, dto.UserId);
        }

        [Fact]
        public async Task Get_WalletsArePerTeam()
        {
            var seed = await SeedTeamAsync(fixture);
            var other = await SeedTeamAsync(fixture);
            await QuinielaWalletTestSupport.SeedWalletAsync(fixture, seed.TeamId, seed.PlayerId, 4m);
            await using var db = fixture.CreateDbContext();
            await using var otherDb = fixture.CreateDbContext();
            otherDb.UserTeams.Add(new RFFM.Api.Domain.Aggregates.UserClubs.UserTeam(seed.PlayerId, other.TeamId, Membership.Player.Id));
            await otherDb.SaveChangesAsync();

            var inOther = await Get(otherDb, seed.PlayerId).Handle(new GetQuinielaWallet.Query(other.TeamId, null, 25, 0), CancellationToken.None);
            var inFirst = await Get(db, seed.PlayerId).Handle(new GetQuinielaWallet.Query(seed.TeamId, null, 25, 0), CancellationToken.None);

            Assert.Equal(0m, inOther.Balance);
            Assert.Equal(4m, inFirst.Balance);
        }

        [Fact]
        public async Task Get_ReturnsMovementsNewestFirstAndPaginated()
        {
            var seed = await SeedTeamAsync(fixture);
            await using (var setup = fixture.CreateDbContext())
            {
                var wallet = QuinielaWallet.Create(seed.TeamId, seed.PlayerId);
                setup.QuinielaWallets.Add(wallet);
                for (var i = 1; i <= 5; i++)
                    setup.QuinielaWalletMovements.Add(wallet.TopUp(i, "coach", $"m{i}", BeforeKickoff.AddMinutes(i)));
                await setup.SaveChangesAsync();
            }
            await using var db = fixture.CreateDbContext();

            var page1 = await Get(db, seed.PlayerId).Handle(new GetQuinielaWallet.Query(seed.TeamId, null, 2, 0), CancellationToken.None);
            var page2 = await Get(db, seed.PlayerId).Handle(new GetQuinielaWallet.Query(seed.TeamId, null, 2, 2), CancellationToken.None);

            Assert.Equal(15m, page1.Balance);
            Assert.Equal(5, page1.TotalMovements);
            Assert.Equal(["m5", "m4"], page1.Movements.Select(m => m.Description).ToArray());
            Assert.Equal(["m3", "m2"], page2.Movements.Select(m => m.Description).ToArray());
        }

        [Fact]
        public async Task Get_CapsTheLimitAt100()
        {
            var seed = await SeedTeamAsync(fixture);
            await using var db = fixture.CreateDbContext();

            var dto = await Get(db, seed.PlayerId).Handle(new GetQuinielaWallet.Query(seed.TeamId, null, 5000, 0), CancellationToken.None);

            Assert.Empty(dto.Movements);
        }

        [Fact]
        public async Task Get_ByAFollower_ThrowsForbidden()
        {
            var seed = await SeedTeamAsync(fixture);
            await using var db = fixture.CreateDbContext();

            await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
                Get(db, seed.FollowerId).Handle(new GetQuinielaWallet.Query(seed.TeamId, null, 25, 0), CancellationToken.None).AsTask());
        }

        // ---- Consulta de otro usuario (entrenador) ----

        [Fact]
        public async Task Get_AnotherUsersWallet_ByTheCoach_ReturnsIt()
        {
            var seed = await SeedTeamAsync(fixture);
            await QuinielaWalletTestSupport.SeedWalletAsync(fixture, seed.TeamId, seed.PlayerId, 4m);
            await using var db = fixture.CreateDbContext();

            var dto = await Get(db, seed.CoachId).Handle(new GetQuinielaWallet.Query(seed.TeamId, seed.PlayerId, 25, 0), CancellationToken.None);

            Assert.Equal(4m, dto.Balance);
            Assert.Equal(seed.PlayerId, dto.UserId);
        }

        [Fact]
        public async Task Get_AnotherUsersWallet_ByAPlayer_ThrowsForbidden()
        {
            var seed = await SeedTeamAsync(fixture);
            await using var db = fixture.CreateDbContext();

            await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
                Get(db, seed.PlayerId).Handle(new GetQuinielaWallet.Query(seed.TeamId, seed.FamilyId, 25, 0), CancellationToken.None).AsTask());
        }

        // ---- Listado del equipo ----

        [Fact]
        public async Task List_ByTheCoach_ReturnsEveryParticipantWithZeroForThoseWithoutWallet()
        {
            var seed = await SeedTeamAsync(fixture);
            await QuinielaWalletTestSupport.SeedWalletAsync(fixture, seed.TeamId, seed.PlayerId, 4m);
            await using var db = fixture.CreateDbContext();

            var rows = await List(db, seed.CoachId).Handle(new GetQuinielaWallets.Query(seed.TeamId), CancellationToken.None);

            Assert.Equal(3, rows.Count);
            Assert.Equal(4m, rows.Single(r => r.UserId == seed.PlayerId).Balance);
            Assert.Equal(0m, rows.Single(r => r.UserId == seed.FamilyId).Balance);
            Assert.Contains(rows, r => r.UserId == seed.CoachId);
            Assert.DoesNotContain(rows, r => r.UserId == seed.FollowerId);
        }

        [Fact]
        public async Task List_ByAFamilyMember_ThrowsForbidden()
        {
            var seed = await SeedTeamAsync(fixture);
            await using var db = fixture.CreateDbContext();

            await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
                List(db, seed.FamilyId).Handle(new GetQuinielaWallets.Query(seed.TeamId), CancellationToken.None).AsTask());
        }

        // ---- Jugadores asociados en el listado ----

        private static QuinielaWalletSummaryDto RowOf(IReadOnlyList<QuinielaWalletSummaryDto> rows, string userId) =>
            rows.Single(r => r.UserId == userId);

        private static string[] NamesOf(QuinielaWalletSummaryDto row) =>
            row.AssociatedPlayers.Select(p => p.Name).ToArray();

        [Fact]
        public async Task List_FamilyMemberLinkedToSeveralPlayers_ListsAllOfThemInNameOrder()
        {
            var seed = await SeedTeamAsync(fixture);
            await using (var setup = fixture.CreateDbContext())
            {
                var beto = await SeedTeamPlayerAsync(setup, seed, "Beto", "Lopez");
                var ana = await SeedTeamPlayerAsync(setup, seed, "Ana", "Lopez");
                await LinkFamilyAsync(setup, seed.FamilyId, beto);
                await LinkFamilyAsync(setup, seed.FamilyId, ana);
            }
            await using var db = fixture.CreateDbContext();

            var rows = await List(db, seed.CoachId).Handle(new GetQuinielaWallets.Query(seed.TeamId), CancellationToken.None);

            Assert.Equal(new[] { "Ana Lopez", "Beto Lopez" }, NamesOf(RowOf(rows, seed.FamilyId)));
        }

        [Fact]
        public async Task List_FamilyMemberLinkedToPlayersOfOtherTeams_ListsOnlyThePlayerOfTheRequestedTeam()
        {
            var seed = await SeedTeamAsync(fixture);
            var other = await SeedTeamAsync(fixture);
            await using (var setup = fixture.CreateDbContext())
            {
                var ana = await SeedTeamPlayerAsync(setup, seed, "Ana", "Lopez");
                var cleo = await SeedTeamPlayerAsync(setup, other, "Cleo", "Ruiz");
                await LinkFamilyAsync(setup, seed.FamilyId, ana);
                await LinkFamilyAsync(setup, seed.FamilyId, cleo);
            }
            await using var db = fixture.CreateDbContext();

            var rows = await List(db, seed.CoachId).Handle(new GetQuinielaWallets.Query(seed.TeamId), CancellationToken.None);

            Assert.Equal(new[] { "Ana Lopez" }, NamesOf(RowOf(rows, seed.FamilyId)));
        }

        [Fact]
        public async Task List_FamilyMemberWithoutLinkedPlayers_HasAnEmptyList()
        {
            var seed = await SeedTeamAsync(fixture);
            await using var db = fixture.CreateDbContext();

            var rows = await List(db, seed.CoachId).Handle(new GetQuinielaWallets.Query(seed.TeamId), CancellationToken.None);

            Assert.Empty(RowOf(rows, seed.FamilyId).AssociatedPlayers);
        }

        [Fact]
        public async Task List_FamilyMemberWithoutWallet_ShowsZeroBalanceAndItsPlayers()
        {
            var seed = await SeedTeamAsync(fixture);
            await using (var setup = fixture.CreateDbContext())
            {
                var ana = await SeedTeamPlayerAsync(setup, seed, "Ana", "Lopez");
                await LinkFamilyAsync(setup, seed.FamilyId, ana);
            }
            await using var db = fixture.CreateDbContext();

            var rows = await List(db, seed.CoachId).Handle(new GetQuinielaWallets.Query(seed.TeamId), CancellationToken.None);

            var family = RowOf(rows, seed.FamilyId);
            Assert.Equal(0.00m, family.Balance);
            Assert.Equal(new[] { "Ana Lopez" }, NamesOf(family));
        }

        [Fact]
        public async Task List_PlayerRowLinkedToAPlayer_ListsItsOwnPlayerWithTheTeamPlayerId()
        {
            var seed = await SeedTeamAsync(fixture);
            Guid ana;
            await using (var setup = fixture.CreateDbContext())
            {
                ana = await SeedTeamPlayerAsync(setup, seed, "Ana", "Lopez");
                await LinkPlayerUserAsync(setup, seed, seed.PlayerId, ana);
            }
            await using var db = fixture.CreateDbContext();

            var rows = await List(db, seed.CoachId).Handle(new GetQuinielaWallets.Query(seed.TeamId), CancellationToken.None);

            var players = RowOf(rows, seed.PlayerId).AssociatedPlayers.Select(p => (p.Id, p.Name)).ToArray();
            Assert.Equal(new[] { (ana, "Ana Lopez") }, players);
        }

        [Fact]
        public async Task List_PlayerUserWithoutLinkedPlayerRecord_HasAnEmptyList()
        {
            var seed = await SeedTeamAsync(fixture);
            await using var db = fixture.CreateDbContext();

            var rows = await List(db, seed.CoachId).Handle(new GetQuinielaWallets.Query(seed.TeamId), CancellationToken.None);

            Assert.Empty(RowOf(rows, seed.PlayerId).AssociatedPlayers);
        }

        [Fact]
        public async Task List_CoachWhoIsAlsoAFamilyMember_ShowsNoPlayersOnTheCoachRow()
        {
            var seed = await SeedTeamAsync(fixture);
            await using (var setup = fixture.CreateDbContext())
            {
                var ana = await SeedTeamPlayerAsync(setup, seed, "Ana", "Lopez");
                await LinkFamilyAsync(setup, seed.CoachId, ana);
            }
            await using var db = fixture.CreateDbContext();

            var rows = await List(db, seed.CoachId).Handle(new GetQuinielaWallets.Query(seed.TeamId), CancellationToken.None);

            Assert.Empty(RowOf(rows, seed.CoachId).AssociatedPlayers);
        }

        [Fact]
        public async Task List_UserWithCoachAndFamilyRoles_ShowsTheCoachRoleWithNoPlayers()
        {
            var seed = await SeedTeamAsync(fixture);
            await using (var setup = fixture.CreateDbContext())
            {
                var ana = await SeedTeamPlayerAsync(setup, seed, "Ana", "Lopez");
                await LinkFamilyAsync(setup, seed.FamilyId, ana);
                setup.UserTeams.Add(new UserTeam(seed.FamilyId, seed.TeamId, Membership.Coach.Id));
                await setup.SaveChangesAsync();
            }
            await using var db = fixture.CreateDbContext();

            var rows = await List(db, seed.CoachId).Handle(new GetQuinielaWallets.Query(seed.TeamId), CancellationToken.None);

            var row = RowOf(rows, seed.FamilyId);
            Assert.Equal(Membership.Coach.Key, row.Role);
            Assert.Empty(row.AssociatedPlayers);
        }

        [Fact]
        public async Task List_PlayerRowLinkedToATeamPlayerOfAnotherTeam_HasAnEmptyList()
        {
            var seed = await SeedTeamAsync(fixture);
            var otherSeed = await SeedTeamAsync(fixture);
            await using (var setup = fixture.CreateDbContext())
            {
                var foreign = await SeedTeamPlayerAsync(setup, otherSeed, "Eva", "Ruiz");
                await LinkPlayerUserAsync(setup, seed, seed.PlayerId, foreign);
            }
            await using var db = fixture.CreateDbContext();

            var rows = await List(db, seed.CoachId).Handle(new GetQuinielaWallets.Query(seed.TeamId), CancellationToken.None);

            Assert.Empty(RowOf(rows, seed.PlayerId).AssociatedPlayers);
        }

        [Fact]
        public async Task List_PlayerRowAlsoLinkedAsFamilyMember_ListsOnlyItsOwnPlayer()
        {
            var seed = await SeedTeamAsync(fixture);
            Guid ana;
            await using (var setup = fixture.CreateDbContext())
            {
                ana = await SeedTeamPlayerAsync(setup, seed, "Ana", "Lopez");
                var bea = await SeedTeamPlayerAsync(setup, seed, "Bea", "Sanz");
                await LinkPlayerUserAsync(setup, seed, seed.PlayerId, ana);
                await LinkFamilyAsync(setup, seed.PlayerId, bea);
            }
            await using var db = fixture.CreateDbContext();

            var rows = await List(db, seed.CoachId).Handle(new GetQuinielaWallets.Query(seed.TeamId), CancellationToken.None);

            Assert.Equal(new[] { ana }, RowOf(rows, seed.PlayerId).AssociatedPlayers.Select(p => p.Id).ToArray());
        }

        private async Task<(QuinielaSeed Seed, Guid Active, Guid Departed)> SeedFamilyWithADepartedPlayerAsync()
        {
            var seed = await SeedTeamAsync(fixture);
            await using var setup = fixture.CreateDbContext();
            var active = await SeedTeamPlayerAsync(setup, seed, "Ana", "Lopez");
            var departed = await SeedTeamPlayerAsync(setup, seed, "Bea", "Sanz");
            await LinkFamilyAsync(setup, seed.FamilyId, active);
            await LinkFamilyAsync(setup, seed.FamilyId, departed);
            await MarkTeamPlayerLeftAsync(setup, departed);
            return (seed, active, departed);
        }

        private async Task<string[]> FamilyPlayerNamesAsync(QuinielaSeed seed)
        {
            await using var db = fixture.CreateDbContext();
            var rows = await List(db, seed.CoachId).Handle(new GetQuinielaWallets.Query(seed.TeamId), CancellationToken.None);
            return NamesOf(RowOf(rows, seed.FamilyId));
        }

        [Fact]
        public async Task List_DepartedPlayerWithNothingPending_IsNotListed()
        {
            var (seed, _, _) = await SeedFamilyWithADepartedPlayerAsync();
            await QuinielaWalletTestSupport.SeedWalletAsync(fixture, seed.TeamId, seed.FamilyId, 0m);

            Assert.Equal(new[] { "Ana Lopez" }, await FamilyPlayerNamesAsync(seed));
        }

        [Fact]
        public async Task List_DepartedPlayerWhenTheUserHasBalance_IsStillListed()
        {
            var (seed, _, _) = await SeedFamilyWithADepartedPlayerAsync();
            await QuinielaWalletTestSupport.SeedWalletAsync(fixture, seed.TeamId, seed.FamilyId, 5m);

            Assert.Equal(new[] { "Ana Lopez", "Bea Sanz" }, await FamilyPlayerNamesAsync(seed));
        }

        [Fact]
        public async Task List_DepartedPlayerWhenTheUserHasAnUnpaidTicket_IsStillListed()
        {
            var (seed, _, _) = await SeedFamilyWithADepartedPlayerAsync();
            var roundId = await SeedRoundAsync(fixture, seed.GroupCode, 1, StandardMatches("p"));
            var jornada = await SeedJornadaAsync(fixture, seed.TeamId, roundId);
            await SeedTicketAsync(fixture, jornada.Id, seed.FamilyId, "p", QuinielaSign.Home, QuinielaSign.Home, QuinielaSign.Home);

            Assert.Equal(new[] { "Ana Lopez", "Bea Sanz" }, await FamilyPlayerNamesAsync(seed));
        }

        [Fact]
        public async Task List_DepartedPlayerWhenTheUserOnlyHasPaidTickets_IsNotListed()
        {
            var (seed, _, _) = await SeedFamilyWithADepartedPlayerAsync();
            var roundId = await SeedRoundAsync(fixture, seed.GroupCode, 1, StandardMatches("q"));
            var jornada = await SeedJornadaAsync(fixture, seed.TeamId, roundId);
            await SeedTicketAsync(fixture, jornada.Id, seed.FamilyId, "q", QuinielaSign.Home, QuinielaSign.Home, QuinielaSign.Home, paid: true);

            Assert.Equal(new[] { "Ana Lopez" }, await FamilyPlayerNamesAsync(seed));
        }

        [Fact]
        public async Task List_PlayerWithEmptyLastName_HasNoTrailingSpaceInItsName()
        {
            var seed = await SeedTeamAsync(fixture);
            await using (var setup = fixture.CreateDbContext())
            {
                var solo = await SeedTeamPlayerAsync(setup, seed, "Solo", "");
                await LinkFamilyAsync(setup, seed.FamilyId, solo);
            }
            await using var db = fixture.CreateDbContext();

            var rows = await List(db, seed.CoachId).Handle(new GetQuinielaWallets.Query(seed.TeamId), CancellationToken.None);

            Assert.Equal(new[] { "Solo" }, NamesOf(RowOf(rows, seed.FamilyId)));
        }

        [Fact]
        public async Task List_AddingAssociatedPlayers_KeepsTheRowsAndTheBalances()
        {
            var seed = await SeedTeamAsync(fixture);
            await QuinielaWalletTestSupport.SeedWalletAsync(fixture, seed.TeamId, seed.PlayerId, 4m);
            await using (var setup = fixture.CreateDbContext())
            {
                var ana = await SeedTeamPlayerAsync(setup, seed, "Ana", "Lopez");
                await LinkFamilyAsync(setup, seed.FamilyId, ana);
            }
            await using var db = fixture.CreateDbContext();

            var rows = await List(db, seed.CoachId).Handle(new GetQuinielaWallets.Query(seed.TeamId), CancellationToken.None);

            Assert.Equal(3, rows.Count);
            Assert.Equal(4m, RowOf(rows, seed.PlayerId).Balance);
            Assert.Equal(0m, RowOf(rows, seed.FamilyId).Balance);
            Assert.Equal(0m, RowOf(rows, seed.CoachId).Balance);
        }

        // ---- Donación al equipo ----

        private async Task<List<TeamFundMovement>> DonationsToTheFundAsync(string teamId)
        {
            await using var db = fixture.CreateDbContext();
            return await db.TeamFundMovements.AsNoTracking()
                .Where(m => m.TeamId == teamId && m.Source == TeamFundMovementSource.QuinielaDonation)
                .ToListAsync();
        }

        [Fact]
        public async Task Donate_ByAPlayer_MovesTheMoneyFromTheWalletToTheTeamFund()
        {
            var seed = await SeedTeamAsync(fixture);
            await QuinielaWalletTestSupport.SeedWalletAsync(fixture, seed.TeamId, seed.PlayerId, 8m);
            await using var db = fixture.CreateDbContext();

            var result = await Donate(db, seed.PlayerId).Handle(new DonateFromQuinielaWallet.Command(seed.TeamId, 3.5m), CancellationToken.None);

            Assert.Equal(4.5m, result.Balance);
            Assert.Equal("Donation", result.Movement.Type);
            Assert.Equal(-3.5m, result.Movement.Amount);
            Assert.Equal(4.5m, await QuinielaWalletTestSupport.BalanceOfAsync(fixture, seed.TeamId, seed.PlayerId));
            var donations = await DonationsToTheFundAsync(seed.TeamId);
            Assert.Single(donations);
            Assert.Equal(3.5m, donations[0].Amount);
        }

        [Fact]
        public async Task Donate_TheCoachCanDonateToo()
        {
            var seed = await SeedTeamAsync(fixture);
            await QuinielaWalletTestSupport.SeedWalletAsync(fixture, seed.TeamId, seed.CoachId, 5m);
            await using var db = fixture.CreateDbContext();

            var result = await Donate(db, seed.CoachId).Handle(new DonateFromQuinielaWallet.Command(seed.TeamId, 5m), CancellationToken.None);

            Assert.Equal(0m, result.Balance);
            Assert.Single(await DonationsToTheFundAsync(seed.TeamId));
        }

        [Fact]
        public async Task Donate_MoreThanTenEuros_IsAllowedWhileTheBalanceCoversIt()
        {
            var seed = await SeedTeamAsync(fixture);
            await QuinielaWalletTestSupport.SeedWalletAsync(fixture, seed.TeamId, seed.FamilyId, 10m);
            await using var db = fixture.CreateDbContext();
            await Adjust(db, seed.CoachId).Handle(new AdjustQuinielaWallet.Command(seed.TeamId, seed.FamilyId, 1m, "x"), CancellationToken.None);
            await using var db2 = fixture.CreateDbContext();
            await TopUp(db2, seed.CoachId).Handle(new TopUpQuinielaWallet.Command(seed.TeamId, seed.FamilyId, 10m, null), CancellationToken.None);
            await using var db3 = fixture.CreateDbContext();

            var result = await Donate(db3, seed.FamilyId).Handle(new DonateFromQuinielaWallet.Command(seed.TeamId, 19m), CancellationToken.None);

            Assert.Equal(0m, result.Balance);
        }

        [Fact]
        public async Task Donate_MoreThanTheBalance_ThrowsConflictAndChangesNothing()
        {
            var seed = await SeedTeamAsync(fixture);
            await QuinielaWalletTestSupport.SeedWalletAsync(fixture, seed.TeamId, seed.PlayerId, 2m);
            await using var db = fixture.CreateDbContext();

            var ex = await Assert.ThrowsAsync<ConflictException>(() =>
                Donate(db, seed.PlayerId).Handle(new DonateFromQuinielaWallet.Command(seed.TeamId, 2.01m), CancellationToken.None).AsTask());

            Assert.Equal(ErrorCodes.QuinielaWalletInsufficientBalance, ex.Code);
            Assert.Equal(2m, await QuinielaWalletTestSupport.BalanceOfAsync(fixture, seed.TeamId, seed.PlayerId));
            Assert.Empty(await DonationsToTheFundAsync(seed.TeamId));
        }

        [Fact]
        public async Task Donate_WithoutWallet_ThrowsConflict()
        {
            var seed = await SeedTeamAsync(fixture);
            await using var db = fixture.CreateDbContext();

            await Assert.ThrowsAsync<ConflictException>(() =>
                Donate(db, seed.PlayerId).Handle(new DonateFromQuinielaWallet.Command(seed.TeamId, 1m), CancellationToken.None).AsTask());
        }

        [Fact]
        public async Task Donate_ByAFollowerOfTheTeam_ThrowsForbidden()
        {
            var seed = await SeedTeamAsync(fixture);
            await using var db = fixture.CreateDbContext();

            await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
                Donate(db, seed.FollowerId).Handle(new DonateFromQuinielaWallet.Command(seed.TeamId, 1m), CancellationToken.None).AsTask());
        }

        [Theory]
        [InlineData(0)]
        [InlineData(-1)]
        [InlineData(1.005)]
        public void DonateValidator_RejectsNonPositiveOrMoreThanTwoDecimals(double amount)
        {
            var result = new DonateFromQuinielaWallet.Validator().Validate(new DonateFromQuinielaWallet.Command("team", (decimal)amount));

            Assert.False(result.IsValid);
        }

        [Fact]
        public void DonateValidator_AcceptsAnAmountWithoutUpperCap()
        {
            var result = new DonateFromQuinielaWallet.Validator().Validate(new DonateFromQuinielaWallet.Command("team", 250.50m));

            Assert.True(result.IsValid);
        }
    }
}
