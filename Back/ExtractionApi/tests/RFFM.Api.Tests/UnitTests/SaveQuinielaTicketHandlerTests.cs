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
    public class SaveQuinielaTicketHandlerTests(PostgresContainerFixture fixture)
    {
        private static SaveQuinielaTicket.Handler Handler(AppDbContext db, FederationDbContext fed, string? userId, DateTime? now = null) =>
            new(db, fed, User(userId), ClockAt(now ?? BeforeKickoff));

        private static SaveQuinielaTicket.Command Command(string teamId, string jornadaId, string suffix, string signs = "1X2", int plenoHome = 0, int plenoAway = 1) =>
            new()
            {
                TeamId = teamId,
                JornadaId = jornadaId,
                Picks =
                [
                    new($"A{suffix}", signs[0].ToString()),
                    new($"B{suffix}", signs[1].ToString()),
                    new($"C{suffix}", signs[2].ToString())
                ],
                PlenoHome = plenoHome,
                PlenoAway = plenoAway
            };

        private async Task<(QuinielaSeed Seed, QuinielaJornada Jornada)> OpenAsync(string suffix, bool postponedD = false)
        {
            var seed = await SeedTeamAsync(fixture);
            var roundId = await SeedRoundAsync(fixture, seed.GroupCode, 1, StandardMatches(suffix, postponedD: postponedD));
            var jornada = await SeedJornadaAsync(fixture, seed.TeamId, roundId);
            return (seed, jornada);
        }

        [Theory]
        [InlineData("coach")]
        [InlineData("player")]
        [InlineData("family")]
        public async Task Handle_SavesAPendingTicket(string who)
        {
            var (seed, jornada) = await OpenAsync($"s1{who}");
            var userId = who switch { "coach" => seed.CoachId, "player" => seed.PlayerId, _ => seed.FamilyId };
            await using var db = fixture.CreateDbContext();
            await using var fed = fixture.CreateFederationDbContext();

            var dto = await Handler(db, fed, userId).Handle(Command(seed.TeamId, jornada.Id, $"s1{who}"), CancellationToken.None);

            Assert.Equal("Pending", dto.PaymentStatus);
            Assert.Equal(3, dto.Picks.Count);
            await using var verify = fixture.CreateDbContext();
            var stored = await verify.QuinielaTickets.SingleAsync(t => t.JornadaId == jornada.Id && t.ApplicationUserId == userId);
            Assert.Equal(QuinielaPaymentStatus.Pending, stored.PaymentStatus);
            Assert.Equal(3, stored.Picks.Count);
        }

        [Fact]
        public async Task Handle_SavingAgainReplacesThePicksAndKeepsThePaymentStatus()
        {
            var (seed, jornada) = await OpenAsync("s2");
            await using (var db = fixture.CreateDbContext())
            await using (var fed = fixture.CreateFederationDbContext())
                await Handler(db, fed, seed.PlayerId).Handle(Command(seed.TeamId, jornada.Id, "s2"), CancellationToken.None);
            await using (var setup = fixture.CreateDbContext())
            {
                var ticket = await setup.QuinielaTickets.SingleAsync(t => t.JornadaId == jornada.Id);
                ticket.MarkPaid(QuinielaPaymentMethod.Bizum, BeforeKickoff);
                await setup.SaveChangesAsync();
            }

            await using var db2 = fixture.CreateDbContext();
            await using var fed2 = fixture.CreateFederationDbContext();
            var dto = await Handler(db2, fed2, seed.PlayerId).Handle(Command(seed.TeamId, jornada.Id, "s2", "212", 2, 2), CancellationToken.None);

            Assert.Equal("Paid", dto.PaymentStatus);
            await using var verify = fixture.CreateDbContext();
            var stored = await verify.QuinielaTickets.SingleAsync(t => t.JornadaId == jornada.Id);
            Assert.Equal(["2", "1", "2"], stored.Picks.OrderBy(p => p.RecordCode).Select(p => p.Sign.Name));
            Assert.Equal((2, 2), (stored.PlenoHome, stored.PlenoAway));
            Assert.Equal(1, await verify.QuinielaTickets.CountAsync(t => t.JornadaId == jornada.Id));
        }

        [Fact]
        public async Task Handle_AfterTheFirstKickoff_IsRejected()
        {
            var (seed, jornada) = await OpenAsync("s3");
            await using var db = fixture.CreateDbContext();
            await using var fed = fixture.CreateFederationDbContext();
            var afterKickoff = new DateTime(2026, 11, 7, 15, 30, 0, DateTimeKind.Utc); // 16:00 de Madrid = 15:00 UTC

            var ex = await Assert.ThrowsAsync<DomainException>(() =>
                Handler(db, fed, seed.PlayerId, afterKickoff).Handle(Command(seed.TeamId, jornada.Id, "s3"), CancellationToken.None).AsTask());

            Assert.Equal(ErrorCodes.QuinielaPicksClosed, ex.Code);
        }

        [Theory]
        [InlineData("follower")]
        [InlineData("outsider")]
        public async Task Handle_ByOtherRoles_ThrowsForbidden(string who)
        {
            var (seed, jornada) = await OpenAsync($"s4{who}");
            var userId = who == "follower" ? seed.FollowerId : seed.OutsiderId;
            await using var db = fixture.CreateDbContext();
            await using var fed = fixture.CreateFederationDbContext();

            await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
                Handler(db, fed, userId).Handle(Command(seed.TeamId, jornada.Id, $"s4{who}"), CancellationToken.None).AsTask());
        }

        [Theory]
        [InlineData("clubcoach")]
        [InlineData("directive")]
        public async Task Handle_ByAClubLevelCoachOrDirective_SavesATicket(string who)
        {
            var (seed, jornada) = await OpenAsync($"s6{who}");
            await using var db = fixture.CreateDbContext();
            await using var fed = fixture.CreateFederationDbContext();

            var dto = await Handler(db, fed, seed.ClubUser(who)).Handle(Command(seed.TeamId, jornada.Id, $"s6{who}"), CancellationToken.None);

            Assert.Equal("Pending", dto.PaymentStatus);
        }

        [Fact]
        public async Task Handle_ByACoachOfAnotherClub_ThrowsForbidden()
        {
            var (seed, jornada) = await OpenAsync("s7");
            await using var db = fixture.CreateDbContext();
            await using var fed = fixture.CreateFederationDbContext();

            await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
                Handler(db, fed, seed.OtherClubCoachId).Handle(Command(seed.TeamId, jornada.Id, "s7"), CancellationToken.None).AsTask());
        }

        [Fact]
        public async Task Handle_IgnoresPicksOfPostponedMatches()
        {
            var (seed, jornada) = await OpenAsync("s5", postponedD: true);
            var baseCommand = Command(seed.TeamId, jornada.Id, "s5");
            var command = baseCommand with { Picks = [.. baseCommand.Picks, new SaveQuinielaTicket.PickRequest("Ds5", "1")] };
            await using var db = fixture.CreateDbContext();
            await using var fed = fixture.CreateFederationDbContext();

            var dto = await Handler(db, fed, seed.PlayerId).Handle(command, CancellationToken.None);

            Assert.DoesNotContain(dto.Picks, p => p.RecordCode == "Ds5");
            Assert.Equal(3, dto.Picks.Count);
        }

        [Fact]
        public async Task Handle_WithAMissingPickForAValidMatch_IsRejected()
        {
            var (seed, jornada) = await OpenAsync("s6");
            var command = Command(seed.TeamId, jornada.Id, "s6") with { Picks = [new SaveQuinielaTicket.PickRequest("As6", "1")] };
            await using var db = fixture.CreateDbContext();
            await using var fed = fixture.CreateFederationDbContext();

            var ex = await Assert.ThrowsAsync<DomainException>(() =>
                Handler(db, fed, seed.PlayerId).Handle(command, CancellationToken.None).AsTask());

            Assert.Equal(ErrorCodes.QuinielaInvalidTicket, ex.Code);
        }

        [Fact]
        public async Task Handle_WithAPickForAMatchOutsideTheRound_IsRejected()
        {
            var (seed, jornada) = await OpenAsync("s7");
            var baseCommand = Command(seed.TeamId, jornada.Id, "s7");
            var command = baseCommand with { Picks = [.. baseCommand.Picks, new SaveQuinielaTicket.PickRequest("ZZZ", "1")] };
            await using var db = fixture.CreateDbContext();
            await using var fed = fixture.CreateFederationDbContext();

            var ex = await Assert.ThrowsAsync<DomainException>(() =>
                Handler(db, fed, seed.PlayerId).Handle(command, CancellationToken.None).AsTask());

            Assert.Equal(ErrorCodes.QuinielaInvalidTicket, ex.Code);
        }

        [Fact]
        public async Task Handle_UnknownJornada_ThrowsNotFound()
        {
            var seed = await SeedTeamAsync(fixture);
            await using var db = fixture.CreateDbContext();
            await using var fed = fixture.CreateFederationDbContext();

            await Assert.ThrowsAsync<NotFoundException>(() =>
                Handler(db, fed, seed.PlayerId).Handle(Command(seed.TeamId, "missing", "x"), CancellationToken.None).AsTask());
        }

        private static readonly SaveQuinielaTicket.Validator Validator = new();

        [Fact]
        public void Validator_AcceptsAValidCommand() =>
            Assert.True(Validator.Validate(Command("t", "j", "x")).IsValid);

        [Fact]
        public void Validator_RejectsEmptyPicks() =>
            Assert.False(Validator.Validate(Command("t", "j", "x") with { Picks = [] }).IsValid);

        [Fact]
        public void Validator_RejectsAnUnknownSign() =>
            Assert.False(Validator.Validate(Command("t", "j", "x", "1X3")).IsValid);

        [Theory]
        [InlineData(-1, 0)]
        [InlineData(0, 4)]
        public void Validator_RejectsPlenoGoalsOutOfRange(int home, int away) =>
            Assert.False(Validator.Validate(Command("t", "j", "x", plenoHome: home, plenoAway: away)).IsValid);

        [Fact]
        public void Validator_RejectsDuplicatedMatches() =>
            Assert.False(Validator.Validate(Command("t", "j", "x") with
            {
                Picks = [new("A", "1"), new("A", "X")]
            }).IsValid);
    }
}
