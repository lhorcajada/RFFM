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
    public class GetCurrentQuinielaHandlerTests(PostgresContainerFixture fixture)
    {
        private static GetCurrentQuiniela.Handler Handler(AppDbContext db, FederationDbContext fed, string? userId, DateTime? now = null) =>
            new(db, fed, User(userId), ClockAt(now ?? BeforeKickoff));

        private async Task<QuinielaCurrentDtoResult> CurrentAsync(string teamId, string? userId, DateTime? now = null)
        {
            await using var db = fixture.CreateDbContext();
            await using var fed = fixture.CreateFederationDbContext();
            return new(await Handler(db, fed, userId, now).Handle(new GetCurrentQuiniela.Query(teamId), CancellationToken.None));
        }

        private sealed record QuinielaCurrentDtoResult(QuinielaCurrentDto Value);

        [Fact]
        public async Task Handle_WithoutAnOpenJornada_ReportsNotOpen()
        {
            var seed = await SeedTeamAsync(fixture);

            var dto = (await CurrentAsync(seed.TeamId, seed.PlayerId)).Value;

            Assert.False(dto.IsOpen);
            Assert.Null(dto.Jornada);
            Assert.Empty(dto.Matches);
            Assert.Empty(dto.MyTickets);
            Assert.Null(dto.Previous);
        }

        [Fact]
        public async Task Handle_ListsMatchesWithValidityAndTheLastValidMatchAsPleno()
        {
            var seed = await SeedTeamAsync(fixture);
            var roundId = await SeedRoundAsync(fixture, seed.GroupCode, 1, StandardMatches("c1", postponedD: true));
            await SeedJornadaAsync(fixture, seed.TeamId, roundId);

            var dto = (await CurrentAsync(seed.TeamId, seed.PlayerId)).Value;

            Assert.True(dto.IsOpen);
            Assert.Equal(4, dto.Matches.Count);
            Assert.False(dto.Matches.Single(m => m.RecordCode == "Dc1").IsValid);
            Assert.Equal("Cc1", dto.Matches.Single(m => m.IsPleno).RecordCode);
            Assert.False(dto.Jornada!.PicksClosed);
            Assert.Equal(new DateTime(2026, 11, 7, 15, 0, 0, DateTimeKind.Utc), dto.Jornada.FirstKickoffUtc);
        }

        [Fact]
        public async Task Handle_ReturnsMyTicketWithPendingStatusAndDeadline()
        {
            var seed = await SeedTeamAsync(fixture);
            var roundId = await SeedRoundAsync(fixture, seed.GroupCode, 1, StandardMatches("c2"));
            var jornada = await SeedJornadaAsync(fixture, seed.TeamId, roundId, carryIn: 1m);
            await SeedTicketAsync(fixture, jornada.Id, seed.PlayerId, "c2", QuinielaSign.Home, QuinielaSign.Draw, QuinielaSign.Away);
            await SeedTicketAsync(fixture, jornada.Id, seed.FamilyId, "c2", QuinielaSign.Home, QuinielaSign.Draw, QuinielaSign.Away, paid: true);

            var dto = (await CurrentAsync(seed.TeamId, seed.PlayerId)).Value;

            Assert.Equal("Pending", dto.MyTickets.Single().PaymentStatus);
            Assert.Equal(new DateTime(2026, 11, 6, 23, 0, 0, DateTimeKind.Utc), dto.MyTickets.Single().PaymentDeadlineUtc);
            Assert.Equal(3, dto.MyTickets.Single().Picks.Count);
            Assert.Equal(2, dto.Pool!.Participants);
            Assert.Equal(1, dto.Pool.PaidTickets);
            Assert.Equal(1m, dto.Pool.Collected);
            Assert.Equal(0.55m + 1m, dto.Pool.PrizePool);
            Assert.False(dto.CanManage);
        }

        [Fact]
        public async Task Handle_AfterThePaymentDeadlineAPendingTicketIsExpired()
        {
            var seed = await SeedTeamAsync(fixture);
            var roundId = await SeedRoundAsync(fixture, seed.GroupCode, 1, StandardMatches("c3"));
            var jornada = await SeedJornadaAsync(fixture, seed.TeamId, roundId);
            await SeedTicketAsync(fixture, jornada.Id, seed.PlayerId, "c3", QuinielaSign.Home, QuinielaSign.Draw, QuinielaSign.Away);

            var dto = (await CurrentAsync(seed.TeamId, seed.PlayerId, AfterMatches)).Value;

            Assert.Equal("Expired", dto.MyTickets.Single().PaymentStatus);
            Assert.True(dto.Jornada!.PicksClosed);
        }

        [Fact]
        public async Task Handle_AfterSettlingReturnsThePreviousResultOfTheCaller()
        {
            var seed = await SeedTeamAsync(fixture);
            var roundId = await SeedRoundAsync(fixture, seed.GroupCode, 1, StandardMatches("c4", "1-0", "1-1", "0-1"));
            var jornada = await SeedJornadaAsync(fixture, seed.TeamId, roundId);
            var ticket = await SeedTicketAsync(fixture, jornada.Id, seed.PlayerId, "c4", QuinielaSign.Home, QuinielaSign.Draw, QuinielaSign.Away, paid: true);
            await using (var setup = fixture.CreateDbContext())
            {
                (await setup.QuinielaJornadas.SingleAsync(j => j.Id == jornada.Id)).Settle(0.55m, AfterMatches);
                (await setup.QuinielaTickets.SingleAsync(t => t.Id == ticket.Id)).ApplyResult(3, QuinielaCategory.Special, 0.55m);
                await setup.SaveChangesAsync();
            }

            var dto = (await CurrentAsync(seed.TeamId, seed.PlayerId, AfterMatches)).Value;

            Assert.False(dto.IsOpen);
            Assert.Equal(0.55m, dto.Previous!.CarryOut);
            Assert.Equal(3, dto.Previous.MyHits);
            Assert.Equal("Special", dto.Previous.MyCategory);
            Assert.Equal(0.55m, dto.Previous.MyPrize);
        }

        [Fact]
        public async Task Handle_FlagsTheCoachAsManager()
        {
            var seed = await SeedTeamAsync(fixture);

            Assert.True((await CurrentAsync(seed.TeamId, seed.CoachId)).Value.CanManage);
        }

        [Theory]
        [InlineData("clubcoach")]
        [InlineData("directive")]
        public async Task Handle_ByAClubLevelCoachOrDirective_IsAllowedAndFlaggedAsManager(string who)
        {
            var seed = await SeedTeamAsync(fixture);

            Assert.True((await CurrentAsync(seed.TeamId, seed.ClubUser(who))).Value.CanManage);
        }

        [Fact]
        public async Task Handle_ByACoachOfAnotherClub_ThrowsForbidden()
        {
            var seed = await SeedTeamAsync(fixture);

            await Assert.ThrowsAsync<ForbiddenAccessException>(() => CurrentAsync(seed.TeamId, seed.OtherClubCoachId));
        }

        [Theory]
        [InlineData("follower")]
        [InlineData("outsider")]
        public async Task Handle_ByOtherRoles_ThrowsForbidden(string who)
        {
            var seed = await SeedTeamAsync(fixture);
            var userId = who == "follower" ? seed.FollowerId : seed.OutsiderId;

            await Assert.ThrowsAsync<ForbiddenAccessException>(() => CurrentAsync(seed.TeamId, userId));
        }
    }
}
