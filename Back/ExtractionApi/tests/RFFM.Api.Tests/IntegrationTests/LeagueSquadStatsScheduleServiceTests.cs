#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Federation.LeagueSquadStats;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Federation.LeagueSquadStats.Services;
using RFFM.Api.Infrastructure.Options;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    [Collection(PostgresCollection.Name)]
    public class LeagueSquadStatsScheduleServiceTests
    {
        private const int Season = 22;
        private static readonly DateTime LastMonday = new(2026, 10, 11, 22, 1, 0, DateTimeKind.Utc);

        private readonly PostgresContainerFixture _fixture;
        private readonly List<string> _enqueued = new();
        private readonly int _competition = Random.Shared.Next(100_000_000, 900_000_000);
        private readonly int _group = Random.Shared.Next(100_000_000, 900_000_000);

        public LeagueSquadStatsScheduleServiceTests(PostgresContainerFixture fixture) => _fixture = fixture;

        private sealed class RecordingQueue(List<string> enqueued) : ILeagueSquadStatsQueue
        {
            public ValueTask EnqueueAsync(string reportId, CancellationToken cancellationToken = default)
            {
                enqueued.Add(reportId);
                return ValueTask.CompletedTask;
            }

            public async IAsyncEnumerable<string> DequeueAllAsync(
                [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken)
            {
                await Task.CompletedTask;
                yield break;
            }
        }

        private async Task SeedCoachTeamAsync(int? competition, int? group)
        {
            await using var db = _fixture.CreateDbContext();
            var club = Club.Create($"Schedule Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Domain.Entities.Seasons.Season.Create($"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9),
                isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            db.Teams.Add(new Team(new TeamModelBase
            {
                Name = "Schedule Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id,
                RffmCompetitionId = competition,
                RffmGroupId = group
            }));
            await db.SaveChangesAsync();
        }

        private async Task<string> SeedReportAsync(DateTime requestedAt, bool completed = true, int? competition = null, int? group = null)
        {
            await using var db = _fixture.CreateFederationDbContext();
            var report = LeagueSquadStatsReport.Create(Season, 21, (competition ?? _competition).ToString(), (group ?? _group).ToString(), requestedAt);
            if (completed)
            {
                report.Start(requestedAt);
                report.Complete(requestedAt.AddMinutes(10));
            }

            db.LeagueSquadStatsReports.Add(report);
            await db.SaveChangesAsync();
            return report.Id;
        }

        private async Task RunAsync(DateTime dueBefore, DateTime now)
        {
            await using var appDb = _fixture.CreateDbContext();
            await using var db = _fixture.CreateFederationDbContext();
            var service = new LeagueSquadStatsScheduleService(appDb, db, new RecordingQueue(_enqueued),
                Options.Create(new RffmOptions()), new FixedTimeProvider(now));

            await service.EnqueueDueAsync(dueBefore, CancellationToken.None);
        }

        private async Task<LeagueSquadStatsReport?> FindReportAsync(int competition, int group)
        {
            await using var db = _fixture.CreateFederationDbContext();
            return await db.LeagueSquadStatsReports
                .Include(r => r.Subscribers)
                .SingleOrDefaultAsync(r => r.SeasonId == Season && r.CompetitionCode == competition.ToString() && r.GroupCode == group.ToString());
        }

        [Fact]
        public async Task Actualiza_la_liga_de_un_equipo_de_Coach_cuyo_informe_es_anterior_a_la_ejecucion()
        {
            await SeedCoachTeamAsync(_competition, _group);
            var reportId = await SeedReportAsync(LastMonday.AddDays(-7));

            await RunAsync(LastMonday, LastMonday);

            Assert.Contains(reportId, _enqueued);
            Assert.Equal(LeagueSquadStatsStatus.Pending, (await FindReportAsync(_competition, _group))!.Status);
        }

        [Fact]
        public async Task Crea_el_informe_de_una_liga_de_Coach_que_todavia_no_lo_tiene()
        {
            await SeedCoachTeamAsync(_competition, _group);

            await RunAsync(LastMonday, LastMonday);

            var report = await FindReportAsync(_competition, _group);
            Assert.NotNull(report);
            Assert.Contains(report!.Id, _enqueued);
            Assert.Empty(report.Subscribers);
        }

        [Fact]
        public async Task Una_liga_compartida_por_dos_equipos_de_Coach_se_encola_una_sola_vez()
        {
            await SeedCoachTeamAsync(_competition, _group);
            await SeedCoachTeamAsync(_competition, _group);
            var reportId = await SeedReportAsync(LastMonday.AddDays(-7));

            await RunAsync(LastMonday, LastMonday);

            Assert.Single(_enqueued, id => id == reportId);
        }

        [Fact]
        public async Task No_actualiza_un_informe_cuya_liga_no_tiene_ningun_equipo_de_Coach()
        {
            var reportId = await SeedReportAsync(LastMonday.AddDays(-7));

            await RunAsync(LastMonday, LastMonday);

            Assert.DoesNotContain(reportId, _enqueued);
        }

        [Fact]
        public async Task No_reencola_un_informe_que_ya_esta_en_curso()
        {
            await SeedCoachTeamAsync(_competition, _group);
            var reportId = await SeedReportAsync(LastMonday.AddDays(-7), completed: false);

            await RunAsync(LastMonday, LastMonday);

            Assert.DoesNotContain(reportId, _enqueued);
        }

        [Fact]
        public async Task No_actualiza_un_informe_pedido_despues_de_la_ejecucion_programada()
        {
            await SeedCoachTeamAsync(_competition, _group);
            var reportId = await SeedReportAsync(LastMonday.AddHours(3));

            await RunAsync(LastMonday, LastMonday.AddDays(2));

            Assert.DoesNotContain(reportId, _enqueued);
        }

        [Fact]
        public async Task Ignora_los_equipos_de_Coach_sin_grupo_configurado()
        {
            await SeedCoachTeamAsync(_competition, null);

            await RunAsync(LastMonday, LastMonday);

            await using var db = _fixture.CreateFederationDbContext();
            Assert.False(await db.LeagueSquadStatsReports.AnyAsync(r => r.CompetitionCode == _competition.ToString()));
        }
    }
}
