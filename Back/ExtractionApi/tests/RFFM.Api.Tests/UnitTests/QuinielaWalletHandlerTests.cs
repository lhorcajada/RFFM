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
    }
}
