#nullable enable
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities.Teams;
using RFFM.Api.Features.Coaches.Quiniela;
using RFFM.Api.Tests.Fixtures;
using Xunit;
using static RFFM.Api.Tests.UnitTests.QuinielaTestSupport;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Dos liquidaciones simultáneas de la misma jornada (worker y entrenador) se aplican una sola vez.
    /// Requiere PostgreSQL real. See openspec/changes/quiniela-auto-settle-history/design.md → D3.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class QuinielaSettlementConcurrencyTests(PostgresContainerFixture fixture)
    {
        [Fact]
        public async Task TwoSimultaneousSettlements_ApplyOnce_AndTheOtherReportsAlreadySettled()
        {
            var seed = await SeedTeamAsync(fixture);
            var roundId = await SeedRoundAsync(fixture, seed.GroupCode, 1, StandardMatches("c1", "1-0", "1-1", "0-1"));
            var jornada = await SeedJornadaAsync(fixture, seed.TeamId, roundId);
            await SeedTicketAsync(fixture, jornada.Id, seed.PlayerId, "c1", QuinielaSign.Home, QuinielaSign.Draw, QuinielaSign.Away, 0, 1, paid: true);

            await using var dbA = fixture.CreateDbContext();
            await using var dbB = fixture.CreateDbContext();
            await using var fed = fixture.CreateFederationDbContext();
            var round = await QuinielaSupport.LoadRoundAsync(fed, roundId, CancellationToken.None);
            var jornadaA = await dbA.QuinielaJornadas.SingleAsync(j => j.Id == jornada.Id);
            var jornadaB = await dbB.QuinielaJornadas.SingleAsync(j => j.Id == jornada.Id);

            var outcomes = await Task.WhenAll(
                Attempt(() => QuinielaLifecycle.SettleAsync(dbA, jornadaA, round, AfterMatches, CancellationToken.None)),
                Attempt(() => QuinielaLifecycle.SettleAsync(dbB, jornadaB, round, AfterMatches, CancellationToken.None)));

            Assert.Equal(1, outcomes.Count(o => o is null));
            var failure = Assert.Single(outcomes.OfType<DomainException>());
            Assert.Equal(ErrorCodes.QuinielaAlreadySettled, failure.Code);
            await using var verify = fixture.CreateDbContext();
            Assert.Single(await verify.TeamFundMovements.Where(m => m.TeamId == seed.TeamId).ToListAsync());
        }

        private static async Task<Exception?> Attempt(Func<Task<QuinielaSettlementDto>> settle)
        {
            try
            {
                await settle();
                return null;
            }
            catch (Exception ex)
            {
                return ex;
            }
        }
    }
}
