#nullable enable
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using RFFM.Api.Domain.Entities.Teams;
using RFFM.Api.Features.Coaches.Quiniela;
using RFFM.Api.Tests.Fixtures;
using Xunit;
using static RFFM.Api.Tests.UnitTests.QuinielaTestSupport;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class QuinielaAutoCloseServiceTests(PostgresContainerFixture fixture)
    {
        private QuinielaAutoCloseService Service()
        {
            var services = new ServiceCollection();
            services.AddScoped(_ => fixture.CreateDbContext());
            services.AddScoped(_ => fixture.CreateFederationDbContext());
            var provider = services.BuildServiceProvider();
            return new QuinielaAutoCloseService(
                provider.GetRequiredService<IServiceScopeFactory>(), ClockAt(AfterMatches), NullLogger<QuinielaAutoCloseService>.Instance);
        }

        private async Task<QuinielaJornada> ReloadAsync(string jornadaId)
        {
            await using var db = fixture.CreateDbContext();
            return await db.QuinielaJornadas.AsNoTracking().SingleAsync(j => j.Id == jornadaId);
        }

        [Fact]
        public async Task RunAsync_SettlesACompletedJornadaAndOpensTheNextRound()
        {
            var seed = await SeedTeamAsync(fixture);
            var round1 = await SeedRoundAsync(fixture, seed.GroupCode, 1, StandardMatches("a1", "1-0", "1-1", "0-1"));
            var round2 = await SeedRoundAsync(fixture, seed.GroupCode, 2, StandardMatches("a1b"));
            var jornada = await SeedJornadaAsync(fixture, seed.TeamId, round1);
            await SeedTicketAsync(fixture, jornada.Id, seed.PlayerId, "a1", QuinielaSign.Away, QuinielaSign.Home, QuinielaSign.Home, paid: true);

            await Service().RunAsync(CancellationToken.None);

            var settled = await ReloadAsync(jornada.Id);
            Assert.Equal(QuinielaJornadaStatus.Settled, settled.Status);
            await using var verify = fixture.CreateDbContext();
            var next = await verify.QuinielaJornadas.SingleAsync(j => j.TeamId == seed.TeamId && j.Status == QuinielaJornadaStatus.Open);
            Assert.Equal(round2, next.RffmRoundId);
            Assert.Equal(settled.CarryOut, next.CarryIn);
        }

        [Fact]
        public async Task RunAsync_LeavesAJornadaWithPendingMatchesOpen()
        {
            var seed = await SeedTeamAsync(fixture);
            var round1 = await SeedRoundAsync(fixture, seed.GroupCode, 1, StandardMatches("a2", "1-0", "1-1"));
            var jornada = await SeedJornadaAsync(fixture, seed.TeamId, round1);

            await Service().RunAsync(CancellationToken.None);

            Assert.Equal(QuinielaJornadaStatus.Open, (await ReloadAsync(jornada.Id)).Status);
        }

        [Fact]
        public async Task RunAsync_WhenOneJornadaFails_StillProcessesTheOthers()
        {
            var broken = await SeedTeamAsync(fixture);
            await SeedJornadaAsync(fixture, broken.TeamId, Guid.NewGuid().ToString());
            var healthy = await SeedTeamAsync(fixture);
            var round = await SeedRoundAsync(fixture, healthy.GroupCode, 1, StandardMatches("a3", "1-0", "1-1", "0-1"));
            var jornada = await SeedJornadaAsync(fixture, healthy.TeamId, round);

            await Service().RunAsync(CancellationToken.None);

            Assert.Equal(QuinielaJornadaStatus.Settled, (await ReloadAsync(jornada.Id)).Status);
        }

        [Fact]
        public async Task RunAsync_OpensTheNextRoundForATeamWhoseLastJornadaIsSettledWithoutSuccessor()
        {
            var seed = await SeedTeamAsync(fixture);
            var round1 = await SeedRoundAsync(fixture, seed.GroupCode, 1, StandardMatches("a4", "1-0", "1-1", "0-1"));
            var previous = await SeedJornadaAsync(fixture, seed.TeamId, round1);
            await using (var setup = fixture.CreateDbContext())
            {
                (await setup.QuinielaJornadas.SingleAsync(j => j.Id == previous.Id)).Settle(1.5m, AfterMatches);
                await setup.SaveChangesAsync();
            }
            var round2 = await SeedRoundAsync(fixture, seed.GroupCode, 2, StandardMatches("a4b"));

            await Service().RunAsync(CancellationToken.None);

            await using var verify = fixture.CreateDbContext();
            var open = await verify.QuinielaJornadas.SingleAsync(j => j.TeamId == seed.TeamId && j.Status == QuinielaJornadaStatus.Open);
            Assert.Equal((round2, 1.5m), (open.RffmRoundId, open.CarryIn));
        }

        [Fact]
        public async Task RunAsync_WithoutANextRound_OpensNothing()
        {
            var seed = await SeedTeamAsync(fixture);
            var round1 = await SeedRoundAsync(fixture, seed.GroupCode, 1, StandardMatches("a5", "1-0", "1-1", "0-1"));
            var jornada = await SeedJornadaAsync(fixture, seed.TeamId, round1);

            await Service().RunAsync(CancellationToken.None);

            Assert.Equal(QuinielaJornadaStatus.Settled, (await ReloadAsync(jornada.Id)).Status);
            await using var verify = fixture.CreateDbContext();
            Assert.Equal(1, await verify.QuinielaJornadas.CountAsync(j => j.TeamId == seed.TeamId));
        }

        [Fact]
        public async Task RunAsync_Twice_SettlesOnlyOnce()
        {
            var seed = await SeedTeamAsync(fixture);
            var round1 = await SeedRoundAsync(fixture, seed.GroupCode, 1, StandardMatches("a6", "1-0", "1-1", "0-1"));
            var jornada = await SeedJornadaAsync(fixture, seed.TeamId, round1);
            await SeedTicketAsync(fixture, jornada.Id, seed.PlayerId, "a6", QuinielaSign.Away, QuinielaSign.Home, QuinielaSign.Home, paid: true);

            await Service().RunAsync(CancellationToken.None);
            await Service().RunAsync(CancellationToken.None);

            await using var verify = fixture.CreateDbContext();
            Assert.Single(await verify.TeamFundMovements.Where(m => m.TeamId == seed.TeamId).ToListAsync());
        }
    }
}
