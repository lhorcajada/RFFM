#nullable enable
using System;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Moq;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Federation.Results;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.LeagueScorers;
using RFFM.Api.Features.Federation.Teams.Models;
using RFFM.Api.Features.Federation.Teams.Services;
using RFFM.Api.Infrastructure.Options;
using RFFM.Api.Tests.Fixtures;
using Xunit;
using Microsoft.Extensions.Options;

namespace RFFM.Api.Tests.IntegrationTests
{
    [Collection(PostgresCollection.Name)]
    public class RefreshLeagueActasHandlerTests
    {
        private static readonly DateTime Now = new(2026, 11, 2, 9, 0, 0, DateTimeKind.Utc);
        private const int Season = 22;

        private readonly PostgresContainerFixture _fixture;
        private readonly int _competition = Random.Shared.Next(100_000_000, 900_000_000);
        private readonly int _group = Random.Shared.Next(100_000_000, 900_000_000);
        private readonly string _prefix = Guid.NewGuid().ToString("N")[..8];
        private readonly Mock<IActaService> _actas = new();

        public RefreshLeagueActasHandlerTests(PostgresContainerFixture fixture) => _fixture = fixture;

        private string Code(string suffix) => $"{_prefix}-{suffix}";

        private async Task<string> SeedTeamAsync(bool withLeague = true)
        {
            await using var db = _fixture.CreateDbContext();
            var club = Club.Create($"Refresh Actas Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Domain.Entities.Seasons.Season.Create($"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9),
                isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "Refresh Actas Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id,
                RffmCompetitionId = withLeague ? _competition : null,
                RffmGroupId = withLeague ? _group : null
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();
            return team.Id;
        }

        private static RffmMatchSnapshot Snapshot(string recordCode, string closed) => new()
        {
            RecordCode = recordCode,
            RecordClosed = closed,
            Date = "01/11/2026",
            Time = "10:00",
            LocalTeamName = "Local",
            VisitorTeamName = "Visitante"
        };

        private async Task SeedRoundAsync(int number, params RffmMatchSnapshot[] matches)
        {
            await using var db = _fixture.CreateFederationDbContext();
            var round = RffmRound.Create(_group.ToString(), number, number.ToString(), null);
            round.ApplySnapshot(matches, Now);
            db.RffmRounds.Add(round);
            await db.SaveChangesAsync();
        }

        private async Task SeedStoredActaAsync(string recordCode)
        {
            await using var db = _fixture.CreateFederationDbContext();
            db.RffmMatchRecords.Add(RffmMatchRecord.Create(recordCode, _group.ToString(),
                JsonSerializer.Serialize(new MatchRffm { RecordClosed = "1" }), Now));
            await db.SaveChangesAsync();
        }

        private async Task<RefreshLeagueActas.RefreshResponse> RunAsync(string teamId, int round)
        {
            await using var appDb = _fixture.CreateDbContext();
            await using var db = _fixture.CreateFederationDbContext();
            var handler = new RefreshLeagueActas.Handler(appDb, db, _actas.Object, Options.Create(new RffmOptions { CurrentSeasonId = Season }));
            return await handler.Handle(new RefreshLeagueActas.RefreshLeagueActasCommand(teamId, round), CancellationToken.None);
        }

        [Fact]
        public async Task Descarga_solo_las_actas_cerradas_de_la_jornada_que_no_estan_guardadas()
        {
            var teamId = await SeedTeamAsync();
            var missing = Code("M");
            var stored = Code("S");
            var upcoming = Code("U");
            var otherRound = Code("O");
            await SeedRoundAsync(5, Snapshot(missing, "1"), Snapshot(stored, "1"), Snapshot(upcoming, "0"));
            await SeedRoundAsync(6, Snapshot(otherRound, "1"));
            await SeedStoredActaAsync(stored);
            _actas.Setup(a => a.GetMatchFromActaAsync(missing, Season, _competition, _group, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new MatchRffm { RecordClosed = "1" });

            var result = await RunAsync(teamId, 5);

            Assert.Equal(1, result.Requested);
            Assert.Equal(1, result.Stored);
            Assert.Equal(0, result.Failed);
            _actas.Verify(a => a.GetMatchFromActaAsync(missing, Season, _competition, _group, It.IsAny<CancellationToken>()), Times.Once);
            _actas.Verify(a => a.GetMatchFromActaAsync(stored, It.IsAny<int>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Never);
            _actas.Verify(a => a.GetMatchFromActaAsync(upcoming, It.IsAny<int>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Never);
            _actas.Verify(a => a.GetMatchFromActaAsync(otherRound, It.IsAny<int>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task Cuenta_como_fallidas_las_actas_que_la_rffm_no_devuelve_o_que_siguen_abiertas_y_continua()
        {
            var teamId = await SeedTeamAsync();
            var notFound = Code("N");
            var boom = Code("B");
            var ok = Code("K");
            await SeedRoundAsync(5, Snapshot(notFound, "1"), Snapshot(boom, "1"), Snapshot(ok, "1"));
            _actas.Setup(a => a.GetMatchFromActaAsync(notFound, It.IsAny<int>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync((MatchRffm?)null);
            _actas.Setup(a => a.GetMatchFromActaAsync(boom, It.IsAny<int>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(new InvalidOperationException("RFFM caída"));
            _actas.Setup(a => a.GetMatchFromActaAsync(ok, It.IsAny<int>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new MatchRffm { RecordClosed = "1" });

            var result = await RunAsync(teamId, 5);

            Assert.Equal(3, result.Requested);
            Assert.Equal(1, result.Stored);
            Assert.Equal(2, result.Failed);
        }

        [Fact]
        public async Task Sin_actas_pendientes_no_llama_a_la_rffm()
        {
            var teamId = await SeedTeamAsync();
            var stored = Code("S");
            await SeedRoundAsync(5, Snapshot(stored, "1"));
            await SeedStoredActaAsync(stored);

            var result = await RunAsync(teamId, 5);

            Assert.Equal(0, result.Requested);
            _actas.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task Un_equipo_sin_liga_responde_conflicto()
        {
            var teamId = await SeedTeamAsync(withLeague: false);

            await Assert.ThrowsAsync<ConflictException>(() => RunAsync(teamId, 5));
        }
    }
}
