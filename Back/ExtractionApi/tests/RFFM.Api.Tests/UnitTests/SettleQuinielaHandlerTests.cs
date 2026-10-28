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
    public class SettleQuinielaHandlerTests(PostgresContainerFixture fixture)
    {
        private static SettleQuiniela.Handler Handler(AppDbContext db, FederationDbContext fed, string? userId) =>
            new(db, fed, User(userId), ClockAt(AfterMatches));

        // Resultados: A 1-0 (1), B 1-1 (X), C 0-1 (2, Pleno 0-1).
        private async Task<(QuinielaSeed Seed, QuinielaJornada Jornada)> SeedAsync(string suffix, bool finished = true)
        {
            var seed = await SeedTeamAsync(fixture);
            var roundId = await SeedRoundAsync(fixture, seed.GroupCode, 1,
                finished ? StandardMatches(suffix, "1-0", "1-1", "0-1") : StandardMatches(suffix, "1-0", "1-1"));
            var jornada = await SeedJornadaAsync(fixture, seed.TeamId, roundId);
            return (seed, jornada);
        }

        private async Task<QuinielaSettlementDto> SettleAsync(QuinielaSeed seed, QuinielaJornada jornada, string? userId = null)
        {
            await using var db = fixture.CreateDbContext();
            await using var fed = fixture.CreateFederationDbContext();
            return await Handler(db, fed, userId ?? seed.CoachId).Handle(new SettleQuiniela.Command(seed.TeamId, jornada.Id), CancellationToken.None);
        }

        [Fact]
        public async Task Handle_PersistsResultsCarryOutAndTheFundMovement()
        {
            var (seed, jornada) = await SeedAsync("t1");
            // 8 boletos pagados: bolsa 8 x 55 % = 4,40. Uno acierta todo y el Pleno (Especial).
            var winner = await SeedTicketAsync(fixture, jornada.Id, seed.PlayerId, "t1", QuinielaSign.Home, QuinielaSign.Draw, QuinielaSign.Away, 0, 1, paid: true);
            await SeedTicketAsync(fixture, jornada.Id, seed.CoachId, "t1", QuinielaSign.Away, QuinielaSign.Home, QuinielaSign.Home, paid: true);
            for (var i = 0; i < 6; i++)
                await SeedTicketAsync(fixture, jornada.Id, $"extra-{Guid.NewGuid():N}", "t1", QuinielaSign.Away, QuinielaSign.Home, QuinielaSign.Home, paid: true);

            var dto = await SettleAsync(seed, jornada);

            Assert.Equal(8m, dto.Collected);
            Assert.Equal(4.4m, dto.PrizePool);
            Assert.Equal(3.6m, dto.FundAmount);
            await using var verify = fixture.CreateDbContext();
            var storedJornada = await verify.QuinielaJornadas.SingleAsync(j => j.Id == jornada.Id);
            Assert.Equal(QuinielaJornadaStatus.Settled, storedJornada.Status);
            Assert.Equal(dto.CarryOut, storedJornada.CarryOut);
            var storedWinner = await verify.QuinielaTickets.SingleAsync(t => t.Id == winner.Id);
            Assert.Equal((3, QuinielaCategory.Special), (storedWinner.Hits, storedWinner.Category));
            Assert.Equal(0.85m, storedWinner.Prize); // 4,40 x 7,5 / 38,5 = 0,857 truncado
            var movement = await verify.TeamFundMovements.SingleAsync(m => m.TeamId == seed.TeamId);
            Assert.Equal(3.6m, movement.Amount);
            Assert.Equal(TeamFundMovementSource.QuinielaFund, movement.Source);
        }

        [Fact]
        public async Task Handle_WithoutPaidTickets_CreatesNoFundMovement()
        {
            var (seed, jornada) = await SeedAsync("t2");
            await SeedTicketAsync(fixture, jornada.Id, seed.PlayerId, "t2", QuinielaSign.Home, QuinielaSign.Draw, QuinielaSign.Away);

            var dto = await SettleAsync(seed, jornada);

            Assert.Equal(0m, dto.FundAmount);
            await using var verify = fixture.CreateDbContext();
            Assert.False(await verify.TeamFundMovements.AnyAsync(m => m.TeamId == seed.TeamId));
        }

        [Fact]
        public async Task Handle_WithAnUnfinishedValidMatch_IsRejectedAndNothingIsPersisted()
        {
            var (seed, jornada) = await SeedAsync("t3", finished: false);

            var ex = await Assert.ThrowsAsync<DomainException>(() => SettleAsync(seed, jornada));

            Assert.Equal(ErrorCodes.QuinielaMatchesNotFinished, ex.Code);
            await using var verify = fixture.CreateDbContext();
            Assert.Equal(QuinielaJornadaStatus.Open, (await verify.QuinielaJornadas.SingleAsync(j => j.Id == jornada.Id)).Status);
        }

        [Fact]
        public async Task Handle_Twice_IsRejected()
        {
            var (seed, jornada) = await SeedAsync("t4");
            await SettleAsync(seed, jornada);

            var ex = await Assert.ThrowsAsync<DomainException>(() => SettleAsync(seed, jornada));

            Assert.Equal(ErrorCodes.QuinielaAlreadySettled, ex.Code);
        }

        [Theory]
        [InlineData("player")]
        [InlineData("family")]
        [InlineData("follower")]
        public async Task Handle_ByANonCoach_ThrowsForbidden(string who)
        {
            var (seed, jornada) = await SeedAsync($"t5{who}");
            var userId = who switch { "player" => seed.PlayerId, "family" => seed.FamilyId, _ => seed.FollowerId };

            await Assert.ThrowsAsync<ForbiddenAccessException>(() => SettleAsync(seed, jornada, userId));
        }

        [Theory]
        [InlineData("clubcoach")]
        [InlineData("directive")]
        public async Task Handle_ByAClubLevelCoachOrDirective_Settles(string who)
        {
            var (seed, jornada) = await SeedAsync($"t6{who}");

            var dto = await SettleAsync(seed, jornada, seed.ClubUser(who));

            Assert.Equal(0m, dto.Collected);
        }

        [Fact]
        public async Task Handle_ByACoachOfAnotherClub_ThrowsForbidden()
        {
            var (seed, jornada) = await SeedAsync("t7");

            await Assert.ThrowsAsync<ForbiddenAccessException>(() => SettleAsync(seed, jornada, seed.OtherClubCoachId));
        }

        [Fact]
        public void Validator_RequiresTeamAndJornada()
        {
            var validator = new SettleQuiniela.Validator();

            Assert.False(validator.Validate(new SettleQuiniela.Command("", "j")).IsValid);
            Assert.False(validator.Validate(new SettleQuiniela.Command("t", "")).IsValid);
            Assert.True(validator.Validate(new SettleQuiniela.Command("t", "j")).IsValid);
        }
    }
}
