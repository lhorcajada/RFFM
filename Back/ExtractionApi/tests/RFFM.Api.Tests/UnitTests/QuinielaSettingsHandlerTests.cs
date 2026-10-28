#nullable enable
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities.Teams;
using RFFM.Api.Features.Coaches.Quiniela;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;
using static RFFM.Api.Tests.UnitTests.QuinielaTestSupport;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class QuinielaSettingsHandlerTests(PostgresContainerFixture fixture)
    {
        private static GetQuinielaSettings.Handler GetHandler(AppDbContext db, string? userId) => new(db, User(userId));

        private static UpdateQuinielaSettings.Handler UpdateHandler(AppDbContext db, string? userId) => new(db, User(userId));

        [Fact]
        public async Task Get_WithoutSavedSettings_DefaultsToZeroFundPercent()
        {
            var seed = await SeedTeamAsync(fixture);
            await using var db = fixture.CreateDbContext();

            var dto = await GetHandler(db, seed.CoachId).Handle(new GetQuinielaSettings.Query(seed.TeamId), CancellationToken.None);

            Assert.Equal(0m, dto.FundPercent);
        }

        [Fact]
        public async Task Update_StoresTheFundPercent_AndGetReturnsIt()
        {
            var seed = await SeedTeamAsync(fixture);
            await using (var db = fixture.CreateDbContext())
                await UpdateHandler(db, seed.CoachId).Handle(new UpdateQuinielaSettings.Command(seed.TeamId, 20m), CancellationToken.None);

            await using var verify = fixture.CreateDbContext();
            var dto = await GetHandler(verify, seed.CoachId).Handle(new GetQuinielaSettings.Query(seed.TeamId), CancellationToken.None);

            Assert.Equal(20m, dto.FundPercent);
        }

        [Fact]
        public async Task Update_ASecondTime_ReplacesTheValueInTheSameRow()
        {
            var seed = await SeedTeamAsync(fixture);
            await using (var db = fixture.CreateDbContext())
                await UpdateHandler(db, seed.CoachId).Handle(new UpdateQuinielaSettings.Command(seed.TeamId, 20m), CancellationToken.None);
            await using (var db = fixture.CreateDbContext())
                await UpdateHandler(db, seed.CoachId).Handle(new UpdateQuinielaSettings.Command(seed.TeamId, 5m), CancellationToken.None);

            await using var verify = fixture.CreateDbContext();
            var rows = await verify.QuinielaTeamSettings.Where(s => s.TeamId == seed.TeamId).ToListAsync();
            Assert.Equal(5m, Assert.Single(rows).FundPercent);
        }

        [Fact]
        public async Task Update_AppliesThePrizePercentToTheOpenJornada()
        {
            var seed = await SeedTeamAsync(fixture);
            var roundId = await SeedRoundAsync(fixture, seed.GroupCode, 1, StandardMatches("s1"));
            var jornada = await SeedJornadaAsync(fixture, seed.TeamId, roundId);
            await using (var db = fixture.CreateDbContext())
                await UpdateHandler(db, seed.CoachId).Handle(new UpdateQuinielaSettings.Command(seed.TeamId, 0m), CancellationToken.None);

            await using var verify = fixture.CreateDbContext();
            Assert.Equal(100m, (await verify.QuinielaJornadas.SingleAsync(j => j.Id == jornada.Id)).PrizePercent);
        }

        [Fact]
        public async Task Update_LeavesASettledJornadaUntouched()
        {
            var seed = await SeedTeamAsync(fixture);
            var roundId = await SeedRoundAsync(fixture, seed.GroupCode, 1, StandardMatches("s2"));
            var jornada = await SeedJornadaAsync(fixture, seed.TeamId, roundId);
            await using (var setup = fixture.CreateDbContext())
            {
                (await setup.QuinielaJornadas.SingleAsync(j => j.Id == jornada.Id)).Settle(0m, AfterMatches);
                await setup.SaveChangesAsync();
            }
            await using (var db = fixture.CreateDbContext())
                await UpdateHandler(db, seed.CoachId).Handle(new UpdateQuinielaSettings.Command(seed.TeamId, 0m), CancellationToken.None);

            await using var verify = fixture.CreateDbContext();
            Assert.Equal(55m, (await verify.QuinielaJornadas.SingleAsync(j => j.Id == jornada.Id)).PrizePercent);
        }

        [Theory]
        [InlineData("player")]
        [InlineData("family")]
        [InlineData("follower")]
        public async Task GetAndUpdate_ByANonCoach_ThrowForbidden(string who)
        {
            var seed = await SeedTeamAsync(fixture);
            var userId = who switch { "player" => seed.PlayerId, "family" => seed.FamilyId, _ => seed.FollowerId };
            await using var db = fixture.CreateDbContext();

            await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
                GetHandler(db, userId).Handle(new GetQuinielaSettings.Query(seed.TeamId), CancellationToken.None).AsTask());
            await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
                UpdateHandler(db, userId).Handle(new UpdateQuinielaSettings.Command(seed.TeamId, 10m), CancellationToken.None).AsTask());
        }

        private static readonly UpdateQuinielaSettings.Validator Validator = new();

        [Theory]
        [InlineData(0, true)]
        [InlineData(45.5, true)]
        [InlineData(100, true)]
        [InlineData(-0.01, false)]
        [InlineData(100.01, false)]
        public void Validator_RequiresAPercentBetween0And100(double percent, bool valid) =>
            Assert.Equal(valid, Validator.Validate(new UpdateQuinielaSettings.Command("t", (decimal)percent)).IsValid);

        [Fact]
        public async Task Open_WithoutSettings_UsesAFullPrizePercent()
        {
            var seed = await SeedTeamAsync(fixture);
            await SeedRoundAsync(fixture, seed.GroupCode, 1, StandardMatches("s3"));
            await using var db = fixture.CreateDbContext();
            await using var fed = fixture.CreateFederationDbContext();

            var dto = await new OpenQuiniela.Handler(db, fed, User(seed.CoachId), ClockAt(BeforeKickoff))
                .Handle(new OpenQuiniela.Command(seed.TeamId), CancellationToken.None);

            await using var verify = fixture.CreateDbContext();
            Assert.Equal(100m, (await verify.QuinielaJornadas.SingleAsync(j => j.Id == dto.Id)).PrizePercent);
        }

        [Fact]
        public async Task Open_WithAFundPercent_KeepsTheRestForPrizes()
        {
            var seed = await SeedTeamAsync(fixture);
            await SeedRoundAsync(fixture, seed.GroupCode, 1, StandardMatches("s4"));
            await using (var setup = fixture.CreateDbContext())
                await UpdateHandler(setup, seed.CoachId).Handle(new UpdateQuinielaSettings.Command(seed.TeamId, 20m), CancellationToken.None);
            await using var db = fixture.CreateDbContext();
            await using var fed = fixture.CreateFederationDbContext();

            var dto = await new OpenQuiniela.Handler(db, fed, User(seed.CoachId), ClockAt(BeforeKickoff))
                .Handle(new OpenQuiniela.Command(seed.TeamId), CancellationToken.None);

            await using var verify = fixture.CreateDbContext();
            Assert.Equal(80m, (await verify.QuinielaJornadas.SingleAsync(j => j.Id == dto.Id)).PrizePercent);
        }

        [Fact]
        public async Task Payments_ExposeThePrizePercentOfTheJornada()
        {
            var seed = await SeedTeamAsync(fixture);
            var roundId = await SeedRoundAsync(fixture, seed.GroupCode, 1, StandardMatches("s5"));
            var jornada = await SeedJornadaAsync(fixture, seed.TeamId, roundId);
            await using var db = fixture.CreateDbContext();
            await using var fed = fixture.CreateFederationDbContext();

            var dto = await new GetQuinielaPayments.Handler(db, fed, User(seed.CoachId), ClockAt(BeforeKickoff))
                .Handle(new GetQuinielaPayments.Query(seed.TeamId, jornada.Id), CancellationToken.None);

            Assert.Equal(55m, dto.Totals.PrizePercent);
        }
    }
}
