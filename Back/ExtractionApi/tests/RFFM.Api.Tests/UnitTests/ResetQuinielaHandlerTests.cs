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
    public class ResetQuinielaHandlerTests(PostgresContainerFixture fixture)
    {
        private static ResetQuiniela.Handler Handler(AppDbContext db, string? userId) => new(db, User(userId));

        private async Task<(QuinielaSeed Seed, QuinielaJornada Jornada)> SeedAsync(string suffix)
        {
            var seed = await SeedTeamAsync(fixture);
            var roundId = await SeedRoundAsync(fixture, seed.GroupCode, 1, StandardMatches(suffix));
            var jornada = await SeedJornadaAsync(fixture, seed.TeamId, roundId);
            await SeedTicketAsync(fixture, jornada.Id, seed.PlayerId, suffix, QuinielaSign.Home, QuinielaSign.Draw, QuinielaSign.Away, paid: true);
            await SeedTicketAsync(fixture, jornada.Id, seed.FamilyId, suffix, QuinielaSign.Away, QuinielaSign.Draw, QuinielaSign.Home);
            return (seed, jornada);
        }

        [Fact]
        public async Task Handle_RemovesTheJornadaAndAllItsTickets()
        {
            var (seed, jornada) = await SeedAsync("r1");
            await using var db = fixture.CreateDbContext();

            await Handler(db, seed.CoachId).Handle(new ResetQuiniela.Command(seed.TeamId, jornada.Id), CancellationToken.None);

            await using var verify = fixture.CreateDbContext();
            Assert.False(await verify.QuinielaJornadas.AnyAsync(j => j.Id == jornada.Id));
            Assert.False(await verify.QuinielaTickets.AnyAsync(t => t.JornadaId == jornada.Id));
        }

        [Theory]
        [InlineData("player")]
        [InlineData("family")]
        [InlineData("follower")]
        public async Task Handle_ByANonCoach_ThrowsForbiddenAndKeepsEverything(string who)
        {
            var (seed, jornada) = await SeedAsync($"r2{who}");
            var userId = who switch { "player" => seed.PlayerId, "family" => seed.FamilyId, _ => seed.FollowerId };
            await using var db = fixture.CreateDbContext();

            await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
                Handler(db, userId).Handle(new ResetQuiniela.Command(seed.TeamId, jornada.Id), CancellationToken.None).AsTask());

            await using var verify = fixture.CreateDbContext();
            Assert.True(await verify.QuinielaJornadas.AnyAsync(j => j.Id == jornada.Id));
            Assert.Equal(2, await verify.QuinielaTickets.CountAsync(t => t.JornadaId == jornada.Id));
        }

        [Fact]
        public async Task Handle_OnASettledJornada_IsRejectedAndKeepsEverything()
        {
            var (seed, jornada) = await SeedAsync("r3");
            await using (var setup = fixture.CreateDbContext())
            {
                (await setup.QuinielaJornadas.SingleAsync(j => j.Id == jornada.Id)).Settle(0m, AfterMatches);
                await setup.SaveChangesAsync();
            }
            await using var db = fixture.CreateDbContext();

            var ex = await Assert.ThrowsAsync<DomainException>(() =>
                Handler(db, seed.CoachId).Handle(new ResetQuiniela.Command(seed.TeamId, jornada.Id), CancellationToken.None).AsTask());

            Assert.Equal(ErrorCodes.QuinielaAlreadySettled, ex.Code);
            await using var verify = fixture.CreateDbContext();
            Assert.True(await verify.QuinielaJornadas.AnyAsync(j => j.Id == jornada.Id));
            Assert.Equal(2, await verify.QuinielaTickets.CountAsync(t => t.JornadaId == jornada.Id));
        }

        [Fact]
        public async Task Handle_UnknownJornada_ThrowsNotFound()
        {
            var (seed, _) = await SeedAsync("r4");
            await using var db = fixture.CreateDbContext();

            var ex = await Assert.ThrowsAsync<NotFoundException>(() =>
                Handler(db, seed.CoachId).Handle(new ResetQuiniela.Command(seed.TeamId, "missing"), CancellationToken.None).AsTask());

            Assert.Equal(ErrorCodes.QuinielaNotFound, ex.Code);
        }
    }
}
